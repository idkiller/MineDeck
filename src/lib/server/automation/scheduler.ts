import cron, { type ScheduledTask } from 'node-cron';
import { getDb, nowIso } from '../db';
import { getProvider } from '../providers';
import { createWorldBackup, getActiveWorldName } from '../worlds';

export type JobType = 'daily_backup' | 'scheduled_restart' | 'one_shot_restart';

export interface AutomationJob {
  id: number;
  type: JobType;
  schedule: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

type JobRow = {
  id: number;
  type: JobType;
  schedule: string;
  enabled: number;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

const db = getDb();
const activeTasks = new Map<number, ScheduledTask | NodeJS.Timeout>();
let initialized = false;

function fromRow(row: JobRow): AutomationJob {
  return {
    id: row.id,
    type: row.type,
    schedule: row.schedule,
    enabled: row.enabled === 1,
    payload: JSON.parse(row.payload_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getJobById(jobId: number): AutomationJob | null {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  return row ? fromRow(row) : null;
}

export function listJobs(): AutomationJob[] {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all() as JobRow[];
  return rows.map(fromRow);
}

export function listJobRuns(limit = 100): Array<{ id: number; jobId: number; ranAt: string; status: string; message: string }> {
  const rows = db
    .prepare('SELECT id, job_id, ran_at, status, message FROM job_runs ORDER BY ran_at DESC LIMIT ?')
    .all(limit) as Array<{ id: number; job_id: number; ran_at: string; status: string; message: string }>;

  return rows.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    ranAt: row.ran_at,
    status: row.status,
    message: row.message
  }));
}

function insertJobRun(jobId: number, status: 'success' | 'failure', message: string) {
  db.prepare('INSERT INTO job_runs(job_id, ran_at, status, message) VALUES(?, ?, ?, ?)').run(
    jobId,
    nowIso(),
    status,
    message
  );
}

async function executeJob(job: AutomationJob) {
  try {
    if (job.type === 'daily_backup') {
      const payloadWorld = typeof job.payload.world === 'string' ? job.payload.world : null;
      const world = payloadWorld || (await getActiveWorldName());
      const backup = await createWorldBackup(world, 'auto');
      insertJobRun(job.id, 'success', `Backup created: ${backup.backupPath}`);
      return;
    }

    if (job.type === 'scheduled_restart' || job.type === 'one_shot_restart') {
      await getProvider().restart();
      insertJobRun(job.id, 'success', 'Server restart completed');

      if (job.type === 'one_shot_restart') {
        db.prepare('UPDATE jobs SET enabled = 0, updated_at = ? WHERE id = ?').run(nowIso(), job.id);
        unscheduleJob(job.id);
      }
      return;
    }

    insertJobRun(job.id, 'failure', `Unknown job type: ${job.type}`);
  } catch (error: any) {
    insertJobRun(job.id, 'failure', error?.message ?? 'Unknown error');
  }
}

function unscheduleJob(jobId: number) {
  const task = activeTasks.get(jobId);
  if (!task) {
    return;
  }

  if (typeof (task as ScheduledTask).stop === 'function') {
    (task as ScheduledTask).stop();
  } else {
    clearTimeout(task as NodeJS.Timeout);
  }

  activeTasks.delete(jobId);
}

function scheduleJob(job: AutomationJob) {
  unscheduleJob(job.id);

  if (!job.enabled) {
    return;
  }

  if (job.type === 'one_shot_restart') {
    const runAt = new Date(job.schedule).getTime();
    if (Number.isNaN(runAt) || runAt <= Date.now()) {
      db.prepare('UPDATE jobs SET enabled = 0, updated_at = ? WHERE id = ?').run(nowIso(), job.id);
      return;
    }

    const timeout = setTimeout(() => {
      void executeJob(job);
    }, runAt - Date.now());

    activeTasks.set(job.id, timeout);
    return;
  }

  if (!cron.validate(job.schedule)) {
    insertJobRun(job.id, 'failure', `Invalid cron schedule: ${job.schedule}`);
    return;
  }

  const task = cron.schedule(job.schedule, () => {
    void executeJob(job);
  });
  activeTasks.set(job.id, task);
}

export function initAutomationScheduler() {
  if (initialized) {
    return;
  }

  initialized = true;
  const enabledRows = db.prepare('SELECT * FROM jobs WHERE enabled = 1').all() as JobRow[];
  for (const row of enabledRows) {
    scheduleJob(fromRow(row));
  }
}

export function createJob(input: {
  type: JobType;
  schedule: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
}): AutomationJob {
  const now = nowIso();
  const payloadJson = JSON.stringify(input.payload ?? {});
  const result = db
    .prepare('INSERT INTO jobs(type, schedule, enabled, payload_json, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
    .run(input.type, input.schedule, input.enabled ? 1 : 0, payloadJson, now, now);

  const job = getJobById(Number(result.lastInsertRowid));
  if (!job) {
    throw new Error('Failed to create job');
  }

  scheduleJob(job);
  return job;
}

export function updateJob(
  jobId: number,
  input: {
    type: JobType;
    schedule: string;
    enabled: boolean;
    payload?: Record<string, unknown>;
  }
) {
  db.prepare('UPDATE jobs SET type = ?, schedule = ?, enabled = ?, payload_json = ?, updated_at = ? WHERE id = ?').run(
    input.type,
    input.schedule,
    input.enabled ? 1 : 0,
    JSON.stringify(input.payload ?? {}),
    nowIso(),
    jobId
  );

  const job = getJobById(jobId);
  if (job) {
    scheduleJob(job);
  }
}

export function setJobEnabled(jobId: number, enabled: boolean) {
  db.prepare('UPDATE jobs SET enabled = ?, updated_at = ? WHERE id = ?').run(enabled ? 1 : 0, nowIso(), jobId);
  const job = getJobById(jobId);
  if (job) {
    scheduleJob(job);
  }
}

export function deleteJob(jobId: number) {
  unscheduleJob(jobId);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
}

export function scheduleOneShotRestart(delaySeconds: number): AutomationJob {
  const runAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  return createJob({
    type: 'one_shot_restart',
    schedule: runAt,
    enabled: true,
    payload: {
      source: 'packs_apply'
    }
  });
}