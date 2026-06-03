import fs from 'fs';
import path from 'path';

export const JOB_RUN_FILES = {
  bridgePid: 'pid.txt',
  trainChildPid: 'train_child_pid.txt',
  state: 'state.json',
  spec: 'job_spec.json',
  command: 'resolved_command.sh',
  result: 'result.json',
  log: 'log.txt',
} as const;

const SPEC_FILE_NAMES = new Set<string>([JOB_RUN_FILES.spec, JOB_RUN_FILES.command, JOB_RUN_FILES.result, JOB_RUN_FILES.state]);

export interface JobRunDirectory {
  root: string;
  bridgePidPath: string;
  trainChildPidPath: string;
  statePath: string;
  specPath: string;
  commandPath: string;
  resultPath: string;
  logPath: string;
}

export function getJobRunDirectory(root: string): JobRunDirectory {
  return {
    root,
    bridgePidPath: path.join(root, JOB_RUN_FILES.bridgePid),
    trainChildPidPath: path.join(root, JOB_RUN_FILES.trainChildPid),
    statePath: path.join(root, JOB_RUN_FILES.state),
    specPath: path.join(root, JOB_RUN_FILES.spec),
    commandPath: path.join(root, JOB_RUN_FILES.command),
    resultPath: path.join(root, JOB_RUN_FILES.result),
    logPath: path.join(root, JOB_RUN_FILES.log),
  };
}

export function prepareJobRunDirectory(root: string, specJson: string) {
  const runDir = getJobRunDirectory(root);
  fs.mkdirSync(runDir.root, { recursive: true });
  fs.writeFileSync(runDir.specPath, specJson, 'utf-8');
  for (const filePath of [runDir.bridgePidPath, runDir.trainChildPidPath, runDir.statePath]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
  return runDir;
}

export function readPidFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const parsed = Number(fs.readFileSync(filePath, 'utf-8').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function classifyJobRunFile(name: string) {
  if (name === JOB_RUN_FILES.log) return 'log' as const;
  if (SPEC_FILE_NAMES.has(name)) return 'spec' as const;
  return null;
}
