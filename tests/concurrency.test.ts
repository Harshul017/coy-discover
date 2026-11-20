import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seed } from '@/lib/db/seed';
import { ME_ID, PROFILES } from '@/lib/db/seed-data';
import { getMatches, recordSwipe } from '@/lib/services/discover';

// Needs a file-backed database: an in-memory libSQL client holds a single
// connection, so two overlapping transactions cannot exist.

const STRANGER = PROFILES.find((p) => !p.likesMe)!.id;

let dir: string;
let db: Client;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coy-test-'));
  db = createClient({ url: `file:${path.join(dir, 'test.db')}` });
  await seed(db);
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('concurrent swipes', () => {
  it('creates exactly one match when both sides like at the same moment', async () => {
    const [a, b] = await Promise.all([
      recordSwipe(db, ME_ID, STRANGER, 'like'),
      recordSwipe(db, STRANGER, ME_ID, 'like'),
    ]);

    expect(a.matched || b.matched).toBe(true);

    const { rows } = await db.execute('SELECT COUNT(*) AS n FROM matches');
    expect(Number(rows[0].n)).toBe(1);
    expect(await getMatches(db, ME_ID)).toHaveLength(1);
    expect(await getMatches(db, STRANGER)).toHaveLength(1);
  });

  it('records one swipe row when the same like is fired twice at once', async () => {
    const results = await Promise.allSettled([
      recordSwipe(db, ME_ID, STRANGER, 'like'),
      recordSwipe(db, ME_ID, STRANGER, 'like'),
    ]);

    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

    const swipes = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM swipes WHERE swiper_id = ? AND target_id = ?',
      args: [ME_ID, STRANGER],
    });
    expect(Number(swipes.rows[0].n)).toBe(1);

    const matches = await db.execute('SELECT COUNT(*) AS n FROM matches');
    expect(Number(matches.rows[0].n)).toBe(0);
  });
});
