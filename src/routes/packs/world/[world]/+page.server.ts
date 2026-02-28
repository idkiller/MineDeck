import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import { getWorldEnabledPacks, listInstalledPacks, setWorldEnabledPacks } from '$lib/server/packs';
import { listWorldFolders } from '$lib/server/worlds';
import { scheduleOneShotRestart } from '$lib/server/automation/scheduler';

export const load: PageServerLoad = async ({ params }) => {
  const world = params.world;
  const worlds = await listWorldFolders();

  if (!worlds.includes(world)) {
    throw error(404, 'World not found');
  }

  const packs = await listInstalledPacks();
  const enabled = await getWorldEnabledPacks(world);

  return {
    world,
    behaviorPacks: packs.filter((pack) => pack.type === 'behavior'),
    resourcePacks: packs.filter((pack) => pack.type === 'resource'),
    enabledBehavior: enabled.behavior.map((entry) => entry.pack_id),
    enabledResource: enabled.resource.map((entry) => entry.pack_id)
  };
};

export const actions: Actions = {
  save: async (event) => {
    await assertCsrf(event);

    const world = event.params.world;
    const packs = await listInstalledPacks();
    const behavior = packs.filter((pack) => pack.type === 'behavior');
    const resource = packs.filter((pack) => pack.type === 'resource');

    const form = await event.request.formData();
    const selectedBehavior = new Set(form.getAll('behavior').map((v) => String(v)));
    const selectedResource = new Set(form.getAll('resource').map((v) => String(v)));

    const behaviorRefs = behavior
      .filter((pack) => selectedBehavior.has(pack.manifest.uuid))
      .map((pack) => ({ pack_id: pack.manifest.uuid, version: pack.manifest.version }));
    const resourceRefs = resource
      .filter((pack) => selectedResource.has(pack.manifest.uuid))
      .map((pack) => ({ pack_id: pack.manifest.uuid, version: pack.manifest.version }));

    try {
      await setWorldEnabledPacks(world, behaviorRefs, resourceRefs);
      return { ok: true, message: 'World pack settings updated.' };
    } catch (err: any) {
      return fail(500, { error: err?.message ?? 'Failed to save world pack settings.' });
    }
  },

  apply: async (event) => {
    await assertCsrf(event);

    try {
      const job = scheduleOneShotRestart(0);
      return { ok: true, message: `Restart scheduled at ${job.schedule}.` };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to schedule restart.' });
    }
  }
};