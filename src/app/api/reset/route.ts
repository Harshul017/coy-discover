import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { ensureMigrated } from '@/lib/db/client';
import { seed } from '@/lib/db/seed';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reset — clears swipes and matches, then re-seeds.
 *
 * Always available in development; in production it requires ALLOW_DEMO_RESET.
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
