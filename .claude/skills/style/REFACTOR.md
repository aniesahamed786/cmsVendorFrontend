# Refactor process — migrating an existing page to this style

This is the **migration playbook**, kept separate from `SKILL.md` on purpose:

- `SKILL.md` = the styling **rules** — use it when building new pages/components.
- `REFACTOR.md` (this file) = the **process** for converting an *existing* page to the
  token system. Only needed when refactoring; ignore it for greenfield pages.
- Supporting docs, referenced from the steps below:
  [SKELETON.md](./SKELETON.md) (loading states),
  [number_animation.md](./number_animation.md) (count-up numbers),
  [button skill](../button/SKILL.md), [page-chrome skill](../page-chrome/SKILL.md),
  [scss-refactor skill](../scss-refactor/SKILL.md) (the mechanical de-Tailwind steps).

Assumes **Angular + PrimeNG + `@primeuix/themes` + SCSS**.

---

## The target: a template that carries no styling at all

The end state is a template made of **semantic BEM classes and nothing else**. Reference:
`messaging-center-ticket-details.html` — every element is `mc-details__something`, all the
rules live in `messaging-center-ticket-details.scss`.

```html
<!-- before: styling smeared across the template -->
<div class="flex items-center gap-3 p-4 bg-white border border-gray-200"
     style="margin-bottom: 12px">
  <span class="text-sm text-gray-500">{{ t.reference }}</span>
</div>

<!-- after -->
<div class="mc-details__header-top">
  <span class="mc-details__header-ref">{{ t.reference }}</span>
</div>
```

Nothing about appearance may live in the HTML:

- **No Tailwind/utility classes** — `flex`, `p-4`, `bg-white`, `text-gray-500`, `gap-3`,
  `mb-6`, `rounded`, `shadow`. All of it becomes SCSS.
- **No `style="…"` attributes** and no `[style.x]` bindings for static values. A binding
  is only allowed when the value is genuinely dynamic and cannot be a class (e.g. a
  computed mask-image URL, a percentage bar width) — and even then the rest of the
  element's look stays in SCSS.
- **No `[ngStyle]`**, no inline `<style>` blocks.
- **Structural classes are fine** when they *are* the semantic name (`mc-details__meta`),
  not when they're a utility pile.
- **Class names are BEM**: `block__element--modifier`, block = the component.

Conditional appearance uses class bindings against BEM modifiers, not inline style:

```html
<div class="mc-details__message"
     [class.mc-details__message--outgoing]="msg.outgoing"
     [class.mc-details__message--note]="msg.isInternalNote">
```

---

## Scope rules (learned the hard way)

1. **Only touch the folder you were given.** A feature refactor does not wander into other
   features.
2. **Global files are off-limits with three exceptions**, and each one gets called out in
   your summary rather than done silently:
   - a **token value** in `:root` is wrong for the whole app (fix the token, not the page);
   - `.app-skeleton` / a global recipe this file prescribes is missing;
   - a PrimeNG overlay uses `appendTo="body"`, so its panel class **cannot** live in the
     component's scoped styles and must be global.
   Never touch `accent-themes.ts` or `theme.service.ts` during a feature refactor.
3. **Ambiguous color → ask, don't guess.** If a hex doesn't map cleanly to a token (is
   `#7c3aed` "brand" or a deliberate purple?), list it and ask before converting. Same for
   anything that looks like an intentional one-off.
4. **Colors hide in the `.ts` too** — `[style.color]` bindings, chart configs, and data
   arrays with per-item hex (category metadata is the usual offender). Grep the `.ts`.
5. **Removing the utilities from the template is the fix, not a side quest.** Tailwind
   classes in the HTML override your component stylesheet, so a page where you wrote
   perfect SCSS but left `bg-white` in the markup still renders white in dark mode.
6. Report every hex you deliberately kept, one line each.

---

## Step 0 — Engine first

Nothing below works until these exist, because every `var(--app-*)` resolves against them:

