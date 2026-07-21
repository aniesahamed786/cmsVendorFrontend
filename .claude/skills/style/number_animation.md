# Count-up number animation (analytics stat cards)

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

> **Local status.** Two real implementations: `offers.ts` (`offer-list`) and `branches-page.ts`.
> Either is a fair reference — they are the same ~25 lines, which is itself a sign the helper
> wants extracting into something shared once a third page needs it.
>
> Both add one rule this doc originally lacked: **`animateTo` honours
> `prefers-reduced-motion`** by setting the target directly instead of running the rAF loop.
> Keep that in any copy — it is an accessibility basic, not an optimisation.
>
> Historical note, in case you find it referenced elsewhere: `branches-page.animatedCount()`
> used to be `val.toLocaleString()` with a `'...'` fallback — a formatter wearing the recipe's
> name, no animation at all. Don't assume a page has count-up just because it calls something
> `animatedCount`; check for the rAF loop.

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
- **The exception: when the whole card is waiting, not just the number.** A card whose icon,
  label and hint are static can render at 0 and tick up — nothing else is missing. A card
  where the *entire* contents are gated behind a fetch has nothing to render at 0, so it
  skeletons first and counts up on arrival. These are **sequential, not simultaneous**: the
  skeleton covers the absence, the count-up covers the arrival, and they never animate the
  same element at the same time. That is what `offer-list` does — `@if (loading())` renders
  skeleton cards, `@else` renders real cards whose numbers `animateTo` their targets, kicked
  off in the same callback that flips the flag. This is compatible with SKELETON.md's "never
  both on the same element"; read it as "never both at once".
- Values arriving at different times is fine — each `animateTo` is independent, and
  re-calling it animates from the *current* shown value, not from 0.
- Derived displays (breakdown-bar widths, percentages) should read the same `animated()`
  map so bars grow in sync with their numbers — see `segmentWidthPct` in
  `vendor-analytics.ts`.
- Format only in `animatedCount` (`toLocaleString('en-US')`); keep the map raw numbers.
- Suffixed values ("1.2k", "SAR 3,400"): animate the raw number, wrap the suffix in the
  template, not the map.
