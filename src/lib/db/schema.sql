-- Coy Discover schema.
-- Design notes:
--  * `swipes` has a composite primary key so a user can never record two swipes
--    on the same target. A double-tap or a retried request is a no-op.
--  * `matches` stores the pair with user_a < user_b (lexicographic) so a pair can
--    only ever exist once, in one direction. There is no "who liked first" column:
--    that information is not needed to render a match and storing it invites leaks.
--  * Nothing in this schema is exposed to the client directly. See src/lib/dto.ts.

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  age         INTEGER NOT NULL CHECK (age >= 18),
  photo_url   TEXT    NOT NULL,
  bio         TEXT    NOT NULL,
  location    TEXT    NOT NULL,
  interests   TEXT    NOT NULL, -- JSON array of strings
  is_me       INTEGER NOT NULL DEFAULT 0 CHECK (is_me IN (0, 1))
);

CREATE TABLE IF NOT EXISTS swipes (
  swiper_id  TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id  TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action     TEXT    NOT NULL CHECK (action IN ('like', 'pass')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (swiper_id, target_id),
  CHECK (swiper_id <> target_id)
);

-- Lets us answer "has X already liked me?" without scanning.
CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes (target_id, action);

CREATE TABLE IF NOT EXISTS matches (
  user_a     TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b     TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_matches_a ON matches (user_a);
CREATE INDEX IF NOT EXISTS idx_matches_b ON matches (user_b);
