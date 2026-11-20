/**
 * Wire types.
 *
 * These are deliberately separate from the database row shapes. Every response
 * is built field by field from a row, never by spreading one, so a column added
 * later (`liked_me_at`, say) cannot leak into a payload by accident.
 */

/** A profile as shown in the Discover deck. Carries no like information. */
export type ProfileDTO = {
  id: string;
  name: string;
  age: number;
  photoUrl: string;
  bio: string;
  location: string;
  interests: string[];
};

/** A mutual match. Only ever returned for pairs that liked each other. */
export type MatchDTO = {
  profile: ProfileDTO;
  matchedAt: number;
};

export type SwipeAction = 'like' | 'pass';

/**
 * The result of a swipe. `matched` is the only bit of information about the
 * other person's feelings that ever crosses the wire, and it is true only when
 * the interest is mutual.
 *
 * `profile` is populated only when `matched` is true, so the "It's a match!"
 * screen can render without a second request.
 */
export type SwipeResultDTO = {
  matched: boolean;
  profile?: ProfileDTO;
};

export type ApiError = { error: string };
