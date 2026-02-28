import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { resolveDataPath } from '../files/paths';
import { readJsonFile, writeJsonFileAtomic } from '../files/json';

const ALLOWED_EXT = new Set(['.mcpack', '.mcaddon', '.zip']);
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export type PackType = 'behavior' | 'resource';

export interface PackManifest {
  name: string;
  uuid: string;
  version: [number, number, number];
  description: string;
}

export interface InstalledPack {
  type: PackType;
  folder: string;
  path: string;
  manifest: PackManifest;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

function validateUpload(name: string, size: number) {
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported extension: ${ext}`);
  }
  if (size > MAX_UPLOAD_SIZE) {
    throw new Error(`File too large. Limit is ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
  }
}

function safeZipEntryPath(destDir: string, entryName: string): string {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, '/'));
  if (normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Unsafe zip entry path: ${entryName}`);
  }

  const target = path.resolve(destDir, normalized);
  const safeRoot = path.resolve(destDir);
  const targetNorm = process.platform === 'win32' ? target.toLowerCase() : target;
  const rootNorm = process.platform === 'win32' ? safeRoot.toLowerCase() : safeRoot;
  if (targetNorm !== rootNorm && !targetNorm.startsWith(rootNorm + path.sep)) {
    throw new Error(`Zip entry escapes destination: ${entryName}`);
  }

  return target;
}

async function extractZipSafe(zipFile: string, destDir: string): Promise<void> {
  const zip = new AdmZip(zipFile);
  for (const entry of zip.getEntries()) {
    const target = safeZipEntryPath(destDir, entry.entryName);
    if (entry.isDirectory) {
      await fs.mkdir(target, { recursive: true });
      continue;
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.getData());
  }
}

async function findManifestDirs(rootDir: string): Promise<string[]> {
  const found = new Set<string>();

  async function walk(current: string, depth: number) {
    if (depth > 6) {
      return;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        found.add(path.dirname(full));
      }
    }
  }

  await walk(rootDir, 0);
  return [...found];
}

function parseManifest(raw: any): PackManifest | null {
  const header = raw?.header;
  if (!header || typeof header.uuid !== 'string' || !Array.isArray(header.version)) {
    return null;
  }

  const version = header.version.slice(0, 3).map((v: any) => Number(v)) as [number, number, number];
  if (version.some((v) => Number.isNaN(v))) {
    return null;
  }

  return {
    name: typeof header.name === 'string' ? header.name : 'Unnamed Pack',
    uuid: header.uuid,
    version,
    description: typeof header.description === 'string' ? header.description : ''
  };
}

function detectPackType(manifest: any): PackType | null {
  const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];
  const types = new Set<string>(modules.map((module: any) => String(module?.type ?? '').toLowerCase()));

  if (types.has('resources')) {
    return 'resource';
  }

  if (types.has('data') || types.has('script')) {
    return 'behavior';
  }

  return null;
}

async function installManifestDir(manifestDir: string): Promise<InstalledPack | null> {
  const manifestPath = path.join(manifestDir, 'manifest.json');
  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const manifest = parseManifest(raw);
  if (!manifest) {
    return null;
  }

  const type = detectPackType(raw);
  if (!type) {
    return null;
  }

  const targetRoot = resolveDataPath(type === 'behavior' ? 'behavior_packs' : 'resource_packs');
  await fs.mkdir(targetRoot, { recursive: true });

  const folder = sanitizeName(`${manifest.name}_${manifest.uuid.slice(0, 8)}`);
  const targetDir = path.join(targetRoot, folder);

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(manifestDir, targetDir, { recursive: true, force: true });

  return {
    type,
    folder,
    path: targetDir,
    manifest
  };
}

export async function installUploadedPack(fileName: string, fileBytes: Buffer): Promise<InstalledPack[]> {
  validateUpload(fileName, fileBytes.length);

  const tmpRoot = resolveDataPath('minedeck', 'tmp', randomUUID());
  const uploadPath = path.join(tmpRoot, sanitizeName(fileName));
  const extractPath = path.join(tmpRoot, 'extracted');

  await fs.mkdir(extractPath, { recursive: true });
  await fs.writeFile(uploadPath, fileBytes);

  try {
    await extractZipSafe(uploadPath, extractPath);
    const manifestDirs = await findManifestDirs(extractPath);

    const installed: InstalledPack[] = [];
    for (const dir of manifestDirs) {
      const result = await installManifestDir(dir);
      if (result) {
        installed.push(result);
      }
    }

    return installed;
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

async function readInstalledType(type: PackType): Promise<InstalledPack[]> {
  const root = resolveDataPath(type === 'behavior' ? 'behavior_packs' : 'resource_packs');
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const packs: InstalledPack[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(root, entry.name, 'manifest.json');
      try {
        const manifestRaw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        const manifest = parseManifest(manifestRaw);
        if (!manifest) {
          continue;
        }

        packs.push({
          type,
          folder: entry.name,
          path: path.join(root, entry.name),
          manifest
        });
      } catch {
        continue;
      }
    }

    return packs;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  const behavior = await readInstalledType('behavior');
  const resource = await readInstalledType('resource');
  return [...behavior, ...resource];
}

export interface WorldPackRef {
  pack_id: string;
  version: [number, number, number];
}

function worldPackPath(world: string, type: PackType): string {
  return resolveDataPath(
    'worlds',
    world,
    type === 'behavior' ? 'world_behavior_packs.json' : 'world_resource_packs.json'
  );
}

export async function getWorldEnabledPacks(world: string): Promise<{ behavior: WorldPackRef[]; resource: WorldPackRef[] }> {
  const behavior = await readJsonFile<WorldPackRef[]>(worldPackPath(world, 'behavior'), []);
  const resource = await readJsonFile<WorldPackRef[]>(worldPackPath(world, 'resource'), []);
  return { behavior, resource };
}

export async function setWorldEnabledPacks(world: string, behavior: WorldPackRef[], resource: WorldPackRef[]) {
  await writeJsonFileAtomic(worldPackPath(world, 'behavior'), behavior);
  await writeJsonFileAtomic(worldPackPath(world, 'resource'), resource);
}