import argparse
import json
import os
import signal
import socket
import sqlite3
import sys
import threading
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
import uvicorn
from diffsynth.pipelines.qwen_image import ModelConfig, QwenImagePipeline
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from job_run_directory import JobRunDirectory


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_service(db_path: str, service_id: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM InferenceService WHERE id=?", (service_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_service(db_path: str, service_id: str, **fields):
    if not fields:
        return
    conn = sqlite3.connect(db_path)
    try:
        columns = ", ".join(f"{key}=?" for key in fields.keys())
        values = list(fields.values()) + [service_id]
        conn.execute(f"UPDATE InferenceService SET {columns} WHERE id=?", values)
        conn.commit()
    finally:
        conn.close()


def build_low_vram_config():
    return {
        "offload_dtype": "disk",
        "offload_device": "disk",
        "onload_dtype": torch.float8_e4m3fn,
        "onload_device": "cpu",
        "preparing_dtype": torch.float8_e4m3fn,
        "preparing_device": "cuda",
        "computation_dtype": torch.bfloat16,
        "computation_device": "cuda",
    }


def normalize_offload_mode(value):
    return "none" if value == "none" else "disk_cpu"


def build_model_configs(offload_mode):
    vram_config = build_low_vram_config() if offload_mode == "disk_cpu" else {}
    return [
        ModelConfig(model_id="Qwen/Qwen-Image-2512", origin_file_pattern="transformer/diffusion_pytorch_model*.safetensors", **vram_config),
        ModelConfig(model_id="Qwen/Qwen-Image", origin_file_pattern="text_encoder/model*.safetensors", **vram_config),
        ModelConfig(model_id="Qwen/Qwen-Image", origin_file_pattern="vae/diffusion_pytorch_model.safetensors", **vram_config),
    ]


def build_pipeline_kwargs(offload_mode):
    if offload_mode != "disk_cpu":
        return {}
    return {
        "vram_limit": torch.cuda.mem_get_info("cuda")[1] / (1024 ** 3) - 0.5,
    }


def pick_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class GenerateRequest(BaseModel):
    prompt: str
    seed: int = 0
    num_inference_steps: int = 40
    output_prefix: str = "service"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--service-id", required=True)
    parser.add_argument("--db-path", required=True)
    args = parser.parse_args()

    service = load_service(args.db_path, args.service_id)
    if service is None:
      raise SystemExit("service not found")

    runtime_root = Path(service["artifact_root"]) / "runtime"
    run_dir = JobRunDirectory(runtime_root)
    run_dir.ensure()
    run_dir.write_spec(
        {
            "spec_version": 1,
            "service_type": "infer_service",
            "config": {
                "name": service["name"],
                "gpu_ids": service["gpu_ids"],
                "offload_mode": normalize_offload_mode(service.get("offload_mode")),
                "base_model": service["base_model"],
                "checkpoint_path": service["checkpoint_path"],
                "use_lora": bool(service["use_lora"]),
                "source_train_job_id": service["source_train_job_id"],
            },
        }
    )
    run_dir.write_state("starting", 0, 1)

    stop_requested = threading.Event()
    pipe_holder: dict[str, Any] = {}
    generation_lock = threading.Lock()

    def log(message: str):
        with run_dir.log.open("a", encoding="utf-8") as handle:
            handle.write(message.rstrip() + "\n")

    def handle_stop(signum, _frame):
        log(f"Received stop signal {signum}")
        stop_requested.set()
        update_service(
            args.db_path,
            args.service_id,
            status="stopped",
            info="Service stopped",
            finished_at=now_iso(),
            pid=None,
        )
        run_dir.write_state("stopped", 0, 1)
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    try:
        offload_mode = normalize_offload_mode(service.get("offload_mode"))
        log(f"Loading QwenImagePipeline for service... offload_mode={offload_mode}")
        pipe = QwenImagePipeline.from_pretrained(
            torch_dtype=torch.bfloat16,
            device="cuda",
            model_configs=build_model_configs(offload_mode),
            tokenizer_config=ModelConfig(model_id="Qwen/Qwen-Image", origin_file_pattern="tokenizer/"),
            **build_pipeline_kwargs(offload_mode),
        )

        if bool(service["use_lora"]) and service["checkpoint_path"]:
            checkpoint = Path(service["checkpoint_path"])
            if not checkpoint.exists():
                raise FileNotFoundError(f"Checkpoint not found: {service['checkpoint_path']}")
            log(f"Loading LoRA from {checkpoint}")
            pipe.load_lora(pipe.dit, str(checkpoint), hotload=True)

        pipe_holder["pipe"] = pipe
        port = pick_free_port()
        update_service(
            args.db_path,
            args.service_id,
            status="running",
            info=f"Serving on port {port}",
            pid=os.getpid(),
            endpoint_url=f"http://127.0.0.1:{port}",
            port=port,
            finished_at=None,
        )
        run_dir.write_state("running", 1, 1)
        log(f"Service ready on port {port}")

        app = FastAPI()

        @app.get("/health")
        def health():
            latest = load_service(args.db_path, args.service_id) or service
            return {
                "status": latest["status"],
                "service_id": args.service_id,
                "name": latest["name"],
                "gpu_ids": latest["gpu_ids"],
                "offload_mode": normalize_offload_mode(latest.get("offload_mode")),
                "port": latest["port"],
                "use_lora": bool(latest["use_lora"]),
                "base_model": latest["base_model"],
                "checkpoint_path": latest["checkpoint_path"],
                "updated_at": latest["updated_at"],
            }

        @app.post("/generate")
        def generate(payload: GenerateRequest):
            if stop_requested.is_set():
                raise HTTPException(status_code=503, detail="Service is stopping")
            if not payload.prompt.strip():
                raise HTTPException(status_code=400, detail="Prompt is required")
            with generation_lock:
                current_pipe = pipe_holder["pipe"]
                started = time.time()
                output_name = f"{payload.output_prefix or 'service'}_{int(started)}.jpg"
                output_path = Path(service["artifact_root"]) / output_name
                log(f"Generating image: seed={payload.seed} steps={payload.num_inference_steps} output={output_name}")
                try:
                    image = current_pipe(
                        payload.prompt,
                        seed=int(payload.seed),
                        num_inference_steps=int(payload.num_inference_steps),
                    )
                    image.save(output_path)
                    result = {
                        "output_path": str(output_path),
                        "prompt": payload.prompt,
                        "seed": payload.seed,
                        "num_inference_steps": payload.num_inference_steps,
                        "created_at": now_iso(),
                        "checkpoint_path": service["checkpoint_path"],
                        "offload_mode": offload_mode,
                        "use_lora": bool(service["use_lora"]),
                        "base_model": service["base_model"],
                        "source_train_job_id": service["source_train_job_id"],
                    }
                    run_dir.write_result(result)
                    log(f"Saved image to {output_path}")
                    return result
                except Exception as exc:
                    log(f"ERROR during generate: {exc}")
                    log(traceback.format_exc())
                    raise HTTPException(status_code=500, detail=str(exc))
                finally:
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()

        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
        server = uvicorn.Server(config)
        server.run()

        final_status = "stopped" if stop_requested.is_set() else "stopped"
        final_info = "Service stopped" if stop_requested.is_set() else "Service exited"
        run_dir.write_state(final_status, 1, 1)
        update_service(
            args.db_path,
            args.service_id,
            status=final_status,
            info=final_info,
            finished_at=now_iso(),
            pid=None,
        )
    except Exception as exc:
        run_dir.write_state("error", 0, 1)
        update_service(
            args.db_path,
            args.service_id,
            status="error",
            info=str(exc),
            finished_at=now_iso(),
            pid=None,
        )
        with run_dir.log.open("a", encoding="utf-8") as handle:
            handle.write(f"ERROR: {exc}\n")
        raise


if __name__ == "__main__":
    main()
