import fs from 'node:fs/promises';
import path from 'node:path';
import * as tar from 'tar';
import { directorySizeBytes } from '../files/disk';
import { resolveDataPath } from '../files/paths';
import { applyPropertyUpdates, readServerProperties, writeServerProperties } from '../files/properties';
import { getDb, nowIso } from '../db';

export interface WorldInfo {
  name: string;
  path: string;
  sizeBytes: number;
}

function timestamp() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export async function listWorlds(): Promise<WorldInfo[]> {
  const worldsRoot = resolveDataPath('worlds');
  try {
    const entries = await fs.readdir(worldsRoot, { withFileTypes: true });
    const worlds: WorldInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const worldPath = path.join(worldsRoot, entry.name);
      const sizeBytes = await directorySizeBytes(worldPath);
      worlds.push({ name: entry.name, path: worldPath, sizeBytes });
    }

    worlds.sort((a, b) => a.name.localeCompare(b.name));
    return worlds;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function getActiveWorldName(): Promise<string> {
  const props = await readServerProperties(resolveDataPath('server.properties'));
  return props.map['level-name'] ?? 'Bedrock level';
}

export async function setActiveWorldName(world: string): Promise<void> {
  const propsPath = resolveDataPath('server.properties');
  const props = await readServerProperties(propsPath);
  const next = applyPropertyUpdates(props.tokens, {
    'level-name': world
  });
  await writeServerProperties(propsPath, next);
}

export async function createWorldBackup(world: string, suffix?: string): Promise<{ backupPath: string; sizeBytes: number }> {
  const worldsRoot = resolveDataPath('worlds');
  const worldPath = resolveDataPath('worlds', world);
  await fs.access(worldPath);

  const backupsDir = resolveDataPath('backups', world);
  await fs.mkdir(backupsDir, { recursive: true });

  const fileName = `${timestamp()}${suffix ? `-${suffix}` : ''}.tar.gz`;
  const backupPath = path.join(backupsDir, fileName);

  await tar.c(
    {
      gzip: true,
      file: backupPath,
      cwd: worldsRoot,
      portable: true
    },
    [world]
  );

  const stat = await fs.stat(backupPath);
  const db = getDb();
  db.prepare('INSERT INTO backups(world, path, created_at, size_bytes) VALUES(?, ?, ?, ?)').run(
    world,
    backupPath,
    nowIso(),
    stat.size
  );

  return { backupPath, sizeBytes: stat.size };
}

export async function listWorldBackups(world: string): Promise<Array<{ path: string; sizeBytes: number; createdAt: string }>> {
  const db = getDb();
  const rows = db
    .prepare('SELECT path, size_bytes, created_at FROM backups WHERE world = ? ORDER BY created_at DESC')
    .all(world) as Array<{ path: string; size_bytes: number; created_at: string }>;

  return rows.map((row) => ({
    path: row.path,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  }));
}

export async function restoreWorldFromBackup(world: string, backupPath: string): Promise<void> {
  const worldsRoot = resolveDataPath('worlds');
  const worldPath = resolveDataPath('worlds', world);

  await createWorldBackup(world, 'pre-restore');

  await fs.rm(worldPath, { recursive: true, force: true });
  await fs.mkdir(worldsRoot, { recursive: true });

  await tar.x({
    file: backupPath,
    cwd: worldsRoot,
    gzip: true,
    filter: (entryPath: string) => {
      const normalized = entryPath.replace(/\\/g, '/');
      if (normalized.includes('..')) {
        return false;
      }

      return normalized === world || normalized.startsWith(`${world}/`);
    }
  });
}

export async function deleteWorld(world: string): Promise<void> {
  const worldPath = resolveDataPath('worlds', world);
  await fs.rm(worldPath, { recursive: true, force: true });
}

export async function listWorldFolders(): Promise<string[]> {
  const worlds = await listWorlds();
  return worlds.map((world) => world.name);
}
