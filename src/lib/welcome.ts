export const WELCOME_KEY = "rahisi.welcomed";
export const WELCOME_SLIDES = 3;

/** True once this phone has seen the welcome screens (or skipped them). */
export function hasWelcomed(): boolean {
  try { return localStorage.getItem(WELCOME_KEY) === "1"; } catch { return false; }
}

export function markWelcomed(): void {
  try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore: they will just see it again */ }
}

/** Next/previous slide, never leaving 0..last. */
export function stepSlide(index: number, delta: 1 | -1, total = WELCOME_SLIDES): number {
  return Math.min(total - 1, Math.max(0, index + delta));
}
