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

- `p-skeleton` + PrimeNG (`branches-page.html`, KPI cards only — the same file's performers
  and table skeletons are `.app-skeleton`; see *When the component already has the other
  dialect* below)
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
- **Reuse the real row, don't rebuild it.** Where the loaded state has a repeating row that
  already owns its border, padding and gap, put the `.app-skeleton` blocks *inside that same
  row class* rather than writing a parallel skeleton row. Then the only thing you size is the
  blocks, the row geometry is shared by construction, and it can't drift when the row changes:

  ```html
  <div class="branches-page__performer-row">          <!-- the real row class -->
    <div class="branches-page__performer-info">
      <div class="app-skeleton branches-page__skeleton-avatar"></div>
      <div class="app-skeleton branches-page__skeleton-name"></div>
    </div>
  </div>
  ```

  Check which element governs the row's height before sizing (here a 2rem icon, not the text)
  — match that one and the rest can't shift the layout.

### Tables: skeleton the cells, not the table

A table is the case where "mirror the real layout" is most often done wrong. **Do not replace
the table with a stack of full-width bars.** Three things are wrong with that: the column
header labels vanish (they are static text — they were never loading), the bars don't line up
with the columns that are about to appear, and a bar spanning a whole row reads as one object
where five cells belong.

Keep the table rendering and feed it placeholder rows instead. **`p-table` has a slot for
exactly this** — use it rather than branching inside the body template:

```ts
// while loading, N *falsy* rows — see why below
readonly tableRows = computed(() =>
  this.loading() ? new Array(5).fill(null) : this.filteredRows()
);
```

```html
<p-table [value]="tableRows()" [paginator]="!loading()" ...>
  <ng-template pTemplate="header"> <!-- unchanged: labels are not data --> </ng-template>

  <ng-template pTemplate="body" let-row>
    <tr> ...the real cells... </tr>
  </ng-template>

  <ng-template pTemplate="loadingbody">
    <tr class="x__row--skeleton">
      <td><span class="app-skeleton x__skeleton-cell x__skeleton-cell--name"></span></td>
      <td><span class="app-skeleton x__skeleton-cell x__skeleton-cell--num"></span></td>
      ...one block per column...
    </tr>
  </ng-template>
</p-table>
```

**Why the rows must be falsy, and why an `@if` in the body template silently renders nothing.**
PrimeNG's `TableBody` picks the template per row with

```
rowData ? bodyTemplate : loadingBodyTemplate
```

(`primeng/fesm2022/primeng-table.mjs`, the `*ngTemplateOutlet` inside its `ngFor`). So a falsy
entry in `[value]` is *the* trigger for the loading row — that is the designed contract, not a
hack. Two consequences:

- `@if (loading()) { … } @else { … }` inside `pTemplate="body"` **never runs** for those rows.
  The body template isn't instantiated at all, and with no `loadingbody` defined the outlet
  gets `undefined` and renders nothing — an empty table body with no error. If your table
  skeleton "just doesn't appear", this is why.
- The placeholder entries must be falsy (`null`/`undefined`). An array of `{}` or of indices
  starting at 1 is truthy and will render the *real* body row against missing data.

- **Header stays real.** Column labels, sort icons, the toolbar and filters above it are all
  static — they have nothing to wait for.
- **3–5 rows.** Enough to read as a list, not so many it looks loaded.
- **One block per cell**, each one text-line tall, with a **different width per column** — a
  name is wider than a count. Equal-width blocks in every column read as a placeholder grid,
  not as content. Keep every width comfortably under its column's real width.
- **Turn the paginator off while loading** (`[paginator]="!loading()"`) — page numbers for
  placeholder rows are noise, and the count is wrong anyway.
- **Suppress the row hover.** With the four-part hover from [REFACTOR.md](./REFACTOR.md) Step 4
  in place, a placeholder row will otherwise lift, grow an accent bar and tint under the
  mouse. Kill all three on the `--skeleton` row.

The catch that applies to any reused row: reusing it also inherits its **interactive** state. A row with a `:hover`
  fill, a pointer cursor or a focus ring will do all of that while it's still a placeholder.
  Add a `--skeleton` modifier that switches those off — it's the one thing the skeleton must
  *not* mirror.
- **Rounded corners — skeletons are the exception to the app's square corners.** `.app-skeleton`
  carries `border-radius: 0.375rem` globally, on text bars and icon blocks alike, so
  placeholders read as soft unresolved shapes rather than as real content. **Do not strip this
  under [REFACTOR.md](./REFACTOR.md) Step 5 rule 5** — it is named there as a sanctioned
  exception. Two modifiers cover the shapes that aren't rectangles: `.app-skeleton--pill`
  (999px, for status chips and lozenges) and `.app-skeleton--circle` (avatars). Match whatever
  the real element becomes — a square block standing in for a pill is a shape that changes on
  load.
