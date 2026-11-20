import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { ensureMigrated } from '@/lib/db/client';
import { seed } from '@/lib/db/seed';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reset — wipe swipes and matches and re-seed.
 *
 * The deployed demo has a single shared user, so every reviewer swipes the same
 * deck. This lets the next person start fresh.
 *
 * Always available in development. In production it has to be switched on with
 * ALLOW_DEMO_RESET, so a real deployment cannot have its data wiped by anyone
 * who finds the route.
 */
export async function POST() {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_RESET === 'true';

  if (!enabled) {
    return jsonError('Demo reset is disabled.', 403);
  }

  try {
    const db = await ensureMigrated();
    const result = await seed(db, { reset: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/reset failed', err);
    return jsonError('Could not reset the demo.', 500);
  }
}
