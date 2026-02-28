import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { loadConfig } from './config';

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

const config = loadConfig();
const dbDir = path.resolve(config.dataRoot, 'minedeck');
const dbPath = path.resolve(dbDir, 'minedeck.sqlite');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<number>(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all().map((row: any) => row.version)
  );

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        schedule TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE job_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        ran_at TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      CREATE TABLE backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        world TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        size_bytes INTEGER NOT NULL
      );
      `
    }
  ];

  const insert = db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)');
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      insert.run(migration.version, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

function seedAdminFromEnv() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    return;
  }

  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    throw new Error('No users found. Set ADMIN_USER and ADMIN_PASSWORD for first-run admin seeding.');
  }

  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare('INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)').run(
    adminUser,
    hash,
    new Date().toISOString()
  );
}

runMigrations();

export function getDb() {
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function ensureAdminSeeded() {
  seedAdminFromEnv();
}
