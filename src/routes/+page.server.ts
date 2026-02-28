import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import { getProvider } from '$lib/server/providers';
import { getDiskUsage } from '$lib/server/files/disk';
import { getActiveWorldName } from '$lib/server/worlds';

export const load: PageServerLoad = async ({ locals }) => {
  const provider = getProvider();
  const [disk, activeWorld, commandStatus] = await Promise.all([
    getDiskUsage(locals.config.dataRoot),
    getActiveWorldName(),
    provider.commandStatus()
  ]);

  let logs = '';
  try {
    logs = await provider.logsTail(200);
  } catch (error: any) {
    logs = `Unable to read logs: ${error?.message ?? 'unknown error'}`;
  }

  return {
    providerType: provider.type,
    activeWorld,
    disk,
    logs,
    commandStatus
  };
};

export const actions: Actions = {
  restart: async (event) => {
    await assertCsrf(event);

    try {
      await getProvider().restart();
      return { ok: true, message: 'Server restart triggered.' };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to restart server.' });
    }
  },

  command: async (event) => {
    await assertCsrf(event);
    const formData = await event.request.formData();
    const command = String(formData.get('command') ?? '').trim();

    if (!command) {
      return fail(400, { error: 'Command cannot be empty.' });
    }

    if (command.length > 200) {
      return fail(400, { error: 'Command too long.' });
    }

    try {
      const result = await getProvider().runCommand(command);
      return { ok: true, message: result.output || result.message };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Command failed.' });
    }
  }
};
