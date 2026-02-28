import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import {
  createJob,
  deleteJob,
  listJobRuns,
  listJobs,
  setJobEnabled,
  type JobType,
  updateJob
} from '$lib/server/automation/scheduler';

function timeToCron(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error('Time must be HH:mm');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Invalid hour/minute range');
  }

  return `${minute} ${hour} * * *`;
}

function parsePayload(raw: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid payload JSON');
  }
}

export const load: PageServerLoad = async () => {
  return {
    jobs: listJobs(),
    jobRuns: listJobRuns(100)
  };
};

export const actions: Actions = {
  create: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();

    const type = String(form.get('type') ?? '') as JobType;
    const enabled = String(form.get('enabled') ?? 'true') === 'true';

    try {
      let schedule = '';
      let payload: Record<string, unknown> = {};

      if (type === 'daily_backup') {
        const time = String(form.get('time') ?? '').trim();
        schedule = timeToCron(time);
        const world = String(form.get('world') ?? '').trim();
        payload = world ? { world } : {};
      } else if (type === 'scheduled_restart') {
        schedule = String(form.get('schedule') ?? '').trim();
      } else {
        return fail(400, { error: 'Only daily_backup and scheduled_restart can be created manually.' });
      }

      createJob({ type, schedule, enabled, payload });
      return { ok: true, message: 'Job created.' };
    } catch (error: any) {
      return fail(400, { error: error?.message ?? 'Failed to create job.' });
    }
  },

  update: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();

    const jobId = Number(form.get('jobId'));
    const type = String(form.get('type') ?? '') as JobType;
    const enabled = String(form.get('enabled') ?? 'false') === 'true';
    const schedule = String(form.get('schedule') ?? '').trim();
    const payloadText = String(form.get('payload') ?? '{}');

    if (!Number.isInteger(jobId)) {
      return fail(400, { error: 'Invalid job ID.' });
    }

    try {
      const payload = parsePayload(payloadText);
      updateJob(jobId, { type, schedule, enabled, payload });
      return { ok: true, message: 'Job updated.' };
    } catch (error: any) {
      return fail(400, { error: error?.message ?? 'Failed to update job.' });
    }
  },

  toggle: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const jobId = Number(form.get('jobId'));
    const enabled = String(form.get('enabled') ?? 'false') === 'true';

    if (!Number.isInteger(jobId)) {
      return fail(400, { error: 'Invalid job ID.' });
    }

    setJobEnabled(jobId, enabled);
    return { ok: true, message: `Job ${enabled ? 'enabled' : 'disabled'}.` };
  },

  delete: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const jobId = Number(form.get('jobId'));
    const confirm = String(form.get('confirm') ?? '').trim();

    if (!Number.isInteger(jobId)) {
      return fail(400, { error: 'Invalid job ID.' });
    }

    if (confirm !== 'DELETE') {
      return fail(400, { error: 'Type DELETE to confirm job deletion.' });
    }

    deleteJob(jobId);
    return { ok: true, message: 'Job deleted.' };
  }
};