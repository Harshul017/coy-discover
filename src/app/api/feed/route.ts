import { NextResponse } from 'next/server';
import { jsonError, withDb } from '@/lib/api';
import { getCurrentUserId, getFeed } from '@/lib/services/discover';

export const dynamic = 'force-dynamic';

/** GET /api/feed — profiles the user has not swiped on yet. */
export async function GET(request: Request) {
  try {
    const db = await withDb();
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get('limit');
    const limit = rawLimit ? Number(rawLimit) : 50;

    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return jsonError('limit must be a number between 1 and 100.', 400);
    }

    const profiles = await getFeed(db, getCurrentUserId(), limit);
    return NextResponse.json({ profiles });
  } catch (err) {
    console.error('GET /api/feed failed', err);
    return jsonError('Could not load the feed.', 500);
  }
}
