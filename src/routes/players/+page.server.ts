import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import {
  addAllowlistPlayer,
  readAllowlist,
  readPermissions,
  removeAllowlistPlayer,
  removePermission,
  setPlayerPermission
} from '$lib/server/players';
import { resolveRconConfig, runRconCommand } from '$lib/server/rcon';

async function tryAllowlistAnnouncement(): Promise<string | null> {
  try {
    const cfg = await resolveRconConfig();
    if (!cfg.enabled) {
      return 'RCON disabled, skipped notification.';
    }
    await runRconCommand('say Allowlist updated by MineDeck');
    return null;
  } catch {
    return 'Allowlist updated, but RCON notification failed.';
  }
}

export const load: PageServerLoad = async () => {
  const [allowlist, permissions, rconCfg] = await Promise.all([readAllowlist(), readPermissions(), resolveRconConfig()]);

  let onlinePlayers = 'RCON disabled';
  if (rconCfg.enabled) {
    try {
      onlinePlayers = await runRconCommand('list');
    } catch (error: any) {
      onlinePlayers = `RCON list failed: ${error?.message ?? 'unknown error'}`;
    }
  }

  return {
    allowlist,
    permissions,
    rconEnabled: rconCfg.enabled,
    onlinePlayers
  };
};

export const actions: Actions = {
  addAllow: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();

    if (!name) {
      return fail(400, { error: 'Player name is required.' });
    }

    try {
      await addAllowlistPlayer(name);
      const info = await tryAllowlistAnnouncement();
      return { ok: true, message: `Added ${name} to allowlist.${info ? ` ${info}` : ''}` };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to add allowlist player.' });
    }
  },

  removeAllow: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const name = String(form.get('name') ?? '').trim();

    if (!name) {
      return fail(400, { error: 'Player name is required.' });
    }

    try {
      await removeAllowlistPlayer(name);
      const info = await tryAllowlistAnnouncement();
      return { ok: true, message: `Removed ${name} from allowlist.${info ? ` ${info}` : ''}` };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to remove allowlist player.' });
    }
  },

  setPermission: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const identity = String(form.get('identity') ?? '').trim();
    const permission = String(form.get('permission') ?? '').trim() as 'member' | 'operator';

    if (!identity) {
      return fail(400, { error: 'Name or XUID is required.' });
    }

    if (!['member', 'operator'].includes(permission)) {
      return fail(400, { error: 'Invalid permission value.' });
    }

    try {
      await setPlayerPermission(identity, permission);
      return { ok: true, message: `Permission updated for ${identity}.` };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to update permission.' });
    }
  },

  removePermission: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const identity = String(form.get('identity') ?? '').trim();

    if (!identity) {
      return fail(400, { error: 'Identity is required.' });
    }

    try {
      await removePermission(identity);
      return { ok: true, message: `Permission entry removed for ${identity}.` };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to remove permission.' });
    }
  }
};