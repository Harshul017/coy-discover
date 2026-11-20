'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import type { ProfileDTO } from '@/lib/types';

/** The only screen that reveals someone's interest, and only once it is mutual. */
export function MatchOverlay({
  profile,
  onClose,
}: {
  profile: ProfileDTO;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`It's a match with ${profile.name}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-pink px-6"
    >
      <motion.div
        initial={{ scale: 0.86, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="hard-lg w-full max-w-sm rounded-[28px] bg-surface px-6 py-8 text-center"
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-pink">
          Mutual
        </p>
        <h2 className="mt-2 text-[38px] font-extrabold leading-none tracking-tight">
          It&apos;s a match!
        </h2>
        <p className="mt-3 text-base font-semibold text-muted">
          You and {profile.name.split(' ')[0]} liked each other.
        </p>

        <div className="my-7 flex justify-center">
          <Avatar
            src={profile.photoUrl}
            name={profile.name}
            rounded="rounded-full"
            className="hard h-32 w-32"
          />
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/discover/matches"
            className="hard press rounded-full bg-pink px-6 py-3.5 text-sm font-extrabold text-white"
          >
            See your matches
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="hard press rounded-full bg-surface px-6 py-3.5 text-sm font-extrabold text-ink"
          >
            Keep swiping
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