1. `src/styles.scss` — the `:root` tokens, `.dark-mode` overrides, the global PrimeNG
   normalization, **and the global field/filter/label rules** (see Step 3).
2. `src/app/shared/theme/accent-themes.ts` — the `ACCENT_THEMES` catalog.
3. `src/app/shared/services/theme.service.ts` — the runtime applier.

Verify before touching components: toggle dark mode and switch an accent — the chrome
should already respond. If it doesn't, fix the engine first.

---

## Step 1 — Inventory what you're removing

```bash
# hard-coded hex colors
grep -rEn '#[0-9a-fA-F]{3,8}' src/app --include=*.html --include=*.scss --include=*.css

# tailwind color utilities
grep -rEn '\b(bg|text|border)-(white|black|gray|slate|zinc|neutral)-[0-9]{2,3}\b' src/app --include=*.html

# any utility pile / arbitrary values in templates
grep -rEn '\b(flex|grid|p|px|py|m|mb|mt|gap|w|h)-[0-9a-z\[]' src/app --include=*.html

# styling that leaked into the template
grep -rn 'style="' src/app --include=*.html
grep -rn '\[ngStyle\]\|\[style\.' src/app --include=*.html

# colors hiding in TypeScript (bindings, chart configs, per-item metadata)
grep -rEn '#[0-9a-fA-F]{3,8}|rgba?\(' src/app --include=*.ts

# corners and shadows (both get removed)
grep -rEn 'rounded|border-radius|shadow' src/app --include=*.html --include=*.scss

# per-page copies of things that are now global or shared
grep -rEn '__(back|cancel|submit|btn)[-a-z]*\s*\{' src/app --include=*.scss --include=*.css
grep -rEn '\.p-(select|multiselect|listbox|inputtext|paginator|datatable)' src/app --include=*.scss --include=*.css
grep -rEn '@keyframes\s+\w*[Pp]ulse' src/app --include=*.scss --include=*.css
```

The last three sweeps matter most: they find code whose correct fix is **delete**, not
rewrite. Group the rest by component and by the *role* each color plays (background /
surface / text / muted / border / primary) — roles drive Step 2, not raw hexes.

---

## Step 2 — Map hexes → tokens

Translate by **role**, using the default (blue) values as the recognition key.

| Source (typical) | Role | Token |
|------------------|------|-------|
| `#F6F6F8`, page greys | page background | `var(--app-bg)` |
| `#ffffff`, `bg-white` | raised surface (card/dialog/table) | `var(--app-surface)` |
| `#111827`, `text-gray-900`, `text-black` | primary text | `var(--app-text)` |
| `#6b7280`, `#94A3B8`, `text-gray-500/600` | secondary text | `var(--app-muted)` |
| `#e5e7eb`, `border-gray-200` | border / divider | `var(--app-border)` |
| `#0033A0`, `#003CC7`, `#0537A4` | brand / primary | `var(--app-primary)` |
| `#002C8A`, `#03297d` | primary hover/darker | `var(--app-primary-700)` |
| `rgba(0,51,160,0.08)`, `#EEF2FF` | soft brand fill / selected | `var(--app-primary-soft)` |
| `rgba(0,51,160,0.13)` | subtle brand fill | `var(--app-primary-subtle)` |
| `rgba(0,51,160,0.16)` | focus ring | `var(--app-primary-ring)` |
| input fill (off-white) | field background | `var(--field-bg)` |
| subtle hover (off-surface) | option/row hover | `var(--field-bg-hover)` |
| brand gradient | hero / banner | `var(--app-primary-gradient)` |

**Zero hard-coded colors survive.** Two exceptions only:

- `#fff` / `#000` as on-primary contrast (text or an icon sitting on a filled brand button).
- validation red `#dc2626`.

Fallbacks count as hard-coded: write `var(--app-primary)`, **not**
`var(--app-primary, #0033a0)`. The token is always defined; the fallback is just a stale
hex waiting to be wrong after an accent switch.

