import { randomBytes } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { assertCsrf } from '$lib/server/auth';
import {
  applyPropertyUpdates,
  parseServerProperties,
  readServerProperties,
  stringifyServerProperties,
  writeServerProperties
} from '$lib/server/files/properties';
import { resolveDataPath } from '$lib/server/files/paths';
import { getProvider } from '$lib/server/providers';

const propsPath = () => resolveDataPath('server.properties');

const GAMEMODES = new Set(['survival', 'creative', 'adventure']);
const DIFFICULTIES = new Set(['peaceful', 'easy', 'normal', 'hard']);

function normalizeBoolean(value: FormDataEntryValue | null): string {
  return value === 'true' || value === 'on' ? 'true' : 'false';
}

function validateInteger(value: string, field: string, min: number, max: number): string {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`${field} must be ${min}-${max}`);
  }
  return String(num);
}

export const load: PageServerLoad = async () => {
  const props = await readServerProperties(propsPath());

  return {
    map: props.map,
    raw: stringifyServerProperties(props.tokens),
    restartRecommended: false
  };
};

export const actions: Actions = {
  save: async (event) => {
    await assertCsrf(event);

    const form = await event.request.formData();
    const updates: Record<string, string> = {};

    const gamemode = String(form.get('gamemode') ?? '').trim();
    if (!GAMEMODES.has(gamemode)) {
      return fail(400, { error: 'Invalid gamemode.' });
    }

    const difficulty = String(form.get('difficulty') ?? '').trim();
    if (!DIFFICULTIES.has(difficulty)) {
      return fail(400, { error: 'Invalid difficulty.' });
    }

    const levelName = String(form.get('level-name') ?? '').trim();
    if (!levelName) {
      return fail(400, { error: 'level-name is required.' });
    }

    updates['gamemode'] = gamemode;
    updates['difficulty'] = difficulty;
    updates['max-players'] = validateInteger(String(form.get('max-players') ?? '10'), 'max-players', 1, 200);
    updates['allow-cheats'] = normalizeBoolean(form.get('allow-cheats'));
    updates['online-mode'] = normalizeBoolean(form.get('online-mode'));
    updates['server-port'] = validateInteger(String(form.get('server-port') ?? '19132'), 'server-port', 1, 65535);
    updates['level-name'] = levelName;
    updates['enable-rcon'] = normalizeBoolean(form.get('enable-rcon'));
    updates['rcon.port'] = validateInteger(String(form.get('rcon.port') ?? '19140'), 'rcon.port', 1, 65535);

    const rconPass = String(form.get('rcon.password') ?? '').trim();
    if (updates['enable-rcon'] === 'true' && !rconPass) {
      return fail(400, { error: 'rcon.password required when RCON is enabled.' });
    }
    if (rconPass) {
      updates['rcon.password'] = rconPass;
    }

    try {
      const current = await readServerProperties(propsPath());
      const next = applyPropertyUpdates(current.tokens, updates);
      await writeServerProperties(propsPath(), next);
      return { ok: true, message: 'server.properties saved.', restartRecommended: true };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to save server.properties.' });
    }
  },

  saveRaw: async (event) => {
    await assertCsrf(event);
    const form = await event.request.formData();
    const raw = String(form.get('raw') ?? '');

    try {
      const tokens = parseServerProperties(raw);
      await writeServerProperties(propsPath(), tokens);
      return { ok: true, message: 'Raw properties saved.', restartRecommended: true };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to save raw content.' });
    }
  },

  enableRcon: async (event) => {
    await assertCsrf(event);

    try {
      const current = await readServerProperties(propsPath());
      const password = current.map['rcon.password'] || randomBytes(12).toString('base64url');
      const port = current.map['rcon.port'] || '19140';

      const next = applyPropertyUpdates(current.tokens, {
        'enable-rcon': 'true',
        'rcon.password': password,
        'rcon.port': port
      });

      await writeServerProperties(propsPath(), next);
      return {
        ok: true,
        message: `RCON enabled. Password: ${password}`,
        restartRecommended: true
      };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to enable RCON.' });
    }
  },

  restart: async (event) => {
    await assertCsrf(event);

    try {
      await getProvider().restart();
      return { ok: true, message: 'Server restart triggered.' };
    } catch (error: any) {
      return fail(500, { error: error?.message ?? 'Failed to restart server.' });
    }
  }
};
