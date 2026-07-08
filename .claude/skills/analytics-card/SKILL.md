---
name: analytics-card
description: The analytics dashboard card pattern in this CMS vendor app — KPI/stat cards, card grids and gaps, skeleton loaders, count-up number animation, icon and title color rules. Use whenever adding or changing cards on the analytics pages (overview/offer/vendor/user analytics) or building a new dashboard card, KPI row, breakdown card, or stat tile.
---

# Analytics card pattern

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

Reference implementation: `src/app/features/analytics/` — shared base styles in
`analytics/style.scss`, live pages `vendor-analytics`, `offer-analytics`, `user-analytics`.
Styling values come from the [style skill](../style/SKILL.md); this file is the card
*structure* conventions.

## Card anatomy

```html
<article class="overview-kpi-card">
  <div class="overview-kpi-icon">
    <i [class]="k.icon + ' text-lg'" [style.color]="'var(--app-primary)'"></i>
  </div>
  <p class="overview-kpi-label">{{ k.label }}</p>
  <p class="overview-kpi-value">{{ animatedCount(k.id) }}</p>
</article>
```

Base classes already exist in `analytics/style.scss` — reuse, don't redefine:
`.insight-card` (generic card), `.overview-kpi-card` (stat tile), `.insight-card-header`
+ `.insight-card-title`, `.overview-kpi-label/-value/-subtext`, shadow + hover-lift built in.

## Color rules (repeated user corrections — treat as law)

- **Icons: `var(--app-primary)`.** The one exception is *Expiring Soon*, which is red.
- **Card titles (`h3`/`.insight-card-title`): `var(--app-text)`** — full text color, not muted.
- Labels/subtext: `var(--app-muted)`.
- Breakdown bars: shades of the primary (via `rgba(var(--app-primary-rgb), …)` steps or
  `color-mix`), **not** a rainbow of distinct colors — unless the card maps offer *statuses*,
  which reuse the status colors from the offer page.
- Cards sit on `var(--app-surface)` with the shared `--ui-shadow`; nested mini-cards (e.g.
  offers inside "Top Offers by Category") use the same surface + their own shadow.

## Layout & gaps

- Page root is a flex column with `gap: 1.5rem`; card grids use `gap: 1.5rem` too.
  **The vertical gap between stacked grid rows must equal the horizontal gap** — if two
  grids stack, wrap them in a parent with the same `gap` instead of margins (see
  `.offer-kpi-stack` in offer-analytics).
- Grids: `repeat(N, minmax(0, 1fr))` (the `minmax(0,…)` prevents overflow), collapsing to
  2 columns ≤1400px and 1 column ≤900px, matching `analytics/style.scss` media queries.
- Prefer the existing row classes (`.insight-row-two-column`, `.insight-card-full`,
  `.insight-card-wide`) over new grid definitions.

## Loading: skeleton vs count-up

Two sanctioned patterns — pick one per card, don't stack both:

1. **Count-up numbers** (plain stat cards): render immediately at 0 and animate to the
   fetched value — full recipe in [`../style/number_animation.md`](../style/number_animation.md).
2. **Skeleton loader** (cards whose *layout* depends on data: lists, donuts, tables):
   PrimeNG `p-skeleton` mirroring the real card's shape inside the same card class so the
   grid doesn't jump:

```html
@if (loading()) {
<article class="overview-kpi-card">
  <p-skeleton shape="circle" size="2.75rem" />
  <p-skeleton width="7rem" height="0.9rem" styleClass="skel-mt" />
  <p-skeleton width="10rem" height="1.9rem" styleClass="skel-mt" />
</article>
} @else { … }
```

Spacing helpers `.skel-mt` / `.skel-mt-lg` / `.skel-right` live in `offer-analytics.css` —
copy that block if the page doesn't have it. Repeated shapes (donut + legend) go in an
`<ng-template #donutSkeleton>` reused across cards.

## Checklist for a new card

1. Reused an existing card class from `analytics/style.scss`?
2. Icon primary (or red only for expiring-soon)? Title `--app-text`?
3. Gap identical to the neighbors, vertically and horizontally?
4. Loading state chosen (count-up *or* skeleton) and it doesn't shift layout?
5. Dark mode checked?
