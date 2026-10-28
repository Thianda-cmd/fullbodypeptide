// Scroll progress (0..1) shown as the line under the header: the shelf on the
// home view, the page on a detail view.

const listeners = new Set<(v: number) => void>();
let value = 0;

export function setProgress(v: number) {
  const next = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  if (Math.abs(next - value) < 5e-4) return;
  value = next;
  listeners.forEach((l) => l(value));
}

export function onProgress(l: (v: number) => void) {
  listeners.add(l);
  l(value);
  return () => void listeners.delete(l);
}
