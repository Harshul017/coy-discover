# Coy — Discover tab

A swipe-based discovery feature built as a standalone app for the Coy SDE intern
assignment. There is a placeholder **Home** tab and a **Discover** tab holding
the swipe deck, the match screen and the matches list.

Built with Next.js (App Router) + TypeScript, Tailwind, framer-motion, and
SQLite over libSQL — a local file in development, Turso when deployed.

---

## Running it

```bash
npm install
npm run seed      # creates data/coy.db and loads 36 profiles
npm run dev       # http://localhost:3000
```

Open it at a phone width, or use a browser's device toolbar — the layout is
mobile-first and sits in a phone-width column on desktop.

```bash
npm test          # 28 backend tests
npm run seed -- --reset   # wipe swipes and matches, reseed
npm run build     # production build
```

The deck is finite — 36 profiles — so swiping through all of them lands on the
empty state. In development the empty state offers **Reset demo data**, which
calls `POST /api/reset`; `npm run seed -- --reset` does the same from the
terminal.

The database file lives at `data/coy.db` and is gitignored. Deleting it and
re-running `npm run seed` is equivalent to a reset.

---

## How to demo it

1. Open **Discover**. One card at a time, 36 profiles seeded.
2. Drag the card right to like, left to pass. On desktop use the buttons or the
   **←** / **→** arrow keys.
3. 13 of the seeded profiles have already liked you, so a right-swipe on one of
   them fires the **It's a match!** screen immediately. The third card in the
   deck is one of them, so a match is two swipes away.
4. Open **Matches** from the header to see mutual matches.
5. Reload the page. Everything you swiped is gone from the deck and your matches
   are still there — the state lives in the database, not in the browser.

---

## The privacy promise

> Never reveal who has liked the user unless it is mutual.

This is the part of the brief that shapes the design, so it is worth being
explicit about how it is enforced. A payload that leaks is not fixed by a UI
that chooses not to render the field — anyone can open the network tab.

**1. No like-state ever crosses the wire.**
`GET /feed` returns `id, name, age, photoUrl, bio, location, interests` and
nothing else. There is no `likedMe`, no `likesYouCount`, no ordering hint.
Responses are built field by field in `toProfileDTO` rather than by spreading a
database row, so a column added later cannot leak into a payload by accident.
A test asserts the exact key set on every profile, and a second test greps the
serialised payload for words like `liked` and `match`.

**2. Ordering is not a side channel.**
If profiles who had already liked you drifted toward the front of the deck, the
app would be leaking exactly what it promises to hide without naming anyone.
The deck is ordered by a hash of the profile id and a fixed salt
(`deckRank`), which depends on nothing about likes. It is stable across
reloads, and a test asserts that seeded admirers are spread through the deck
rather than clustered at the front.

**3. A one-sided like is indistinguishable from a pass.**
`POST /swipe` returns `{ "matched": false }` for both. The matched profile is
attached to the response only when the match is real, so even the response size
does not differentiate them. There is a test for this.

**4. `GET /matches` returns mutual pairs only.**
Matches are a separate table, written only when a `like` exists in both
directions. A one-sided like has no representation there at all.

**5. The client cannot act as another user.**
`POST /swipe` takes `targetId` and `action`. There is no `swiperId` — the actor
comes from `getCurrentUserId()` on the server. An extra `swiperId` in the body
is ignored.

---

## Backend

Three endpoints, plus a reset used for the hosted demo.

| Method | Route | Returns |
| --- | --- | --- |
| `GET` | `/api/feed?limit=50` | `{ profiles: Profile[] }` — not yet swiped on |
| `POST` | `/api/swipe` | `{ matched: boolean, profile?: Profile }` |
| `GET` | `/api/matches` | `{ matches: { profile, matchedAt }[] }` |
| `POST` | `/api/reset` | re-seeds; 403 unless `ALLOW_DEMO_RESET=true` |

```bash
curl localhost:3000/api/feed
curl -X POST localhost:3000/api/swipe \
  -H 'Content-Type: application/json' \
  -d '{"targetId":"p01","action":"like"}'
curl localhost:3000/api/matches
```

Errors: `400` for a malformed body, an out-of-range limit, or a self-swipe;
`404` for an unknown profile.

### Why the swipe is one batch, not a transaction block

