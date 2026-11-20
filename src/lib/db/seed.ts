import type { Client } from '@libsql/client';
import { ME, ME_ID, PROFILES } from './seed-data';
import { migrate } from './client';

/**
 * Seeds the database. Idempotent: safe to run repeatedly.
 *
 * `reset: true` wipes swipes and matches as well, which is what the demo reset
 * endpoint uses so a reviewer can start from a clean deck.
 */
export async function seed(db: Client, { reset = false }: { reset?: boolean } = {}) {
  await migrate(db);

  if (reset) {
    await db.execute('DELETE FROM matches');
    await db.execute('DELETE FROM swipes');
    await db.execute('DELETE FROM profiles');
  }

  const now = Date.now();
  const all = [{ ...ME, likesMe: false }, ...PROFILES];

  await db.batch(
    all.map((p) => ({
      sql: `INSERT INTO profiles (id, name, age, photo_url, bio, location, interests, is_me)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              age = excluded.age,
              photo_url = excluded.photo_url,
              bio = excluded.bio,
              location = excluded.location,
              interests = excluded.interests`,
      args: [
        p.id,
        p.name,
        p.age,
        p.photoUrl,
        p.bio,
        p.location,
        JSON.stringify(p.interests),
        p.id === ME_ID ? 1 : 0,
      ],
    })),
    'write',
  );

  // Pre-existing likes *towards* the logged-in user. These are ordinary rows in
  // `swipes`; nothing marks them as special. They are never surfaced to the
  // client until the user likes the same person back.
  const admirers = PROFILES.filter((p) => p.likesMe);
  if (admirers.length > 0) {
    await db.batch(
      admirers.map((p, i) => ({
        sql: `INSERT INTO swipes (swiper_id, target_id, action, created_at)
              VALUES (?, ?, 'like', ?)
              ON CONFLICT(swiper_id, target_id) DO NOTHING`,
        args: [p.id, ME_ID, now - (admirers.length - i) * 60_000],
      })),
      'write',
    );
  }

  return {
    profiles: all.length,
    admirers: admirers.length,
  };
}
