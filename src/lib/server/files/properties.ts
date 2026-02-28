import fs from 'node:fs/promises';
import { atomicWriteFile } from './atomic';

export type PropertyToken =
  | { type: 'blank'; raw: string }
  | { type: 'comment'; raw: string }
  | { type: 'raw'; raw: string }
  | { type: 'entry'; key: string; value: string; sep: '=' | ':'; raw: string };

export function parseServerProperties(content: string): PropertyToken[] {
  return content.split(/\r?\n/).map((line) => {
    if (!line.trim()) {
      return { type: 'blank', raw: line } as PropertyToken;
    }

    const trimmed = line.trimStart();
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      return { type: 'comment', raw: line } as PropertyToken;
    }

    const equalIndex = line.indexOf('=');
    const colonIndex = line.indexOf(':');
    let index = -1;
    let sep: '=' | ':' = '=';

    if (equalIndex >= 0 && colonIndex >= 0) {
      index = Math.min(equalIndex, colonIndex);
      sep = index === equalIndex ? '=' : ':';
    } else if (equalIndex >= 0) {
      index = equalIndex;
      sep = '=';
    } else if (colonIndex >= 0) {
      index = colonIndex;
      sep = ':';
    }

    if (index < 0) {
      return { type: 'raw', raw: line } as PropertyToken;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!key) {
      return { type: 'raw', raw: line } as PropertyToken;
    }

    return {
      type: 'entry',
      key,
      value,
      sep,
      raw: line
    } as PropertyToken;
  });
}

export function stringifyServerProperties(tokens: PropertyToken[]): string {
  const lines = tokens.map((token) => {
    if (token.type !== 'entry') {
      return token.raw;
    }
    return `${token.key}${token.sep}${token.value}`;
  });
  return `${lines.join('\n')}\n`;
}

export function tokensToMap(tokens: PropertyToken[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const token of tokens) {
    if (token.type === 'entry') {
      result[token.key] = token.value;
    }
  }
  return result;
}

export function applyPropertyUpdates(tokens: PropertyToken[], updates: Record<string, string>) {
  const pending = new Map<string, string>(Object.entries(updates));
  const next = tokens.map((token) => {
    if (token.type !== 'entry') {
      return token;
    }
    if (!pending.has(token.key)) {
      return token;
    }

    const value = pending.get(token.key) ?? '';
    pending.delete(token.key);
    return {
      ...token,
      value
    } as PropertyToken;
  });

  for (const [key, value] of pending.entries()) {
    next.push({ type: 'entry', key, value, sep: '=', raw: `${key}=${value}` });
  }

  return next;
}

export async function readServerProperties(filePath: string): Promise<{ tokens: PropertyToken[]; map: Record<string, string>; raw: string }> {
  let raw = '';
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    raw = '';
  }

  const tokens = parseServerProperties(raw);
  const map = tokensToMap(tokens);
  return { tokens, map, raw };
}

export async function writeServerProperties(filePath: string, tokens: PropertyToken[]) {
  const payload = stringifyServerProperties(tokens);
  await atomicWriteFile(filePath, payload);
}