# Count-up number animation (analytics stat cards)

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

The house pattern for animating a stat from 0 (or its previous value) up to a fetched
number. Live reference: `vendor-analytics.ts` (`animated` / `animateTo` / `animatedCount`),
also used in `user-analytics` and `offer-analytics`.

## The recipe

One signal holds every animated value, keyed by a string; one rAF loop per key eases to
the target with easeOutCubic over ~900 ms.

```ts
// Count-up animation: cards render immediately at 0 and tick up to each value as it's fetched.
private readonly animated = signal<Record<string, number>>({});

/** Animated, formatted value for a card key (starts at 0, animates to target). */
animatedCount(key: string): string {
  return (this.animated()[key] ?? 0).toLocaleString('en-US');
}

/** easeOutCubic count-up from the current value to target. */
private animateTo(key: string, target: number, duration = 900): void {
  const from = this.animated()[key] ?? 0;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    this.animated.update((m) => ({ ...m, [key]: Math.round(from + (target - from) * eased) }));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

Template:

```html
<p class="overview-kpi-value">{{ animatedCount('totalVendors') }}</p>
```

Kick off in the data callback, one call per stat:

```ts
this.analyticsData.getVendorStats().subscribe((stats) => {
  this.animateTo('totalVendors', stats.total);
  this.animateTo('activeVendors', stats.active);
});
```

## Rules

- **Cards render at 0 immediately** — don't gate the card behind a loading flag when
  using count-up; the animation *is* the loading affordance. (Skeletons are for layouts
  that would jump, see the analytics-card skill.)
- Values arriving at different times is fine — each `animateTo` is independent, and
  re-calling it animates from the *current* shown value, not from 0.
- Derived displays (breakdown-bar widths, percentages) should read the same `animated()`
  map so bars grow in sync with their numbers — see `segmentWidthPct` in
  `vendor-analytics.ts`.
- Format only in `animatedCount` (`toLocaleString('en-US')`); keep the map raw numbers.
- Suffixed values ("1.2k", "SAR 3,400"): animate the raw number, wrap the suffix in the
  template, not the map.
