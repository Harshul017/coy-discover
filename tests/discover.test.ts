import { beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createTestDb } from '@/lib/db/client';
import { seed } from '@/lib/db/seed';
import { ME_ID, PROFILES } from '@/lib/db/seed-data';
import {
  InvalidSwipeError,
  NotFoundError,
  getFeed,
  getMatches,
  recordSwipe,
} from '@/lib/services/discover';

const ADMIRER = PROFILES.find((p) => p.likesMe)!.id;
const STRANGER = PROFILES.find((p) => !p.likesMe)!.id;

let db: Client;

beforeEach(async () => {
  db = createTestDb();
  await seed(db);
});

describe('feed', () => {
  it('returns every other profile before anything is swiped', async () => {
    const feed = await getFeed(db, ME_ID, 100);
    expect(feed).toHaveLength(PROFILES.length);
  });

  it('never includes the logged-in user', async () => {
    const feed = await getFeed(db, ME_ID, 100);
    expect(feed.some((p) => p.id === ME_ID)).toBe(false);
  });

  it('excludes profiles that have been swiped on, like or pass', async () => {
    await recordSwipe(db, ME_ID, STRANGER, 'pass');
    await recordSwipe(db, ME_ID, ADMIRER, 'like');

    const feed = await getFeed(db, ME_ID, 100);
    const ids = feed.map((p) => p.id);
    expect(ids).not.toContain(STRANGER);
    expect(ids).not.toContain(ADMIRER);
    expect(feed).toHaveLength(PROFILES.length - 2);
  });

  it('persists the exclusion in the database, not the client', async () => {
    await recordSwipe(db, ME_ID, STRANGER, 'pass');
    const feed = await getFeed(db, ME_ID, 100);
    expect(feed.map((p) => p.id)).not.toContain(STRANGER);
  });

  it('empties out once everything has been swiped', async () => {
    for (const p of PROFILES) await recordSwipe(db, ME_ID, p.id, 'pass');
    expect(await getFeed(db, ME_ID, 100)).toEqual([]);
  });

  it('respects the limit', async () => {
    expect(await getFeed(db, ME_ID, 5)).toHaveLength(5);
  });

  it('is ordered identically across calls', async () => {
    const a = (await getFeed(db, ME_ID, 100)).map((p) => p.id);
    const b = (await getFeed(db, ME_ID, 100)).map((p) => p.id);
    expect(a).toEqual(b);
  });
});

describe('privacy: the feed must not reveal who liked the user', () => {
  it('exposes no like-related fields on a profile', async () => {
    const feed = await getFeed(db, ME_ID, 100);
    const allowed = ['id', 'name', 'age', 'photoUrl', 'bio', 'location', 'interests'];

    for (const profile of feed) {
      expect(Object.keys(profile).sort()).toEqual([...allowed].sort());
    }
  });

  it('leaks nothing through the serialised payload', async () => {
    const payload = JSON.stringify(await getFeed(db, ME_ID, 100)).toLowerCase();
    for (const word of ['liked', 'likesme', 'admirer', 'incoming', 'swipe', 'match']) {
      expect(payload).not.toContain(word);
    }
  });

  it('does not float admirers to the front of the deck', async () => {
    const feed = await getFeed(db, ME_ID, 100);
    const admirers = new Set(PROFILES.filter((p) => p.likesMe).map((p) => p.id));
    const positions = feed
      .map((p, i) => (admirers.has(p.id) ? i : -1))
      .filter((i) => i >= 0);

    expect(positions.length).toBe(admirers.size);
    expect(Math.max(...positions)).toBeGreaterThan(feed.length / 2);
  });

  it('returns the same payload shape for a one-sided like as for a pass', async () => {
    const like = await recordSwipe(db, ME_ID, STRANGER, 'like');
    const other = PROFILES.find((p) => !p.likesMe && p.id !== STRANGER)!.id;
    const pass = await recordSwipe(db, ME_ID, other, 'pass');

    expect(like).toEqual({ matched: false });
    expect(pass).toEqual({ matched: false });
    expect(Object.keys(like)).toEqual(Object.keys(pass));
  });
});

