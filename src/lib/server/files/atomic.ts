import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function ensureDirForFile(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function atomicWriteFile(filePath: string, data: string | Buffer) {
  await ensureDirForFile(filePath);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, filePath);
}