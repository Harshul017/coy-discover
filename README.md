# Coy — Discover

A swipe-based discovery tab for Coy. A placeholder **Home** tab sits alongside
**Discover**, which holds the swipe deck, the match screen and the matches list.

Next.js (App Router) · TypeScript · Tailwind · framer-motion · SQLite over
libSQL — a local file in development, Turso when deployed.

## Running

```bash
npm install
npm run seed
npm run dev
```

The layout is mobile-first; open it at a phone width or use the browser's
device toolbar.

```bash
npm test                  # 28 backend tests
npm run build             # production build
npm run seed -- --reset   # clear swipes and matches, reseed
```

The database lives at `data/coy.db` and is gitignored.

## Demo

1. Open **Discover**. 36 profiles, one card at a time.
2. Drag right to like, left to pass; on desktop use the buttons or ← / →.
3. 13 seeded profiles have already liked you, so a right swipe on one of them
   opens the match screen. The third card in the deck is one of them.
4. A like that is not mutual shows a short confirmation instead.
5. **Matches** in the header lists mutual matches.
6. Reload. Swiped profiles stay gone and matches persist — the state is in the
   database, not the browser.

The deck is finite, so swiping all 36 reaches the empty state. In development
it offers **Reset demo data**; `npm run seed -- --reset` does the same.

## Privacy model

> Never reveal who has liked the user unless it is mutual.

A payload that leaks is not fixed by a UI that declines to render the field, so
the guarantee is enforced on the server and covered by tests.

**No like state crosses the wire.** `GET /feed` returns `id, name, age,
photoUrl, bio, location, interests` and nothing else. Responses are built field
by field in `toProfileDTO` rather than by spreading a row, so a column added
later cannot leak into a payload. One test asserts the exact key set; another
greps the serialised payload for like-related words.

**Ordering is not a side channel.** Profiles that had already liked the user
drifting toward the front of the deck would reveal them without naming them.
The deck is ordered by a salted hash of the profile id, which depends on
nothing like-related. A test asserts admirers are spread through the deck.

**A one-sided like is indistinguishable from a pass.** `POST /swipe` returns
`{ "matched": false }` for both, and attaches the profile only on a real match.

**`GET /matches` returns mutual pairs only.** A one-sided like has no
representation in the matches table.

**The client cannot act as another user.** `POST /swipe` takes `targetId` and
`action`; the actor comes from `getCurrentUserId()` on the server.

## API

| Method | Route | Returns |
| --- | --- | --- |
| `GET` | `/api/feed?limit=50` | `{ profiles }` — not yet swiped on |
| `POST` | `/api/swipe` | `{ matched, profile? }` |
| `GET` | `/api/matches` | `{ matches: { profile, matchedAt }[] }` |
| `POST` | `/api/reset` | re-seeds; dev only unless `ALLOW_DEMO_RESET=true` |

```bash
curl localhost:3000/api/feed
curl -X POST localhost:3000/api/swipe \
  -H 'Content-Type: application/json' \
  -d '{"targetId":"p01","action":"like"}'
curl localhost:3000/api/matches
```

`400` for a malformed body, an out-of-range limit or a self-swipe; `404` for an
unknown profile.

## Backend notes

**Swipes run as one write batch.** The reverse-like check and the match insert
have to be atomic, or two simultaneous likes can both read *no reverse like
yet* and neither side ends up matched. An interactive transaction would hold
SQLite's single write lock across round trips and stall concurrent swipes, so
the operation is a single `batch('write')` of three statements: insert the
swipe `ON CONFLICT DO NOTHING`; `INSERT INTO matches ... SELECT ... WHERE
EXISTS (like one way) AND EXISTS (like the other way) ON CONFLICT DO NOTHING`;
read back whether the match row exists. `tests/concurrency.test.ts` fires both
sides simultaneously against a file-backed database and asserts one match row.

**Other invariants.** `swipes` is keyed on `(swiper_id, target_id)`, so a
double tap cannot write twice and re-swiping returns the original outcome. A
recorded pass is never overwritten by a later like. `matches` stores the pair
with `user_a < user_b` under a `CHECK`, so it can exist in one direction only.
Request bodies are validated with zod.

## Frontend notes

- Drag with rotation tied to displacement, LIKE / NOPE stamps that fade in, and
  a commit threshold on distance or flick velocity.
- Optimistic swipes: the card leaves immediately and the request follows. On
  failure the card returns to the deck with a toast rather than being lost.
- A swipe in flight blocks the next one, so a double tap cannot fire twice.
- Loading, error, and empty states throughout.
- Keyboard support, labelled controls, `Escape` to dismiss the match screen,
  focus moved into it on open, and `prefers-reduced-motion` respected.
- Photos are placeholders from pravatar.cc, with a monogram fallback when an
  image fails to load.

## Visual design

Hot pink `#ff2e6e` on white with near-black type, thick black outlines and a
hard un-blurred offset shadow, pill buttons and large radii. The `.hard`,
`.hard-sm`, `.hard-lg` and `.press` utilities in `globals.css` carry it.

## Deploying

Vercel's filesystem is read-only and ephemeral, so a file-backed database would
lose every swipe. Turso is SQLite as a network service, leaving the schema and
SQL unchanged:

```bash
turso db create coy-discover
turso db show coy-discover --url     # TURSO_DATABASE_URL
turso db tokens create coy-discover  # TURSO_AUTH_TOKEN
```

Set both in Vercel. The client uses Turso when `TURSO_DATABASE_URL` is present
and a local file otherwise; the schema and seed are applied on first request.

With no auth, a deployed demo has one shared user. Set `ALLOW_DEMO_RESET=true`
and `NEXT_PUBLIC_ALLOW_DEMO_RESET=true` so the next reviewer can start fresh.

## Trade-offs

- **The feed is ordered in the application, not in SQL.** Free at 36 profiles;
  at scale the deck rank would become an indexed column.
- **No auth.** The current user is one server-side function, so adding a real
  session touches one place. No route reads a user id from the client.
- **No undo.** A swiped profile must never reappear, and an undo would also let
  someone probe for a reaction.
- **Tests cover the backend**, where the privacy guarantees live. Component
  tests for the drag thresholds would come next.

## Structure

```
src/
  app/
    page.tsx                   Home (placeholder)
    discover/page.tsx          swipe deck
    discover/matches/page.tsx  matches list
    api/{feed,swipe,matches,reset}/route.ts
  components/                  TabBar, SwipeDeck, ProfileCard, MatchOverlay,
                               LikeSentPopup, Avatar, DiscoverHeader, Wordmark
  lib/
    db/{schema.sql,client.ts,seed.ts,seed-data.ts}
    services/discover.ts       feed, swipe and match logic
    types.ts                   wire types
tests/                         discover.test.ts, concurrency.test.ts
```
