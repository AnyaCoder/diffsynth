import argparse
import json
import os
import re
import shlex
import signal
import sqlite3
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from job_run_directory import JobRunDirectory

EPOCH_CHECKPOINT_PATTERN = re.compile(r"epoch-(\d+)\.safetensors$")


def parse_job_spec(config_json: str, expected_job_type: str) -> tuple[dict, dict]:
    raw = json.loads(config_json)
    if isinstance(raw, dict) and raw.get("spec_version") == 1 and isinstance(raw.get("config"), dict):
        if raw.get("job_type") != expected_job_type:
            raise ValueError(f"Expected {expected_job_type} job spec, got {raw.get('job_type')}")
        return raw, raw["config"]
    return {"spec_version": 1, "job_type": expected_job_type, "config": raw}, raw


def count_visible_gpus(config: dict) -> int:
    resolved_num_processes = config.get("resolved_num_processes")
    if resolved_num_processes:
        return max(1, int(resolved_num_processes))
    if not config.get("multi_gpu"):
        return 1
    gpu_ids = str(config.get("gpu_ids") or os.environ.get("CUDA_VISIBLE_DEVICES", ""))
    gpu_count = len([gpu_id.strip() for gpu_id in gpu_ids.split(",") if gpu_id.strip()])
    return max(1, gpu_count)


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


def detect_epoch_progress(artifact_root: Path) -> int:
    highest_epoch = -1
    for item in artifact_root.glob("*.safetensors"):
        match = EPOCH_CHECKPOINT_PATTERN.match(item.name)
        if match:
            highest_epoch = max(highest_epoch, int(match.group(1)))
    return highest_epoch + 1


def build_command(config: dict):
    resolved_argv = config.get("resolved_command_argv")
    if isinstance(resolved_argv, list) and resolved_argv:
        return [str(part) for part in resolved_argv]

    num_processes = count_visible_gpus(config)
    return [
        "accelerate",
        "launch",
    ] + (["--multi_gpu"] if config.get("multi_gpu") else []) + [
        "--num_processes",
        str(num_processes),
        "examples/qwen_image/model_training/train.py",
        "--dataset_base_path",
        config["dataset_base_path"],
        "--dataset_metadata_path",
        config["dataset_metadata_path"],
        "--max_pixels",
        str(config["max_pixels"]),
        "--dataset_repeat",
        str(config["dataset_repeat"]),
        "--model_id_with_origin_paths",
        config["model_id_with_origin_paths"],
        "--fp8_models",
        config["fp8_models"],
        "--learning_rate",
        str(config["learning_rate"]),
        "--num_epochs",
        str(config["num_epochs"]),
        "--remove_prefix_in_ckpt",
        config["remove_prefix_in_ckpt"],
        "--output_path",
        config["output_path"],
        "--lora_base_model",
        config["lora_base_model"],
        "--lora_target_modules",
        config["lora_target_modules"],
        "--lora_rank",
        str(config["lora_rank"]),
        "--dataset_num_workers",
        str(config["dataset_num_workers"]),
        "--gradient_accumulation_steps",
        str(config["gradient_accumulation_steps"]),
    ] + (["--use_gradient_checkpointing"] if config.get("use_gradient_checkpointing") else []) + (
        ["--find_unused_parameters"] if config.get("find_unused_parameters") else []
    )


def resolve_command_env(config: dict) -> dict:
    resolved_env = config.get("resolved_command_env")
    if not isinstance(resolved_env, dict):
        return {"DIFFSYNTH_ATTENTION_IMPLEMENTATION": "flash_attention_2"}
    return {str(key): str(value) for key, value in resolved_env.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--db-path", required=True)
    args = parser.parse_args()

    job = load_job(args.db_path, args.job_id)
    if job is None:
        raise SystemExit("job not found")

    job_spec, spec = parse_job_spec(job["config_json"], "train")
    run_dir = JobRunDirectory(Path(job["artifact_root"]))
    run_dir.ensure()
    cmd = build_command(spec)
    command_env = resolve_command_env(spec)

    resolved_command = spec.get("resolved_command") or (
        "\n".join(f"export {key}={shlex.quote(value)}" for key, value in command_env.items())
        + "\n"
        + " ".join(shlex.quote(part) for part in cmd)
    )
    run_dir.write_command(resolved_command)
    run_dir.write_spec(job_spec)
    run_dir.write_state("running", 0, spec["num_epochs"])

    env = os.environ.copy()
    env.update(command_env)
    env["PYTHONUNBUFFERED"] = "1"

    update_job(args.db_path, args.job_id, progress_total=spec["num_epochs"], info="Training started")

    with run_dir.log.open("a", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            cmd,
            cwd=os.environ["QWEN_REPO_ROOT"],
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        run_dir.write_train_child_pid(process.pid)
        update_job(args.db_path, args.job_id, pid=process.pid, info=f"Training running (pid {process.pid})")
        stop_signal_sent = False
        last_progress = 0
        try:
            while True:
                rc = process.poll()
                if rc is not None:
                    break
                progress = min(detect_epoch_progress(run_dir.root), int(spec["num_epochs"]))
                if progress != last_progress:
                    last_progress = progress
                    run_dir.write_state("stopping" if stop_signal_sent else "running", progress, spec["num_epochs"])
                    update_job(
                        args.db_path,
                        args.job_id,
                        progress_current=progress,
                        progress_total=spec["num_epochs"],
                        info=f"Training progress {progress}/{spec['num_epochs']}",
                    )
                current_job = load_job(args.db_path, args.job_id)
                if current_job and current_job.get("stop_requested") and not stop_signal_sent:
                    stop_signal_sent = True
                    os.killpg(process.pid, signal.SIGTERM)
                    update_job(args.db_path, args.job_id, status="stopping", info="Stopping training...")
                time.sleep(2)
            final_status = "completed" if process.returncode == 0 else "error"
            info = "Training completed" if process.returncode == 0 else f"Training failed with code {process.returncode}"
            current_job = load_job(args.db_path, args.job_id)
            if current_job and current_job.get("stop_requested"):
                final_status = "stopped"
                info = "Training stopped"
            final_progress = int(spec["num_epochs"]) if process.returncode == 0 else last_progress
            run_dir.write_state(final_status, final_progress, spec["num_epochs"])
            update_job(
                args.db_path,
                args.job_id,
                status=final_status,
                progress_current=final_progress,
                info=info,
                finished_at=now_iso(),
                pid=None,
            )
        except Exception as exc:
            update_job(args.db_path, args.job_id, status="error", info=str(exc), finished_at=now_iso(), pid=None)
            raise


if __name__ == "__main__":
    main()
