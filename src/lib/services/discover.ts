import type { Client, Row } from '@libsql/client';
import { ME_ID } from '../db/seed-data';
import type { MatchDTO, ProfileDTO, SwipeAction, SwipeResultDTO } from '../types';

/** Single-user app: the actor is resolved here, never read from the client. */
export function getCurrentUserId(): string {
  return ME_ID;
}

export class NotFoundError extends Error {}
export class InvalidSwipeError extends Error {}

/** Built field by field so a new column cannot leak into a response. */
function toProfileDTO(row: Row): ProfileDTO {
  return {
    id: String(row.id),
    name: String(row.name),
    age: Number(row.age),
    photoUrl: String(row.photo_url),
    bio: String(row.bio),
    location: String(row.location),
    interests: JSON.parse(String(row.interests)) as string[],
  };
}

/**
 * Stable deck order derived only from the profile id. Ordering by anything
 * like-related would reveal who liked the user without naming them.
 */
function deckRank(id: string): number {
  let h = 0x811c9dc5;
  const key = `coy-deck:${id}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Profiles the user has not swiped on yet. */
export async function getFeed(
  db: Client,
  userId: string,
  limit = 50,
): Promise<ProfileDTO[]> {
  const { rows } = await db.execute({
    sql: `SELECT p.id, p.name, p.age, p.photo_url, p.bio, p.location, p.interests
            FROM profiles p
           WHERE p.id <> ?
             AND p.is_me = 0
             AND NOT EXISTS (
                   SELECT 1 FROM swipes s
                    WHERE s.swiper_id = ? AND s.target_id = p.id
                 )`,
    args: [userId, userId],
  });

  return rows
    .map(toProfileDTO)
    .sort((a, b) => deckRank(a.id) - deckRank(b.id))
    .slice(0, limit);
}

/** Matches are keyed by the pair in sorted order, so it can exist only once. */
function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function getProfile(db: Client, id: string): Promise<ProfileDTO | null> {
  const { rows } = await db.execute({
    sql: `SELECT id, name, age, photo_url, bio, location, interests
            FROM profiles WHERE id = ?`,
    args: [id],
  });
  return rows.length > 0 ? toProfileDTO(rows[0]) : null;
}

/**
 * Records a swipe and reports whether the pair is now matched.
 *
 * Runs as a single write batch: the reverse-like check and the match insert
 * must be atomic, or two simultaneous likes can both miss the match. Re-swiping
 * is a no-op that returns the original outcome.
 */
export async function recordSwipe(
  db: Client,
  userId: string,
  targetId: string,
  action: SwipeAction,
): Promise<SwipeResultDTO> {
  if (targetId === userId) {
    throw new InvalidSwipeError('You cannot swipe on yourself.');
  }

  const target = await getProfile(db, targetId);
  if (!target) throw new NotFoundError('No such profile.');

  const now = Date.now();
  const [a, b] = pairKey(userId, targetId);

  const results = await db.batch(
    [
      {
        sql: `INSERT INTO swipes (swiper_id, target_id, action, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(swiper_id, target_id) DO NOTHING`,
        args: [userId, targetId, action, now],
      },
      {
        // INSERT..SELECT..WHERE EXISTS keeps the check and the write in one
        // statement, leaving no read-modify-write gap.
        sql: `INSERT INTO matches (user_a, user_b, created_at)
              SELECT ?, ?, ?
               WHERE EXISTS (SELECT 1 FROM swipes
                              WHERE swiper_id = ? AND target_id = ? AND action = 'like')
                 AND EXISTS (SELECT 1 FROM swipes
                              WHERE swiper_id = ? AND target_id = ? AND action = 'like')
              ON CONFLICT(user_a, user_b) DO NOTHING`,
        args: [a, b, now, userId, targetId, targetId, userId],
      },
      {
        sql: 'SELECT 1 AS matched FROM matches WHERE user_a = ? AND user_b = ?',
        args: [a, b],
      },
    ],
    'write',
  );

  const matched = results[2].rows.length > 0;

  // A one-sided like returns the same payload as a pass.
  return matched ? { matched: true, profile: target } : { matched: false };
}

/** Mutual matches only. */
export async function getMatches(db: Client, userId: string): Promise<MatchDTO[]> {
  const { rows } = await db.execute({
    sql: `SELECT p.id, p.name, p.age, p.photo_url, p.bio, p.location, p.interests,
                 m.created_at AS matched_at
            FROM matches m
            JOIN profiles p
              ON p.id = CASE WHEN m.user_a = ?1 THEN m.user_b ELSE m.user_a END
           WHERE m.user_a = ?1 OR m.user_b = ?1
           ORDER BY m.created_at DESC`,
    args: [userId],
  });

  return rows.map((row) => ({
    profile: toProfileDTO(row),
    matchedAt: Number(row.matched_at),
  }));
}
