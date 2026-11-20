/** Wire types, kept separate from the database row shapes. */

/** A profile in the Discover deck. Carries no like information. */
export type ProfileDTO = {
  id: string;
  name: string;
  age: number;
  photoUrl: string;
  bio: string;
  location: string;
  interests: string[];
};

/** A mutual match. */
export type MatchDTO = {
  profile: ProfileDTO;
  matchedAt: number;
};

export type SwipeAction = 'like' | 'pass';

/**
 * `matched` is the only signal about the other person that crosses the wire,
 * and only when the interest is mutual. `profile` is present only on a match,
 * so the match screen renders without a second request.
 */
export type SwipeResultDTO = {
  matched: boolean;
  profile?: ProfileDTO;
};

export type ApiError = { error: string };
