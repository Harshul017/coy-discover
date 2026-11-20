import { NextResponse } from 'next/server';
import { ensureMigrated } from './db/client';
import { seed } from './db/seed';

let bootstrapped: Promise<void> | null = null;

/** Applies the schema and seeds on first use. Safe on every cold start. */
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
