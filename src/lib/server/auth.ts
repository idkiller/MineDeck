import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { getDb, nowIso } from './db';

const COOKIE_NAME = 'md_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

interface SessionRow {
  id: string;
  user_id: number;
  expires_at: string;
  csrf_token: string;
  created_at: string;
  username: string;
}

export interface UserSession {
  id: string;
  userId: number;
  username: string;
  expiresAt: string;
  csrfToken: string;
}

const db = getDb();

type RateEntry = {
  failedAttempts: number;
  firstAttemptAt: number;
  blockedUntil: number;
};

const loginRateMap = new Map<string, RateEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function createSession(userId: number): UserSession {
  const id = randomUUID();
  const csrfToken = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.prepare('INSERT INTO sessions(id, user_id, expires_at, csrf_token, created_at) VALUES(?, ?, ?, ?, ?)').run(
    id,
    userId,
    expiresAt,
    csrfToken,
    nowIso()
  );

  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.expires_at, s.csrf_token, s.created_at, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(id) as SessionRow;

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    expiresAt: row.expires_at,
    csrfToken: row.csrf_token
  };
}

export function getUserByUsername(username: string): { id: number; username: string; password_hash: string } | null {
  return (
    (db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as {
      id: number;
      username: string;
      password_hash: string;
    } | null) ?? null
  );
}

export function getSessionById(id: string): UserSession | null {
  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.expires_at, s.csrf_token, s.created_at, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(id) as SessionRow | undefined;

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    expiresAt: row.expires_at,
    csrfToken: row.csrf_token
  };
}

export function destroySession(id: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function setSessionCookie(event: RequestEvent, session: UserSession) {
  event.cookies.set(COOKIE_NAME, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(session.expiresAt)
  });
}

export function clearSessionCookie(event: RequestEvent) {
  event.cookies.delete(COOKIE_NAME, {
    path: '/'
  });
}

export function getSessionFromCookies(event: RequestEvent): UserSession | null {
  const sessionId = event.cookies.get(COOKIE_NAME);
  if (!sessionId) {
    return null;
  }
  return getSessionById(sessionId);
}

function cleanupRateMap(now: number) {
  for (const [key, entry] of loginRateMap.entries()) {
    if (entry.blockedUntil > 0 && entry.blockedUntil < now && now - entry.firstAttemptAt > WINDOW_MS) {
      loginRateMap.delete(key);
      continue;
    }

    if (entry.blockedUntil === 0 && now - entry.firstAttemptAt > WINDOW_MS) {
      loginRateMap.delete(key);
    }
  }
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  cleanupRateMap(now);

  const entry = loginRateMap.get(key);
  if (!entry) {
    return { allowed: true };
  }

  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  return { allowed: true };
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = loginRateMap.get(key);

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    loginRateMap.set(key, {
      failedAttempts: 1,
      firstAttemptAt: now,
      blockedUntil: 0
    });
    return;
  }

  entry.failedAttempts += 1;
  if (entry.failedAttempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }
  loginRateMap.set(key, entry);
}

export function clearFailedLogin(key: string) {
  loginRateMap.delete(key);
}

export function assertCsrf(event: RequestEvent) {
  const session = event.locals.session;
  if (!session) {
    throw error(401, 'Not authenticated');
  }

  const formToken = event.request.headers.get('x-csrf-token');
  if (formToken && formToken === session.csrfToken) {
    return;
  }

  return event.request
    .clone()
    .formData()
    .then((formData) => {
      const token = formData.get('_csrf');
      if (typeof token !== 'string' || token !== session.csrfToken) {
        throw error(403, 'Invalid CSRF token');
      }
    });
}

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}