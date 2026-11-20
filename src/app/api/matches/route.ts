import { NextResponse } from 'next/server';
import { jsonError, withDb } from '@/lib/api';
import { getCurrentUserId, getMatches } from '@/lib/services/discover';

export const dynamic = 'force-dynamic';

/** GET /api/matches — mutual matches only. */
export async function GET() {
  try {
    const db = await withDb();
    const matches = await getMatches(db, getCurrentUserId());
    return NextResponse.json({ matches });
  } catch (err) {
    console.error('GET /api/matches failed', err);
    return jsonError('Could not load matches.', 500);
  }
}