---

## Step 3 — Delete before you write

Most of a legacy component's CSS shouldn't be rewritten — it should be **deleted**,
because something global or shared already does the job.

### Fields, filters, search, lists, multiselect → already global

`src/styles.scss` already styles every control: `.p-inputtext`, `.p-textarea`, `.p-select`,
`.p-multiselect`, `.p-listbox`, `.p-datepicker`, `.app-search`, their overlay panels,
their options, their chips, hover/focus/disabled states, and the `.app-filters-row` /
`.app-filter-group` / `.app-filter-label` toolbar layout.

**Do not restyle any of that per page.** Delete the local copies. A component that wants a
filter row writes markup only:

```html
<div class="app-filters-row">
  <div class="app-filter-group">
    <label class="app-filter-label">{{ 'x.status' | translate }}</label>
    <p-select [options]="statuses" ... />
  </div>
  <div class="app-search">
    <i class="pi pi-search"></i>
    <input [(ngModel)]="query" [placeholder]="'common.search' | translate" />
  </div>
</div>
```

If a field genuinely looks wrong everywhere, fix the **token** in `:root`
(`--field-bg`, `--field-height`, `--field-padding-x`, …), not one component's SCSS. Local
`::ng-deep .p-select { … }` blocks are the thing this step removes.

Same for labels: any class matching `__label` is already styled globally — no per-page
font-size/weight/color rules.

### Buttons → the shared components

Never hand-roll `<button class="page__btn">` plus CSS again. Three components cover it —
see the [button skill](../button/SKILL.md):

```html
<app-button (click)="save()">{{ 'x.save' | translate }}</app-button>
<app-button variant="outline" [icon]="'pi pi-pencil'" (click)="edit()">…</app-button>

<!-- back: ghost variant + left arrow, RTL-flipped automatically -->
<app-back-button label="offerForm.backToOffers" (click)="goBack()" />

<!-- cancel: outline variant -->
<app-cancel-button (click)="onCancel()" />
<app-cancel-button label="offerForm.cropper.cancel" (click)="cancelCrop()" />
```

- `label` on both is an **i18n key**, so each page names its own destination/action
  ("Back to Offers", "Back to Profile", "Discard"). Omit it for the defaults
  `common.back` / `common.cancel`.
- Click is the **native DOM event** — `(click)="…"`, no `@Output`.
- Delete the component's `__back-btn`, `__cancel-button`, `__btn--submit` rules and any
  `pButton` / `p-button` styling that was only replicating these looks.
- Need a new look? Add a variant to `button.css`, not a one-off override at the call site.

### Loading states → the shared recipes

- Layout that would jump (lists, tables, cards, forms, hero blocks) → skeleton,
  [SKELETON.md](./SKELETON.md). Delete local `@keyframes pulse` copies while you're there.
- A number in a fixed slot (KPI, stat tile) → count-up,
  [number_animation.md](./number_animation.md).
- Never a centered spinner on a page with a known shape, and never both on one element.

---

## Step 4 — Tables: one surface, top to bottom

A table is a single raised surface. The header strip, the rows, and the paginator strip
must all read as **the same `--app-surface`** — no grey header bar, no differently-shaded
footer.

```scss
.feature-table {
  background: var(--app-surface);
  border: 1px solid var(--app-border);

  :host ::ng-deep & {
    /* header and paginator sit ON the surface — they don't bring their own fill */
    .p-datatable-header,
    .p-datatable-thead > tr > th,
    .p-datatable-tbody > tr,
    .p-datatable-footer,
    .p-paginator {
      background: transparent;
      border: none;
      color: var(--app-text);
    }

    .p-datatable-thead > tr > th {
      color: var(--app-muted);      /* header text is muted, not a fill change */
      font-weight: 600;
      padding: 0.9rem 1rem;
    }

    .p-datatable-tbody > tr > td {
      border-block-end: 1px solid var(--app-border);   /* row separator only */
    }

    .p-datatable-tbody > tr:hover > td {
      background: var(--field-bg-hover);
    }
  }
}
```

