type P = { className?: string };

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const SearchIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const Close = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ArrowLeft = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowUpRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const Rotate = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 12a9 4 0 0 0 18 0" />
    <path d="M21 12a9 4 0 0 0-14.5-3.2" />
    <path d="M8 6 6.4 8.9 9.5 9.6" />
  </svg>
);

export const Share = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 15V3M8 7l4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