- **No hard-coded greys.** The fill comes from `--app-border`; a skeleton that stays light
  grey in dark mode is a bug. The only literal is `#fff` in the `--on-primary` variant.
- **Size in SCSS, never in the template.** No `style="width: 16rem"`, no `w-64`. Same rule
  as the rest of [REFACTOR.md](./REFACTOR.md) — the template carries classes, nothing else.
- **Match the count, roughly.** 3–5 placeholder rows for a list is enough; don't loop 50.
- **One flag drives it, and it is a real flag.** An explicit `signal(true)` flipped to `false`
  in the subscribe, with `@if / @else`. **Never infer loading from emptiness** — `arr().length
  === 0` is also the loaded-but-genuinely-empty state, so an empty result shows the skeleton
  forever and the table's `emptymessage` template never renders. One flag *per data source*:
  two independent requests that fill two cards need two flags, or the faster card waits on the
  slower one. `kpis()` being `null`-until-loaded is the same idea — a null object is a real
  flag, an empty array is not.
- **Don't skeleton a count-up card** — the animation from 0 is already the affordance.

## Using `p-skeleton` instead

Fine where it's already in place. For new work prefer `.app-skeleton` — a div with two classes
beats importing a component, and it gives you the `--pill` / `--circle` modifiers and the
token-driven fill for free.

`p-skeleton` brings its own radius, which no longer conflicts now that skeletons are rounded by
design. What it does *not* give you is the shared fill: its grey comes from the PrimeNG preset,
not from `--app-border`, so it will not track the mode the way `.app-skeleton` does. That, not
the corners, is the reason to prefer `.app-skeleton`.

### When the component already has the other dialect

The "one dialect per component" rule holds, but it is not worth a scope fight. If a component
already uses `p-skeleton` and converting it is out of scope for the task in front of you
(`STYLING_REFACTOR_PLAN.md` explicitly excludes the `branches-page` KPI skeletons, for
instance):

- add the **new** work as `.app-skeleton` — don't spread the rounded-corner bug,
- leave the existing `p-skeleton` blocks alone,
- and say so in the report, with the conversion as a named follow-up.

A temporary, flagged split beats either silently widening `p-skeleton` or quietly converting
code the task's scope put off limits. What is *not* acceptable is an unflagged split — the
next person then can't tell which dialect is the intended one.

## Faking the load on a page with no service yet

Some pages hold in-memory dummy data and render synchronously — `offer-list` is one. There is
no async gap, so the skeleton is unreachable and unreviewable. If you add one anyway, the fake
timer that makes it visible **must be impossible to miss later**, or it ships to production and
every visitor waits for nothing.

Convention: one grep-able marker, `DELETE WHEN THE API IS WIRED`, on the block *and* on each
throwaway line.

```ts
// ===========================================================================
// ARTIFICIAL LOADING — DELETE WHEN THE API IS WIRED
// ---------------------------------------------------------------------------
// `offers` is a synchronous in-memory array, so there is no real load to wait
// for. This timer fakes one purely so the skeleton state is reachable. When the
// real service lands: delete the setTimeout, flip `loading` in the service's
// subscribe (as branches-page.ts does), delete this block.
// Keep `loading`, `tableRows` and the skeleton markup — only the timer goes.
// ===========================================================================
readonly loading = signal(true);
private static readonly FAKE_LOAD_MS = 800; // DELETE WITH THE TIMER

constructor() {
  setTimeout(() => this.loading.set(false), Offers.FAKE_LOAD_MS); // DELETE WHEN THE API IS WIRED
}
```

Say explicitly which parts survive the swap. The skeleton markup, the sizes and the `loading`
signal are all real work that the service will reuse — only the timer and the hardcoded initial
`true` are throwaway. Without that line someone deletes the whole feature along with the timer.

`grep -rn "DELETE WHEN THE API IS WIRED" src/` should list every page still faking it.

## Checklist

1. Loading state is a skeleton (layout-dependent) or count-up (a number), not both, not a spinner?
1. Skeleton covers **only what's loading** — static labels, headers, toolbars and filters still render?
1. Blocks stand in for individual fields, not whole rows or whole cards?
2. Uses `.app-skeleton`; local `@keyframes pulse` copies deleted?
3. Sizes live in the component `.scss`, template has classes only?
4. Fill flips in dark mode (no hard-coded grey)?
5. No layout shift when the real data lands?
