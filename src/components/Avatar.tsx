'use client';

import { useState } from 'react';

/** Stable pastel hue per person, so the fallback is consistent across views. */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/**
 * Placeholder photos come from a remote service. If it is unreachable (offline
 * demo, blocked network) we fall back to a tinted monogram, so the deck never
 * shows a broken image.
 */
export function Avatar({
  src,
  name,
  className = '',
  rounded = '',
}: {
  src: string;
  name: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  if (failed) {
    const hue = hueFor(name);
    return (
      <div
        className={`flex items-center justify-center overflow-hidden ${rounded} ${className}`}
        style={{
          // Own container, so the monogram scales to the avatar box whether it
          // is a full-bleed card or a 64px row thumbnail.
          containerType: 'size',
          background: `linear-gradient(145deg, hsl(${hue} 85% 88%), hsl(${
            (hue + 40) % 360
          } 80% 76%))`,
        }}
        aria-hidden
      >
        <span
          className="font-extrabold leading-none tracking-tight"
          style={{ color: `hsl(${hue} 55% 28%)`, fontSize: '32cqmin' }}
        >
          {initials || '?'}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-cover ${rounded} ${className}`}
    />
  );
}
