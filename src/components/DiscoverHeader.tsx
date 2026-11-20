'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from './Wordmark';

export function DiscoverHeader({ matchCount }: { matchCount: number | null }) {
  const pathname = usePathname();
  const onMatches = pathname.startsWith('/discover/matches');

  return (
    <header className="px-4 pb-3 pt-5">
      <Wordmark className="text-xl" />

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold leading-none tracking-tight">
          {onMatches ? 'Matches' : 'Discover'}
        </h1>

        <Link
          href={onMatches ? '/discover' : '/discover/matches'}
          className="hard-sm press flex items-center gap-2 rounded-full bg-pinksoft px-3.5 py-2 text-xs font-extrabold text-ink"
        >
          {onMatches ? 'Back to deck' : 'Matches'}
          {!onMatches && matchCount !== null && matchCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ink bg-pink px-1 text-[10px] text-white">
              {matchCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
