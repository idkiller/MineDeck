import fs from 'node:fs/promises';
import { atomicWriteFile } from './atomic';

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await atomicWriteFile(filePath, payload);
}