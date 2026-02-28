import path from 'node:path';
import { loadConfig } from '../config';

const cfg = loadConfig();

export function dataRoot() {
  return cfg.dataRoot;
}

export function resolveDataPath(...segments: string[]): string {
  const base = path.resolve(cfg.dataRoot);
  const target = path.resolve(base, ...segments);
  const normalizedBase = process.platform === 'win32' ? base.toLowerCase() : base;
  const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;

  if (normalizedTarget !== normalizedBase && !normalizedTarget.startsWith(normalizedBase + path.sep)) {
    throw new Error(`Path escapes dataRoot: ${target}`);
  }

  return target;
}