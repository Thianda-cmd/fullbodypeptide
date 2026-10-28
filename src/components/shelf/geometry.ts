/** Share of a spine's width taken by its artwork panel. */
export const artWidthFraction = (w: number) => Math.max(0.3, Math.min(0.56, (w - 200) / w));
