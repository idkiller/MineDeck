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
import { getProvider } from '$lib/server/providers';

async function tryAllowlistAnnouncement(): Promise<string | null> {
  const provider = getProvider();
  try {
    const status = await provider.commandStatus();
    if (!status.ok) {
      return `Command channel unavailable, skipped notification (${status.message}).`;
    }
    await provider.runCommand('say Allowlist updated by MineDeck');
    return null;
  } catch {
    return 'Allowlist updated, but command notification failed.';
  }
}

function extractPlayerLine(logs: string): string | null {
  const lines = logs.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/players online|online players|There are .* players/i.test(line)) {
      return line;
    }
  }
  return null;
}

export const load: PageServerLoad = async () => {
  const provider = getProvider();
  const [allowlist, permissions, commandStatus] = await Promise.all([
    readAllowlist(),
    readPermissions(),
    provider.commandStatus()
  ]);

  let onlinePlayers = `Command channel unavailable: ${commandStatus.message}`;
  if (commandStatus.ok) {
    try {
      const result = await provider.runCommand('list');
      if (result.output) {
        onlinePlayers = result.output;
      } else if (provider.type === 'docker') {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const logs = await provider.logsTail(150);
        const line = extractPlayerLine(logs);
        onlinePlayers =
          line ??
          'list command sent via send-command. Bedrock usually writes output to logs; open /logs for details.';
      } else {
        onlinePlayers = `${result.message} Check service logs for list output.`;
      }
    } catch (error: any) {
      onlinePlayers = `Player list command failed: ${error?.message ?? 'unknown error'}`;
    }
  }

  return {
    allowlist,
    permissions,
    commandStatus,
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
