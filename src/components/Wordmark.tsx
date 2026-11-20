/** Coy wordmark. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      coy<span className="text-pink">.</span>
    </span>
  );
}
