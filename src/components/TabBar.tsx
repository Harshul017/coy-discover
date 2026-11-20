'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/discover', label: 'Discover' },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-30 grid grid-cols-2 border-t-[2.5px] border-ink bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-extrabold"
          >
            <span
              aria-hidden
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                active
                  ? 'border-[2.5px] border-ink bg-pink text-white'
                  : 'text-muted'
              }`}
            >
              {tab.href === '/' ? <HomeIcon /> : <SparkIcon />}
            </span>
            <span className={active ? 'text-ink' : 'text-muted'}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
