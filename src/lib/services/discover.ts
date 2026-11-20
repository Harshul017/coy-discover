import type { Client, Row } from '@libsql/client';
import { ME_ID } from '../db/seed-data';
import type { MatchDTO, ProfileDTO, SwipeAction, SwipeResultDTO } from '../types';

/**
 * There is no auth in this app. Every request is the same person. Keeping that
 * assumption behind one function means swapping in a real session later touches
 * exactly one place, and no route ever reads a user id from the client.
 */
export function getCurrentUserId(): string {
  return ME_ID;
}

export class NotFoundError extends Error {}
export class InvalidSwipeError extends Error {}

/** Build the wire shape field by field. Never spread a database row. */
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
 * Deterministic, like-independent ordering.
 *
 * Ordering is a side channel: if profiles that already liked the user drifted
 * to the front of the deck, the app would be leaking exactly what it promises
 * to hide, without ever naming them in a payload. This hash depends only on the
 * profile id and a fixed salt, so the deck order is stable across reloads and
 * tells the user nothing.
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

/** Profiles the user has not swiped on yet, in a stable order. */
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

/** Matches are stored once, with the ids in sorted order. */
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
 * Records a swipe and reports whether it created (or already had) a match.
 *
 * All three statements run as one `batch('write')`, which libSQL executes
 * inside a single transaction. Doing it this way rather than with an
 * interactive transaction matters for two reasons:
 *
 *  1. Atomicity. "Have they liked me?" and "create the match" must not be
 *     separated, or two simultaneous likes can both read "no reverse like yet"
 *     and neither side ends up matched.
 *  2. Contention. An interactive transaction holds SQLite's single write lock
 *     open across network/JS round trips, so a second concurrent swipe sits
 *     there until it times out. A batch holds the lock only for the length of
 *     the batch.
 *
 * Re-swiping the same profile is a no-op rather than an error, so a double tap
 * or a retried request returns the original outcome. A recorded pass is never
 * overwritten by a later like: the match insert requires a `like` row on both
 * sides, and the swipe insert does nothing on conflict.
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
        // Insert a match only when a 'like' exists in both directions. Phrased
        // as INSERT..SELECT..WHERE EXISTS so the check and the write are one
        // statement with no read-modify-write gap.
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

  // A pass never matches, and a one-sided like returns exactly the same
  // payload as a pass: { matched: false }. The profile is attached only on a
  // real match, so the response itself carries no hint of one-sided interest.
  return matched ? { matched: true, profile: target } : { matched: false };
}

/** Mutual matches only. A one-sided like is never represented here. */
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