describe('matching', () => {
  it('matches when both sides have liked', async () => {
    const result = await recordSwipe(db, ME_ID, ADMIRER, 'like');
    expect(result.matched).toBe(true);
    expect(result.profile?.id).toBe(ADMIRER);
  });

  it('does not match on a one-sided like', async () => {
    const result = await recordSwipe(db, ME_ID, STRANGER, 'like');
    expect(result.matched).toBe(false);
    expect(result.profile).toBeUndefined();
    expect(await getMatches(db, ME_ID)).toEqual([]);
  });

  it('never matches on a pass, even when the other person liked first', async () => {
    const result = await recordSwipe(db, ME_ID, ADMIRER, 'pass');
    expect(result.matched).toBe(false);
    expect(await getMatches(db, ME_ID)).toEqual([]);
  });

  it('matches when the user likes first and the other person likes later', async () => {
    const first = await recordSwipe(db, ME_ID, STRANGER, 'like');
    expect(first.matched).toBe(false);

    const second = await recordSwipe(db, STRANGER, ME_ID, 'like');
    expect(second.matched).toBe(true);

    const matches = await getMatches(db, ME_ID);
    expect(matches.map((m) => m.profile.id)).toContain(STRANGER);
  });

  it('lists only mutual matches', async () => {
    await recordSwipe(db, ME_ID, ADMIRER, 'like'); // mutual
    await recordSwipe(db, ME_ID, STRANGER, 'like'); // one-sided

    const matches = await getMatches(db, ME_ID);
    expect(matches.map((m) => m.profile.id)).toEqual([ADMIRER]);
  });

  it('stores a pair once, whichever direction it is read from', async () => {
    await recordSwipe(db, ME_ID, ADMIRER, 'like');
    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM matches');
    expect(Number(rows[0].n)).toBe(1);

    const mine = await getMatches(db, ME_ID);
    const theirs = await getMatches(db, ADMIRER);
    expect(mine).toHaveLength(1);
    expect(theirs.map((m) => m.profile.id)).toEqual([ME_ID]);
  });
});

describe('repeat and invalid swipes', () => {
  it('is idempotent: re-swiping returns the original outcome', async () => {
    const first = await recordSwipe(db, ME_ID, ADMIRER, 'like');
    const second = await recordSwipe(db, ME_ID, ADMIRER, 'like');

    expect(first.matched).toBe(true);
    expect(second.matched).toBe(true);
    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM matches');
    expect(Number(rows[0].n)).toBe(1);
  });

  it('cannot be used to overturn a pass by swiping again', async () => {
    await recordSwipe(db, ME_ID, ADMIRER, 'pass');
    const retry = await recordSwipe(db, ME_ID, ADMIRER, 'like');

    expect(retry.matched).toBe(false);
    const { rows } = await db.execute({
      sql: 'SELECT action FROM swipes WHERE swiper_id = ? AND target_id = ?',
      args: [ME_ID, ADMIRER],
    });
    expect(rows[0].action).toBe('pass');
  });

  it('rejects a swipe on yourself', async () => {
    await expect(recordSwipe(db, ME_ID, ME_ID, 'like')).rejects.toBeInstanceOf(
      InvalidSwipeError,
    );
  });

  it('rejects a swipe on an unknown profile', async () => {
    await expect(recordSwipe(db, ME_ID, 'nope', 'like')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('converges on exactly one match when both sides like, in either order', async () => {
    // True concurrency needs more than one connection; see concurrency.test.ts.
    const mine = await recordSwipe(db, ME_ID, STRANGER, 'like');
    const theirs = await recordSwipe(db, STRANGER, ME_ID, 'like');

    expect(mine.matched).toBe(false);
    expect(theirs.matched).toBe(true);

    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM matches');
    expect(Number(rows[0].n)).toBe(1);
    expect(await getMatches(db, ME_ID)).toHaveLength(1);
    expect(await getMatches(db, STRANGER)).toHaveLength(1);
  });
});

describe('seeding', () => {
  it('seeds at least 30 profiles plus the logged-in user', async () => {
    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM profiles');
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(31);
  });

  it('seeds people who already liked the user', async () => {
    const { rows } = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM swipes WHERE target_id = ? AND action = 'like'`,
      args: [ME_ID],
    });
    expect(Number(rows[0].n)).toBeGreaterThan(0);
  });

  it('is idempotent', async () => {
    await seed(db);
    await seed(db);
    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM profiles');
    expect(Number(rows[0].n)).toBe(PROFILES.length + 1);
  });

  it('reset clears swipes and matches', async () => {
    await recordSwipe(db, ME_ID, ADMIRER, 'like');
    await seed(db, { reset: true });

    expect(await getMatches(db, ME_ID)).toEqual([]);
    expect(await getFeed(db, ME_ID, 100)).toHaveLength(PROFILES.length);
  });
});
