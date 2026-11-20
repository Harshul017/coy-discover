import type { MatchDTO, ProfileDTO, SwipeAction, SwipeResultDTO } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status}).`);
  }

  return (await res.json()) as T;
}

export function fetchFeed(): Promise<{ profiles: ProfileDTO[] }> {
  return request('/api/feed');
}

export function fetchMatches(): Promise<{ matches: MatchDTO[] }> {
  return request('/api/matches');
}

export function resetDemo(): Promise<{ ok: boolean }> {
  return request('/api/reset', { method: 'POST' });
}

export function sendSwipe(targetId: string, action: SwipeAction): Promise<SwipeResultDTO> {
  return request('/api/swipe', {
    method: 'POST',
    body: JSON.stringify({ targetId, action }),
  });
}
