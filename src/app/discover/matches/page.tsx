'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { DiscoverHeader } from '@/components/DiscoverHeader';
import { fetchMatches } from '@/lib/client-api';
import type { MatchDTO } from '@/lib/types';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { matches: result } = await fetchMatches();
      setMatches(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load matches.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <>
      <DiscoverHeader matchCount={matches?.length ?? null} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {error && (
          <Notice title="Something went wrong" body={error} onRetry={() => void load()} />
        )}

        {!error && matches === null && (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="hard h-[84px] animate-pulse rounded-2xl bg-pinksoft" />
            ))}
          </ul>
        )}

        {!error && matches?.length === 0 && (
          <Notice
            title="No matches yet"
            body="When you and someone else both swipe right, they'll show up here. Nobody is told you liked them unless they like you back."
          />
        )}

        {!error && matches && matches.length > 0 && (
          <ul className="space-y-3">
            {matches.map((match) => (
              <li
                key={match.profile.id}
                className="hard flex items-center gap-3.5 rounded-2xl bg-surface p-3"
              >
                <Avatar
                  src={match.profile.photoUrl}
                  name={match.profile.name}
                  rounded="rounded-xl"
                  className="h-16 w-16 shrink-0 border-2 border-ink"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold tracking-tight">
                    {match.profile.name}{' '}
                    <span className="font-bold text-muted">{match.profile.age}</span>
                  </p>
                  <p className="truncate text-xs font-bold text-muted">
                    {match.profile.location}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-muted">
                    {match.profile.bio}
                  </p>
                </div>
                <time
                  dateTime={new Date(match.matchedAt).toISOString()}
                  className="shrink-0 self-start text-[11px] font-bold text-muted"
                >
                  {relativeTime(match.matchedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Notice({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-[26px] border-[2.5px] border-dashed border-ink/25 px-8 py-12 text-center">
      <div className="hard-sm flex h-14 w-14 items-center justify-center rounded-2xl bg-pinksoft" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-pink" fill="currentColor">
          <path d="M12 20.3 4.6 13a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
        </svg>
      </div>
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="max-w-[32ch] text-sm font-medium leading-relaxed text-muted">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="hard press mt-2 rounded-full bg-pink px-6 py-2.5 text-sm font-extrabold text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
