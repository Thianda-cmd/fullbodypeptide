const RAYS = [1, 0.5, 0.72, 1, 0.55, 0.82, 0.5, 0.95, 0.62, 0.5, 0.85, 0.58, 0.75, 1, 0.55, 0.72, 0.58, 0.9, 0.5, 0.8];

/** A sunburst of uneven rays, like a cell under a microscope. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`spin-slow ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {RAYS.map((len, i) => {
        const a = (i / RAYS.length) * Math.PI * 2;
        const r0 = 11 - 6.2 * len;
        return (
          <line
            key={i}
            x1={(12 + r0 * Math.sin(a)).toFixed(3)}
            y1={(12 - r0 * Math.cos(a)).toFixed(3)}
            x2={(12 + 11 * Math.sin(a)).toFixed(3)}
            y2={(12 - 11 * Math.cos(a)).toFixed(3)}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