The interesting bit of the backend is `recordSwipe`. The check ("have they
liked me?") and the write ("create the match") have to be atomic — otherwise
two simultaneous likes can both read *no reverse like yet* and neither side
ends up matched.

The obvious implementation opens an interactive transaction and does the read
and the write inside it. That is correct but it holds SQLite's single write
lock open across JS round trips, so a second concurrent swipe sits there until
it times out. The first version of this code deadlocked under
`tests/concurrency.test.ts` for exactly that reason.

Instead the whole thing is one `batch('write')` — three statements libSQL runs
in a single transaction:

1. insert the swipe, `ON CONFLICT DO NOTHING`
2. `INSERT INTO matches ... SELECT ... WHERE EXISTS (like one way) AND EXISTS
   (like the other way) ON CONFLICT DO NOTHING`
3. read back whether the match row exists

The check and the write are a single statement with no read-modify-write gap,
and the lock is held only for the length of the batch. `tests/concurrency.test.ts`
fires both sides of a match simultaneously against a file-backed database and
asserts exactly one match row results.

### Other correctness details

- `swipes` has a composite primary key `(swiper_id, target_id)`, so a double tap
  or a retried request cannot write two rows. Re-swiping returns the original
  outcome rather than an error.
- A recorded pass is never overwritten by a later like: the swipe insert does
  nothing on conflict, and the match insert needs a `like` row on both sides.
- `matches` stores the pair with `user_a < user_b` and a `CHECK` enforcing it,
  so a pair can exist in only one direction, once.
- `CHECK (swiper_id <> target_id)` at the schema level as well as in the service.
- Request bodies are validated with zod.

---

## Visual design

The palette and treatment follow Coy's live app: hot pink `#ff2e6e` on white
with near-black type, thick black outlines with a hard un-blurred offset
shadow rather than a soft blur, pill buttons and large corner radii, and a
heavy geometric sans. The `.hard` / `.hard-sm` / `.hard-lg` utilities in
`globals.css` carry that treatment, and `.press` pushes a control into its own
shadow when tapped.

## Frontend

- **Swipe**: framer-motion drag with rotation tied to displacement, LIKE / NOPE
  stamps that fade in as you drag, and a commit threshold on either distance or
  flick velocity. Below the threshold the card springs back.
- **Feedback on every swipe**: a mutual like opens the full "It's a match!"
  screen; a like that is not (yet) mutual shows a small self-dismissing popup
  confirming the like landed. The popup speaks only about the user's own
  action — it never hints at whether the other person has seen or liked them,
  which would leak the thing the app promises to hide.
- **Optimistic with rollback**: the card leaves immediately and the request
  follows. If it fails, the card is put back at the front of the deck and a
  toast explains why — a swipe that did not persist must not silently drop
  someone out of the deck.
- **A swipe in flight blocks the next one**, so a fast double tap or a held
  arrow key cannot fire twice on the same card.
- **States**: loading skeleton, error with retry, and an empty state when the
  deck runs out.
- **Accessibility**: real buttons with labels, arrow-key support, `Escape` to
  dismiss the match screen, focus moved into it on open, and
  `prefers-reduced-motion` respected.
- Photos are placeholders from pravatar.cc. If the network is unavailable the
  card falls back to a tinted monogram, so the demo works offline.

---

## Deploying to Vercel

Vercel's filesystem is read-only and ephemeral, so a file-backed SQLite
database would lose every swipe. Turso is SQLite as a network service, so the
schema and the SQL are unchanged:

```bash
turso db create coy-discover
turso db show coy-discover --url        # → TURSO_DATABASE_URL
turso db tokens create coy-discover     # → TURSO_AUTH_TOKEN
```

Set both as environment variables in Vercel. `src/lib/db/client.ts` uses Turso
when `TURSO_DATABASE_URL` is present and a local file otherwise. The schema is
applied and the data seeded on first request.

Because there is no auth, a deployed demo has a single shared user: everyone
who opens the link swipes the same deck. Set `ALLOW_DEMO_RESET=true` (and
`NEXT_PUBLIC_ALLOW_DEMO_RESET=true` to surface the button in the empty state)
so the next reviewer can start from a clean deck.

---

## Trade-offs and what I would do next

- **The feed is sorted in the application, not in SQL.** With 36 profiles that
  is free. At real scale the deck rank would become a stored column so the
  database can order and paginate with an index.
- **No auth.** The brief says to assume one logged-in user, so the current user
  is a single server-side function. Replacing it with a real session touches
  that one function; no route reads a user id from the client.
- **No undo.** Deliberate — "a profile that has been swiped on must never appear
  again" is a stated requirement, and an undo is also a privacy question, since
  it lets someone probe for a reaction.
- **Tests cover the backend**, which is where the brief puts the weight and
  where the privacy guarantees live. Component tests for the drag thresholds
  would be the next thing to add.

## Layout

```
src/
  app/
    page.tsx                  Home tab (placeholder)
    discover/page.tsx         swipe deck
    discover/matches/page.tsx matches list
    api/{feed,swipe,matches,reset}/route.ts
  components/                 TabBar, SwipeDeck, ProfileCard, MatchOverlay, Avatar
  lib/
    db/{schema.sql,client.ts,seed.ts,seed-data.ts}
    services/discover.ts      feed, swipe and match logic
    types.ts                  wire types, kept apart from row shapes
tests/                        discover.test.ts, concurrency.test.ts
```
