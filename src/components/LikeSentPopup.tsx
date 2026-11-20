'use client';

import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { Avatar } from './Avatar';
import type { ProfileDTO } from '@/lib/types';

/**
 * Shown after a like that is not (yet) mutual.
 *
 * It tells the user only about their own action — that the like is recorded and
 * that they will hear back if it is returned. It deliberately says nothing
 * about the other person: not whether they are active, not whether they have
 * seen you, and above all not whether they have already liked you. Those would
 * all be ways of leaking the thing Coy promises to keep hidden.
 *
 * Deliberately non-blocking and self-dismissing: a modal here would mean
 * dismissing a dialog on every single right swipe.
 */
const VISIBLE_MS = 2000;

export function LikeSentPopup({
  profile,
  onDone,
}: {
  profile: ProfileDTO;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, VISIBLE_MS);
    return () => clearTimeout(id);
  }, [onDone, profile.id]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ y: -24, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -12, opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="pointer-events-none absolute inset-x-3 top-3 z-20"
    >
      <button
        type="button"
        onClick={onDone}
        className="hard pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left"
      >
        <div className="relative shrink-0">
          <Avatar
            src={profile.photoUrl}
            name={profile.name}
            rounded="rounded-xl"
            className="h-12 w-12 border-2 border-ink"
          />
          <span
            aria-hidden
            className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-pink text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="M12 20.3 4.6 13a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
            </svg>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-tight">
            You liked {profile.name.split(' ')[0]}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-muted">
            They won&apos;t know unless they like you back. We&apos;ll tell you if
            they do.
          </p>
        </div>
      </button>
    </motion.div>
  );
}