Rules:

- `background: transparent` on `.p-datatable-header`, `thead th`, `.p-datatable-footer`
  and `.p-paginator` — the wrapper owns the one fill. This is what makes the top and the
  bottom match.
- Separation between rows comes from `--app-border` on the cell, never from an alternating
  fill and never from a shadow.
- The paginator's rows-per-page select is already handled globally — don't restyle it.
- Square corners, no shadow, no `border-radius` on the wrapper.

---

## Step 5 — Apply the rest of the rules

Follow `SKILL.md` per component, in order:

1. Backgrounds → `--app-surface` (raised) / `--app-bg` (page).
2. Text → `--app-text` / `--app-muted`.
3. Borders → `--app-border`.
4. Brand (links, active, selected) → `--app-primary*`.
5. **Remove every `border-radius`** unless explicitly justified (phone bezel, avatar).
6. **Remove `box-shadow`** except the sanctioned focus ring.
7. Pop-ups → the `p-dialog` recipe; force `.p-dialog*` square via `::ng-deep`.
8. RTL → logical properties (`margin-inline-start`, `padding-inline`, `text-align: end`),
   never `left`/`right`. Page direction comes from `html[lang="ar"]` in `styles.scss`;
   templates never hand-write `dir` for page direction.

Two mechanics worth knowing:

- **PrimeNG controls** that still need a hook take `styleClass="<root>__field"` and
  `panelStyleClass="<root>__panel"`. A panel class only works from the component's scoped
  styles when the overlay is *not* `appendTo="body"` — if it is, the rule must be global
  (scope rule 2, flag it).
- **Component-scoped token aliases** are fine: alias once on the page root
  (`--ui-x: var(--app-x)`) and use the alias below it. Aliasing is not the same as
  hard-coding.

### The escape hatch (use it rarely)

For a huge legacy screen you're mirroring, a **scoped token bridge** — keep the markup, add
a root class, re-map the old utilities → tokens under that root — is allowed as an interim
step. It leaves utilities in the template, so it is not the target state. Small or owned
components always get the full rewrite.

---

## Step 6 — Verify (the matrix)

Per refactored screen:

- **`npm run build` passes** — read its output even though the PostToolUse hook runs it.
- **Light mode** — no leftover hard greys.
- **Dark mode** — surfaces/text/borders flip; nothing stays white.
- **National-day mode** — chrome still legible over the bg art.
- **Accent switch** — blue → purple; all brand color follows, no fixed blue left.
- **RTL** — Arabic page: direction, logical spacing, and the back arrow all flip.
- **Corners** — nothing rounded.
- **Focus** — fields show the border-color focus; radios/checkboxes show the ring.
- **Table** — header, rows and paginator are visibly one surface.
- **Loading** — skeleton mirrors the loaded layout; no shift when data lands.

Re-run the Step 1 sweeps over the touched files — they should come back empty except the
allowed `#fff`/`#000` contrast and validation red.

---

## Quick checklist

1. Engine in place; dark + accent already respond.
2. Template has **only** BEM classes — no utilities, no `style=`, no `[ngStyle]`.
3. Every color is a token; no fallback hexes in `var()`.
4. Local field/filter/search/select/multiselect/label CSS **deleted** (global covers it).
5. Buttons are `<app-button>` / `<app-back-button>` / `<app-cancel-button>`; per-page
   button CSS deleted; labels are i18n keys.
6. Table header + rows + paginator share one `--app-surface`.
7. Loading is [skeleton](./SKELETON.md) or [count-up](./number_animation.md), not a spinner.
8. Square corners, no shadows, logical properties for RTL.
9. Verified across light / dark / national-day / accent-switch / RTL.
10. Re-grep clean.
