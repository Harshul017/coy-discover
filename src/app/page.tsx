import { Wordmark } from '@/components/Wordmark';

/** Placeholder tab; the feature lives in Discover. */
export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <Wordmark className="text-4xl" />
      <div
        className="hard-sm flex h-14 w-14 items-center justify-center rounded-2xl bg-pinksoft"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-pink" fill="currentColor">
          <path d="M12 20.3 4.6 13a4.6 4.6 0 1 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" />
        </svg>
      </div>
      <h1 className="text-xl font-extrabold tracking-tight">Home</h1>
      <p className="max-w-[26ch] text-sm font-medium leading-relaxed text-muted">
        Placeholder for Coy&apos;s existing experience. Head to Discover.
      </p>
    </div>
  );
}
