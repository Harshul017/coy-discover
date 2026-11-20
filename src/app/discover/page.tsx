'use client';

import { useCallback, useEffect, useState } from 'react';
import { DiscoverHeader } from '@/components/DiscoverHeader';
import { SwipeDeck } from '@/components/SwipeDeck';
import { fetchMatches } from '@/lib/client-api';

export default function DiscoverPage() {
  const [matchCount, setMatchCount] = useState<number | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { matches } = await fetchMatches();
      setMatchCount(matches.length);
    } catch {
      // The badge is a nicety; a failure here should not disturb the deck.
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshCount();
    })();
  }, [refreshCount]);

  return (
    <>
      <DiscoverHeader matchCount={matchCount} />
      <SwipeDeck onMatched={() => void refreshCount()} />
    </>
  );
}
