import json
from pathlib import Path
from typing import Any


class JobRunDirectory:
    def __init__(self, root: Path):
        self.root = root
        self.log = root / "log.txt"
        self.state = root / "state.json"
        self.spec = root / "job_spec.json"
        self.command = root / "resolved_command.sh"
        self.result = root / "result.json"
        self.train_child_pid = root / "train_child_pid.txt"

    def ensure(self):
        self.root.mkdir(parents=True, exist_ok=True)

    def write_json(self, path: Path, payload: Any):
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def write_state(self, status: str, progress_current: int, progress_total: int):
        self.write_json(
            self.state,
            {
                "status": status,
                "progress_current": progress_current,
                "progress_total": progress_total,
            },
        )

    def write_spec(self, payload: Any):
        self.write_json(self.spec, payload)

    def write_result(self, payload: Any):
        self.write_json(self.result, payload)

    def write_command(self, command: str):
        self.command.write_text(command + "\n", encoding="utf-8")

    def write_train_child_pid(self, pid: int):
        self.train_child_pid.write_text(str(pid), encoding="utf-8")
