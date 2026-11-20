'use client';

import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Avatar } from './Avatar';
import type { ProfileDTO, SwipeAction } from '@/lib/types';

const SWIPE_DISTANCE = 110; // px of travel that commits a swipe
const SWIPE_VELOCITY = 500; // or a flick at least this fast

export function ProfileCard({
  profile,
  onSwipe,
  interactive,
  exitDirection,
}: {
  profile: ProfileDTO;
  onSwipe: (action: SwipeAction) => void;
  interactive: boolean;
  /** -1 to fly left, 1 to fly right. */
  exitDirection: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [20, 130], [0, 1]);
  const passOpacity = useTransform(x, [-130, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const flung =
      Math.abs(info.offset.x) > SWIPE_DISTANCE ||
      Math.abs(info.velocity.x) > SWIPE_VELOCITY;

    if (!flung) return; // springs back
    onSwipe(info.offset.x > 0 ? 'like' : 'pass');
  }

  return (
    <motion.article
      className="hard-lg no-touch-pan absolute inset-0 overflow-hidden rounded-[26px] bg-surface"
      style={{ x, rotate }}
      drag={interactive ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.55}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={interactive ? { cursor: 'grabbing' } : undefined}
      exit={{
        x: exitDirection * 520,
        y: 24,
        rotate: exitDirection * 18,
        opacity: 0,
        transition: { duration: 0.28, ease: 'easeOut' },
      }}
    >
      <div className="relative h-full w-full" style={{ containerType: 'size' }}>
        <Avatar src={profile.photoUrl} name={profile.name} className="h-full w-full" />

        {/* Readability scrim. */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/88 via-black/45 to-transparent"
          aria-hidden
        />

        <Stamp
          label="LIKE"
          className="left-5 rotate-[-12deg] bg-pink text-white"
          opacity={likeOpacity}
        />
        <Stamp
          label="NOPE"
          className="right-5 rotate-[12deg] bg-white text-ink"
          opacity={passOpacity}
        />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">
            {profile.name}{' '}
            <span className="font-bold opacity-90">{profile.age}</span>
          </h2>
          <p className="mt-0.5 text-sm font-bold opacity-85">{profile.location}</p>
          <p className="mt-2 text-sm font-medium leading-snug opacity-95">{profile.bio}</p>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.interests.map((interest) => (
              <li
                key={interest}
                className="rounded-full border-2 border-white/40 bg-white/15 px-2.5 py-1 text-[11px] font-extrabold backdrop-blur-sm"
              >
                {interest}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.article>
  );
}

function Stamp({
  label,
  className,
  opacity,
}: {
  label: string;
  className: string;
  opacity: ReturnType<typeof useTransform<number, number>>;
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={`hard-sm absolute top-6 rounded-xl px-3 py-1 text-xl font-extrabold tracking-widest ${className}`}
    >
      {label}
    </motion.span>
  );
}
