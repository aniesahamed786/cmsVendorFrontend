# Skeleton loading

The loading affordance for anything whose **layout depends on the data**. Sibling doc to
[number_animation.md](./number_animation.md) — that one covers the other half of the
choice (see *Which one* below).

## Which one

| Situation | Use |
|---|---|
| A number lands in a fixed-size slot (KPI, stat tile, counter) | count-up, [number_animation.md](./number_animation.md) |
| Layout would jump: lists, tables, cards, forms, charts, avatars, hero blocks | skeleton (this doc) |
| Action buttons that only exist once data loads | skeleton, one block per button |
| A whole page | skeleton **mirroring the real layout**, never a spinner |

Never both on the same element. Never a centered spinner on a page that has a known shape.

## The state today (what a refactor replaces)

Three dialects exist in this repo. They all render the same grey pulse:

- `p-skeleton` + PrimeNG (`branches-page.html`)
- hand-rolled `.skeleton-title` / `.skeleton-btn` + a local `.animate-pulse` and a local
  `@keyframes pulse` (`offer-details.scss`)
- `.offer-form__skeleton*` + a local `@keyframes offerFormPulse` (`offer-form.css`)

Pick **one** per feature you touch — the `.app-skeleton` recipe below — and delete the
local keyframes you replaced. Don't leave two dialects inside one component.

## The recipe

One global class carries the fill + the pulse. The call site only sets the size, because
size is the only thing that actually differs between a title block and an avatar block.

**Already global in `src/styles.scss`** — `.app-skeleton` (fill + pulse) and
`.app-skeleton--on-primary` (for blocks sitting on a primary/gradient surface). Don't
redefine them, don't add another `@keyframes`.

**Per component**, size it with a BEM class in the component's own `.scss`:

```html
@if (isLoading()) {
  <div class="branches__skeleton">
    <div class="app-skeleton branches__skeleton-title"></div>
    <div class="app-skeleton branches__skeleton-row"></div>
    <div class="app-skeleton branches__skeleton-row"></div>
  </div>
} @else {
  <!-- the real thing -->
}
```

```scss
.branches {
  &__skeleton { display: flex; flex-direction: column; gap: 0.75rem; }
  &__skeleton-title { width: 16rem; height: 2.5rem; }
  &__skeleton-row   { width: 100%;  height: 3rem; }
}
```

## Rules

- **Mirror the real layout.** Same container, same grid, same gaps, same block count as the
  loaded state — the skeleton lives *inside* the same card/section class so nothing shifts
  when data arrives. A skeleton that changes the page height is a worse spinner.
- **Square corners**, like everything else. Circles are the one exception (avatars only).
- **No hard-coded greys.** The fill comes from `--app-border`; a skeleton that stays light
  grey in dark mode is a bug. The only literal is `#fff` in the `--on-primary` variant.
- **Size in SCSS, never in the template.** No `style="width: 16rem"`, no `w-64`. Same rule
  as the rest of [REFACTOR.md](./REFACTOR.md) — the template carries classes, nothing else.
- **Match the count, roughly.** 3–5 placeholder rows for a list is enough; don't loop 50.
- **One flag drives it.** An `isLoading()` signal with `@if / @else`, not per-field flags.
- **Don't skeleton a count-up card** — the animation from 0 is already the affordance.

## Using `p-skeleton` instead

Fine where it's already in place; it needs `border-radius: 0` forced, which is why
`offer-form.css` carries a `::ng-deep .p-skeleton { border-radius: 0 !important; }` block.
For new work prefer `.app-skeleton` — a div with two classes beats importing a component
and then fighting its radius.

## Checklist

1. Loading state is a skeleton (layout-dependent) or count-up (a number), not both, not a spinner?
2. Uses `.app-skeleton`; local `@keyframes pulse` copies deleted?
3. Sizes live in the component `.scss`, template has classes only?
4. Fill flips in dark mode (no hard-coded grey)?
5. No layout shift when the real data lands?
