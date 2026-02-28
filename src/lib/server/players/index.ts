import { resolveDataPath } from '../files/paths';
import { readJsonFile, writeJsonFileAtomic } from '../files/json';

export interface AllowlistEntry {
  name: string;
  xuid: string;
  ignoresPlayerLimit: boolean;
}

export interface PermissionEntry {
  permission: 'member' | 'operator';
  xuid?: string;
  name?: string;
}

const allowlistPath = () => resolveDataPath('allowlist.json');
const permissionsPath = () => resolveDataPath('permissions.json');

export async function readAllowlist(): Promise<AllowlistEntry[]> {
  return readJsonFile<AllowlistEntry[]>(allowlistPath(), []);
}

export async function writeAllowlist(entries: AllowlistEntry[]) {
  await writeJsonFileAtomic(allowlistPath(), entries);
}

export async function addAllowlistPlayer(name: string) {
  const entries = await readAllowlist();
  if (!entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
    entries.push({
      name,
      xuid: '',
      ignoresPlayerLimit: false
    });
  }
  await writeAllowlist(entries);
}

export async function removeAllowlistPlayer(name: string) {
  const entries = await readAllowlist();
  const next = entries.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
  await writeAllowlist(next);
}

export async function readPermissions(): Promise<PermissionEntry[]> {
  return readJsonFile<PermissionEntry[]>(permissionsPath(), []);
}

export async function writePermissions(entries: PermissionEntry[]) {
  await writeJsonFileAtomic(permissionsPath(), entries);
}

export async function setPlayerPermission(identity: string, permission: 'member' | 'operator') {
  const entries = await readPermissions();
  const isXuid = /^\d+$/.test(identity);
  const key = isXuid ? 'xuid' : 'name';

  const existingIndex = entries.findIndex((entry) => (entry[key] ?? '').toLowerCase() === identity.toLowerCase());
  if (existingIndex >= 0) {
    entries[existingIndex].permission = permission;
  } else {
    entries.push({
      permission,
      [key]: identity
    });
  }

  await writePermissions(entries);
}

export async function removePermission(identity: string) {
  const entries = await readPermissions();
  const next = entries.filter((entry) => {
    const byName = entry.name?.toLowerCase() === identity.toLowerCase();
    const byXuid = entry.xuid?.toLowerCase() === identity.toLowerCase();
    return !byName && !byXuid;
  });

  await writePermissions(next);
}