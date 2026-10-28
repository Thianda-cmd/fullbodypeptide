/** The fullbody mark: a ball-and-stick chain of residues that stands as a figure. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 7.4v4.1m0 0-3.5 3.6m3.5-3.6 3.5 3.6m-7 0 1 4.8m6-4.8-1 4.8"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="4.6" r="2.8" fill="currentColor" />
      <circle cx="12" cy="11.5" r="2.1" fill="var(--color-accent)" />
      <circle cx="8.5" cy="15.1" r="1.75" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15.5" cy="15.1" r="1.75" fill="currentColor" />
      <circle cx="9.5" cy="19.9" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="19.9" r="1.5" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <LogoMark className="h-[24px] w-[24px]" />
      <span className="font-serif text-[1.625rem] leading-none tracking-[-0.01em]">
        full<em className="italic">body</em>
      </span>
    </span>
  );
}
