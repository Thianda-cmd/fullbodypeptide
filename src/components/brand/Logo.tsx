/** Full Body wordmark: a peptide chain folded into a figure, plus the name. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="4" r="2.6" fill="currentColor" />
      <path
        d="M11 8.4c-3.6 1.5-3.6 3.6 0 5.1s3.6 3.6 0 5.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="11" cy="8.4" r="1.25" fill="currentColor" />
      <circle cx="11" cy="13.5" r="1.25" fill="var(--color-accent)" />
      <circle cx="11" cy="18.6" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <LogoMark className="h-[22px] w-[22px]" />
      <span className="text-[1.0625rem] leading-none font-semibold tracking-[-0.045em]">fullbody</span>
    </span>
  );
}
