'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProfileCard } from './ProfileCard';
import { MatchOverlay } from './MatchOverlay';
import { LikeSentPopup } from './LikeSentPopup';
import { fetchFeed, resetDemo, sendSwipe } from '@/lib/client-api';
import type { ProfileDTO, SwipeAction } from '@/lib/types';

type Status = 'loading' | 'ready' | 'error';

/**
 * The deck is finite, so a reviewer who swipes all 36 profiles reaches the end.
 * In development the reset is always available; on a deployed demo it is shown
 * only when the server has it switched on too.
 */
const RESET_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ALLOW_DEMO_RESET === 'true';

export function SwipeDeck({ onMatched }: { onMatched?: () => void }) {
  const [deck, setDeck] = useState<ProfileDTO[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [match, setMatch] = useState<ProfileDTO | null>(null);
  const [likeSent, setLikeSent] = useState<ProfileDTO | null>(null);
  const [direction, setDirection] = useState(1);

  // Guards a swipe while the exit animation plays, so a fast double tap or a
  // held arrow key cannot fire twice on the same card.
  const busy = useRef(false);

  // No state is set before the first await: the component already mounts in
  // the 'loading' state, so the effect does not trigger a cascading render.
  const load = useCallback(async () => {
    try {
      const { profiles } = await fetchFeed();
      setDeck(profiles);
      setLoadError(null);
      setStatus('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the feed.');
      setStatus('error');
    }
  }, []);

  /** Used by the retry and refresh buttons, which are event handlers. */
  const reload = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      if (!controller.signal.aborted) await load();
    })();
    return () => controller.abort();
  }, [load]);

  const reset = useCallback(async () => {
    setStatus('loading');
    try {
      await resetDemo();
      await load();
      onMatched?.(); // the match-count badge drops back to zero
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not reset the demo.');
      setStatus('error');
    }
  }, [load, onMatched]);

  const swipe = useCallback(
    async (action: SwipeAction) => {
      if (busy.current) return;
      const profile = deck[0];
      if (!profile) return;

      busy.current = true;
      setDirection(action === 'like' ? 1 : -1);
      // Optimistic: the card leaves immediately, the request follows.
      setDeck((current) => current.slice(1));

      try {
        const result = await sendSwipe(profile.id, action);
        if (result.matched && result.profile) {
          setLikeSent(null);
          setMatch(result.profile);
          onMatched?.();
        } else if (action === 'like') {
          // Not mutual (yet). Confirm the like landed without saying anything
          // about how the other person feels.
          setLikeSent(profile);
        }
      } catch (err) {
        // The swipe did not persist, so put the card back where it was rather
        // than silently dropping someone out of the deck.
        setDeck((current) => [profile, ...current]);
        setLikeSent(null);
        setToast(err instanceof Error ? err.message : 'That swipe did not save.');
      } finally {
        busy.current = false;
      }
    },
    [deck, onMatched],
  );

  // Desktop keyboard support.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (match) return;
      if (event.key === 'ArrowLeft') void swipe('pass');
      if (event.key === 'ArrowRight') void swipe('like');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swipe, match]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  if (status === 'loading') return <DeckSkeleton />;

  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-6">
        <div className="relative min-h-0 flex-1">
          <Centered
            title="Something went wrong"
            body={loadError ?? 'Could not load the feed.'}
            action={{ label: 'Try again', onClick: reload }}
          />
        </div>
      </div>
    );
  }

  const top = deck[0];
  const next = deck[1];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mx-4 min-h-0 flex-1">
        {top ? (
          <>
            {/* The card behind, to give the deck depth. */}
            {next && (
              <div
                key={next.id}
                aria-hidden
                className="hard absolute inset-0 translate-y-3 scale-[0.955] overflow-hidden rounded-[26px] bg-pinksoft"
              />
            )}
            <AnimatePresence initial={false}>
              <ProfileCard
                key={top.id}
                profile={top}
                interactive={!match}
                exitDirection={direction}
                onSwipe={(action) => void swipe(action)}
              />
            </AnimatePresence>
          </>
        ) : (
          <EmptyState
            onRefresh={reload}
            onReset={RESET_ENABLED ? () => void reset() : undefined}
          />
        )}

        <AnimatePresence>
          {likeSent && !match && (
            <LikeSentPopup
              key={likeSent.id}
              profile={likeSent}
              onDone={() => setLikeSent(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-7 px-6 pb-4 pt-6">
        <ActionButton label="Pass" onClick={() => void swipe('pass')} disabled={!top}>
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ActionButton>

        <ActionButton label="Like" onClick={() => void swipe('like')} disabled={!top}>
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-pink" fill="currentColor">
            <path d="M12 20.3 4.6 13a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
          </svg>
        </ActionButton>
      </div>

      <p className="pb-3 text-center text-[11px] font-bold text-muted">
        Drag the card, tap a button, or use ← and →
      </p>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            role="status"
            className="hard pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-fit max-w-[90%] rounded-full bg-yellow px-4 py-2 text-sm font-extrabold text-ink"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {match && <MatchOverlay profile={match} onClose={() => setMatch(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="hard press flex h-[68px] w-[68px] items-center justify-center rounded-full bg-surface disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function DeckSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hard mx-4 min-h-0 flex-1 animate-pulse rounded-[26px] bg-pinksoft" />
      <div className="flex items-center justify-center gap-7 px-6 pb-10 pt-6">
        <div className="hard h-[68px] w-[68px] animate-pulse rounded-full bg-surface" />
        <div className="hard h-[68px] w-[68px] animate-pulse rounded-full bg-surface" />
      </div>
    </div>
  );
}

function EmptyState({
  onRefresh,
  onReset,
}: {
  onRefresh: () => void;
  onReset?: () => void;
}) {
  return (
    <Centered
      title="You're all caught up"
      body="You've seen everyone for now. Check back later for new people, or take a look at your matches."
      action={{ label: 'Refresh', onClick: onRefresh }}
      secondary={
        onReset ? { label: 'Reset demo data', onClick: onReset } : undefined
      }
    />
  );
}

function Centered({
  title,
  body,
  action,
  secondary,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[26px] border-[2.5px] border-dashed border-ink/25 px-8 text-center">
      <div
        className="hard-sm flex h-14 w-14 items-center justify-center rounded-2xl bg-pinksoft"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-pink" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" />
        </svg>
      </div>
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="max-w-[30ch] text-sm font-medium leading-relaxed text-muted">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="hard press mt-2 rounded-full bg-pink px-6 py-2.5 text-sm font-extrabold text-white"
        >
          {action.label}
        </button>
      )}
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          className="text-xs font-extrabold text-muted underline underline-offset-4"
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}
