import { NextResponse } from 'next/server';
import { ensureMigrated } from './db/client';
import { seed } from './db/seed';

let bootstrapped: Promise<void> | null = null;

/**
 * Makes sure the schema exists and the demo data is present before the first
 * request is served. Seeding is idempotent, so this is safe on every cold start
 * (serverless gives us plenty of those).
 */
export async function withDb() {
  const db = await ensureMigrated();
  if (!bootstrapped) {
    bootstrapped = (async () => {
      const { rows } = await db.execute('SELECT COUNT(*) AS n FROM profiles');
      if (Number(rows[0].n) === 0) await seed(db);
    })();
  }
  await bootstrapped;
  return db;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
