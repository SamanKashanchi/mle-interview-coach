export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M9 21l5-10 4 7 2-3 3 6" fill="none" className="stroke-accent-ink" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>MLE Coach</span>
    </span>
  )
}
