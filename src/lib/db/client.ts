import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

/**
 * One libSQL client for the process.
 *
 * Local development and tests use a SQLite file (or :memory:). Production uses
 * Turso over the network, because Vercel's filesystem is read-only and
 * ephemeral — a file-backed SQLite database there would lose every swipe.
 * The SQL is identical either way.
 */

let client: Client | null = null;
let migrated = false;

function resolveUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  // Default: a file next to the project root.
  return `file:${path.join(process.cwd(), 'data', 'coy.db')}`;
}

export function getDb(): Client {
  if (client) return client;

  const url = resolveUrl();

  if (url.startsWith('file:')) {
    const dir = path.dirname(url.slice('file:'.length));
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return client;
}

/** Create a fresh in-memory database. Used by the test suite. */
export function createTestDb(): Client {
  return createClient({ url: ':memory:' });
}

export function readSchema(): string[] {
  const file = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  return fs
    .readFileSync(file, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split('\n').every((l) => l.trim().startsWith('--')))
    .map((s) => `${s};`);
}

/**
 * WAL lets readers run while a write transaction is open, and busy_timeout
 * makes a writer wait its turn instead of failing immediately with
 * SQLITE_BUSY. Both are no-ops on a remote Turso connection, which handles
 * this server-side, so failures here are ignored.
 */
async function applyPragmas(db: Client): Promise<void> {
  for (const pragma of ['PRAGMA journal_mode = WAL', 'PRAGMA busy_timeout = 5000']) {
    try {
      await db.execute(pragma);
    } catch {
      // Remote connections reject PRAGMA; nothing to do.
    }
  }
}

export async function migrate(db: Client): Promise<void> {
  await applyPragmas(db);
  for (const stmt of readSchema()) {
    await db.execute(stmt);
  }
}

/** Runs the schema once per process for the shared client. */
export async function ensureMigrated(): Promise<Client> {
  const db = getDb();
  if (!migrated) {
    await migrate(db);
    migrated = true;
  }
  return db;
}

/** Test helper: drop the memoised client so the next getDb() re-reads env. */
export function __resetClientForTests(): void {
  client = null;
  migrated = false;
}
