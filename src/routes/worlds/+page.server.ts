import path from 'node:path';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import { resolveDataPath } from '$lib/server/files/paths';
import {
  createWorldBackup,
  deleteWorld,
  getActiveWorldName,
  listWorldBackups,
  listWorlds,
  restoreWorldFromBackup,
  setActiveWorldName
} from '$lib/server/worlds';
import { getProvider } from '$lib/server/providers';

function ensureBackupPathSafe(candidate: string): string {
  const backupsRoot = resolveDataPath('backups');
  const resolved = path.resolve(candidate);
  const root = path.resolve(backupsRoot);
  const nResolved = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const nRoot = process.platform === 'win32' ? root.toLowerCase() : root;

  if (nResolved !== nRoot && !nResolved.startsWith(`${nRoot}${path.sep}`)) {
    throw new Error('Backup path is outside backups root');
  }

  return resolved;
}

export const load: PageServerLoad = async () => {
  const worlds = await listWorlds();
  const activeWorld = await getActiveWorldName();

  const backupsByWorld: Record<string, Array<{ path: string; createdAt: string; sizeBytes: number }>> = {};
  for (const world of worlds) {
    backupsByWorld[world.name] = await listWorldBackups(world.name);
  }

  return {
    worlds,
    activeWorld,
    backupsByWorld
  };
};

export const actions: Actions = {
  backup: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const world = String(form.get('world') ?? '').trim();

    if (!world) {
      return fail(400, { error: 'World is required.' });
    }

    try {
      const backup = await createWorldBackup(world);
      return {
        ok: true,
        message: `Backup created: ${backup.backupPath}`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to create backup.' });
    }
  },

  restore: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const world = String(form.get('world') ?? '').trim();
    const backupPath = String(form.get('backupPath') ?? '').trim();
    const confirm = String(form.get('confirm') ?? '').trim();

    if (!world || !backupPath) {
      return fail(400, { error: 'World and backup path are required.' });
    }

    if (confirm !== 'RESTORE') {
      return fail(400, { error: 'Confirmation text must be RESTORE.' });
    }

    try {
      const safePath = ensureBackupPathSafe(backupPath);
      await restoreWorldFromBackup(world, safePath);
      return {
        ok: true,
        message: `World ${world} restored from backup.`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to restore world.' });
    }
  },

  delete: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const world = String(form.get('world') ?? '').trim();
    const confirm = String(form.get('confirm') ?? '').trim();

    if (!world) {
      return fail(400, { error: 'World is required.' });
    }

    if (confirm !== world) {
      return fail(400, { error: `Type ${world} to confirm deletion.` });
    }

    try {
      await deleteWorld(world);
      return {
        ok: true,
        message: `World ${world} deleted.`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to delete world.' });
    }
  },

  setActive: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const world = String(form.get('world') ?? '').trim();

    if (!world) {
      return fail(400, { error: 'World is required.' });
    }

    try {
      await setActiveWorldName(world);
      return {
        ok: true,
        message: `Active world set to ${world}. Restart recommended.`
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to set active world.' });
    }
  },

  restart: async (event) => {
    await assertCsrf(event);

    try {
      await getProvider().restart();
      return { ok: true, message: 'Server restart triggered.' };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Restart failed.' });
    }
  }
};
