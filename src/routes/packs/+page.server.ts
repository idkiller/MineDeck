import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import { getWorldEnabledPacks, installUploadedPack, listInstalledPacks } from '$lib/server/packs';
import { listWorldFolders } from '$lib/server/worlds';
import { scheduleOneShotRestart } from '$lib/server/automation/scheduler';

export const load: PageServerLoad = async () => {
  const [packs, worlds] = await Promise.all([listInstalledPacks(), listWorldFolders()]);

  const worldStatus: Record<string, { behavior: string[]; resource: string[] }> = {};
  for (const world of worlds) {
    const enabled = await getWorldEnabledPacks(world);
    worldStatus[world] = {
      behavior: enabled.behavior.map((entry) => entry.pack_id),
      resource: enabled.resource.map((entry) => entry.pack_id)
    };
  }

  return {
    packs,
    worlds,
    worldStatus
  };
};

export const actions: Actions = {
  upload: async (event) => {
    await assertCsrf(event);

    const formData = await event.request.formData();
    const file = formData.get('pack');

    if (!(file instanceof File)) {
      return fail(400, { error: 'No file uploaded.' });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    try {
      const installed = await installUploadedPack(file.name, bytes);
      if (!installed.length) {
        return fail(400, { error: 'No valid behavior/resource pack manifest was found in the archive.' });
      }

      return {
        ok: true,
        message: `Installed ${installed.length} pack(s): ${installed
          .map((pack) => `${pack.manifest.name} (${pack.type})`)
          .join(', ')}`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to install pack.' });
    }
  },

  applyPacks: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const delay = Number(form.get('delay') ?? '0');
    const seconds = Number.isFinite(delay) && delay >= 0 ? delay : 0;

    try {
      const job = scheduleOneShotRestart(seconds);
      return {
        ok: true,
        message: `Restart scheduled at ${job.schedule}.`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to schedule restart.' });
    }
  }
};