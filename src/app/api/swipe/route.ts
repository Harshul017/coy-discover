import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, withDb } from '@/lib/api';
import {
  InvalidSwipeError,
  NotFoundError,
  getCurrentUserId,
  recordSwipe,
} from '@/lib/services/discover';

export const dynamic = 'force-dynamic';

const SwipeBody = z.object({
  // Note there is no `swiperId`: the actor is taken from the session, never
  // from the request body, so a client cannot swipe as somebody else.
  targetId: z.string().min(1).max(64),
  action: z.enum(['like', 'pass']),
});

/** POST /api/swipe — record a like or pass; reports a match only if mutual. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be JSON.', 400);
  }

  const parsed = SwipeBody.safeParse(body);
  if (!parsed.success) {
    return jsonError('Expected { targetId: string, action: "like" | "pass" }.', 400);
  }

  try {
    const db = await withDb();
    const result = await recordSwipe(
      db,
      getCurrentUserId(),
      parsed.data.targetId,
      parsed.data.action,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotFoundError) return jsonError(err.message, 404);
    if (err instanceof InvalidSwipeError) return jsonError(err.message, 400);
    console.error('POST /api/swipe failed', err);
    return jsonError('Could not record the swipe.', 500);
  }
}
