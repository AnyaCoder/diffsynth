import argparse
import json
import os
import signal
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from diffsynth.pipelines.qwen_image import ModelConfig, QwenImagePipeline

from job_run_directory import JobRunDirectory


def parse_job_spec(config_json: str, expected_job_type: str) -> tuple[dict, dict]:
    raw = json.loads(config_json)
    if isinstance(raw, dict) and raw.get("spec_version") == 1 and isinstance(raw.get("config"), dict):
        if raw.get("job_type") != expected_job_type:
            raise ValueError(f"Expected {expected_job_type} job spec, got {raw.get('job_type')}")
        return raw, raw["config"]
    return {"spec_version": 1, "job_type": expected_job_type, "config": raw}, raw


def update_job(db_path: str, job_id: str, **fields):
    if not fields:
        return
    conn = sqlite3.connect(db_path)
    try:
        columns = ", ".join(f"{key}=?" for key in fields.keys())
        values = list(fields.values()) + [job_id]
        conn.execute(f"UPDATE Job SET {columns} WHERE id=?", values)
        conn.commit()
    finally:
        conn.close()


def load_job(db_path: str, job_id: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM Job WHERE id=?", (job_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def resolve_checkpoint_path(checkpoint_path: str | None) -> str | None:
    if not checkpoint_path:
        return checkpoint_path
    checkpoint = Path(checkpoint_path)
    if not checkpoint.exists():
        return checkpoint_path
    if checkpoint.is_file():
        return str(checkpoint)
    candidates = []
    for child in checkpoint.iterdir():
        if child.is_file() and child.suffix == ".safetensors":
            epoch_match = child.stem.startswith("epoch-")
            try:
                epoch_value = int(child.stem.split("-", 1)[1]) if epoch_match else -1
            except Exception:
                epoch_value = -1
            candidates.append((epoch_value, child.stat().st_mtime, child))
    if not candidates:
        raise FileNotFoundError(f"No .safetensors checkpoint found in directory: {checkpoint_path}")
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return str(candidates[0][2])


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--db-path", required=True)
    args = parser.parse_args()

    job = load_job(args.db_path, args.job_id)
    if job is None:
        raise SystemExit("job not found")

    job_spec, spec = parse_job_spec(job["config_json"], "infer")
    run_dir = JobRunDirectory(Path(job["artifact_root"]))
    run_dir.ensure()
    run_dir.write_spec(job_spec)

    def handle_stop(signum, _frame):
        run_dir.write_state("stopped", 0, 1)
        update_job(args.db_path, args.job_id, status="stopped", info="Inference stopped", finished_at=now_iso(), pid=None)
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    run_dir.write_state("running", 0, 1)
    update_job(args.db_path, args.job_id, status="running", info="Inference started", progress_total=1, pid=os.getpid())

    try:
        with run_dir.log.open("a", encoding="utf-8") as log_file:
            offload_mode = normalize_offload_mode(spec.get("offload_mode"))
            log_file.write(f"Loading QwenImagePipeline... offload_mode={offload_mode}\n")
            pipe = QwenImagePipeline.from_pretrained(
                torch_dtype=torch.bfloat16,
                device="cuda",
                model_configs=build_model_configs(offload_mode),
                tokenizer_config=ModelConfig(model_id="Qwen/Qwen-Image", origin_file_pattern="tokenizer/"),
                **build_pipeline_kwargs(offload_mode),
            )
            checkpoint_path = resolve_checkpoint_path(spec.get("checkpoint_path"))
            use_lora = bool(spec.get("use_lora", bool(checkpoint_path)))
            if use_lora and checkpoint_path:
                checkpoint = Path(checkpoint_path)
                if not checkpoint.exists():
                    raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
                log_file.write(f"Loading LoRA from {checkpoint_path}\n")
                pipe.load_lora(pipe.dit, checkpoint_path, hotload=True)

            image = pipe(
                spec["prompt"],
                seed=int(spec["seed"]),
                num_inference_steps=int(spec["num_inference_steps"]),
            )
            output_name = f'{spec["output_prefix"] or "result"}_{int(time.time())}.jpg'
            output_path = run_dir.root / output_name
            image.save(output_path)
            payload = {
                "output_path": str(output_path),
                "prompt": spec["prompt"],
                "seed": spec["seed"],
                "num_inference_steps": spec["num_inference_steps"],
                "checkpoint_path": checkpoint_path,
                "offload_mode": offload_mode,
                "use_lora": use_lora,
                "base_model": spec.get("base_model"),
                "created_at": now_iso(),
                "source_train_job_id": spec.get("source_train_job_id"),
            }
            run_dir.write_result(payload)
            log_file.write(f"Saved image to {output_path}\n")

        run_dir.write_state("completed", 1, 1)
        update_job(
            args.db_path,
            args.job_id,
            status="completed",
            progress_current=1,
            info="Inference completed",
            finished_at=now_iso(),
            pid=None,
        )
    except Exception as exc:
        run_dir.write_state("error", 0, 1)
        update_job(args.db_path, args.job_id, status="error", info=str(exc), finished_at=now_iso(), pid=None)
        raise


if __name__ == "__main__":
    main()
