import fs from 'node:fs/promises';
import path from 'node:path';

export type DiskUsage = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
};

export async function getDiskUsage(targetPath: string): Promise<DiskUsage> {
  const stat = await fs.statfs(targetPath);
  const totalBytes = stat.blocks * stat.bsize;
  const freeBytes = stat.bavail * stat.bsize;
  const usedBytes = totalBytes - freeBytes;

  return {
    totalBytes,
    usedBytes,
    freeBytes
  };
}

export async function directorySizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeBytes(fullPath);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      total += stat.size;
    }
  }
  return total;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let idx = 0;

  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }

  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}