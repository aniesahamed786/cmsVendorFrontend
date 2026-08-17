import { signal } from '@angular/core';

/**
 * Count-up number animation (`.claude/skills/style/number_animation.md`).
 *
 * One signal holds every animated value, keyed by stat name; one rAF loop per key
 * eases to the target. Was duplicated verbatim in four pages — call this once per
 * component instead:
 *
 * ```ts
 * private readonly countUp = createCountUp();
 * readonly animatedCount = this.countUp.animatedCount;   // template calls this
 * private readonly animateTo = this.countUp.animateTo;   // call when data lands
 * ```
 *
 * Declare `countUp` above the two delegates — field initializers run in order.
 */
export function createCountUp(locale = 'en-US') {
  const animated = signal<Record<string, number>>({});

  /** Animated, formatted value for a stat key (0 until `animateTo` fires). */
  const animatedCount = (key: string): string =>
    (animated()[key] ?? 0).toLocaleString(locale);

  /** easeOutCubic count-up from the current value to target. */
  const animateTo = (key: string, target: number, duration = 900): void => {
    // Accessibility: honour reduced motion by landing on the value directly.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      animated.update((m) => ({ ...m, [key]: target }));
      return;
    }
    const from = animated()[key] ?? 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      animated.update((m) => ({ ...m, [key]: Math.round(from + (target - from) * eased) }));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  return { animatedCount, animateTo };
}
