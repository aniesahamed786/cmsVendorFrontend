---
name: style
description: How to style fields, backgrounds, surfaces, borders, text and PrimeNG overlays in this CMS admin app using SCSS with CSS variable design tokens, light/dark/national-day modes, and swappable accent themes. Corners stay square (no border-radius) unless explicitly justified. Use whenever adding or changing colors, backgrounds, inputs, buttons, tables, dialogs, or theme support.
---

# Styling guide (SCSS + design tokens + theming)

**Write styling in SCSS, not Tailwind utilities.** Put styles in the component's
`.scss` file (or `src/styles.scss` for global rules) using real selectors and the design
tokens below. Do not add Tailwind utility classes (`bg-*`, `text-*`, `border-*`, `flex`,
`p-4`, arbitrary `[var(...)]` utilities, etc.) to templates for styling — keep templates
to semantic class names and style those classes in SCSS.

This app themes everything through **CSS custom properties (design tokens)** defined on
`:root` in `src/styles.scss`. Colors are never hard-coded in components — they reference
tokens so that **light / dark / national-day** modes and **9 swappable accent themes** all
work automatically.

> **Building new pages?** This file (the styling rules) is all you need.
> **Converting an existing project to this style?** Follow the separate
> [`REFACTOR.md`](./REFACTOR.md) playbook (inventory → hex→token map → convert → verify),
> then come back here for the per-component rules.

Three moving parts:

1. `src/styles.scss` — declares the tokens, mode overrides, and global PrimeNG overrides.
2. `src/app/shared/theme/accent-themes.ts` — the accent theme catalog (palettes + bg colors).
3. `src/app/shared/services/theme.service.ts` — applies the chosen mode/accent at runtime by
   toggling classes on `<html>` and setting `--app-*` properties.

## The golden rules

1. **Style in SCSS, not Tailwind.** Give the element a semantic class
   (e.g. `class="offer-card"`) and write its rules in the component's `.scss` file. Avoid
   Tailwind utility classes for styling.
2. **Never hard-code a color.** Always reference a token. If you find yourself writing
   `#0033A0`, `white`, `#111827`, `#e5e7eb`, etc., use the matching token instead.
   Hard-coded colors break dark mode and accent switching.
3. **Corners stay square — no `border-radius`.** This is a deliberate design language: the
   whole app uses sharp `0` corners (inputs, selects, datepickers, overlays, options,
   paginators are all forced to `border-radius: 0` in `styles.scss`). Do **not** add
   `border-radius` / rounded utilities to new elements. Only round something when there is a
   real, stated justification (e.g. an avatar that must be circular, a status pill where the
   product explicitly calls for it) — and call out that justification in the code/PR.

## The token vocabulary

Surface / chrome tokens (these flip per mode):

| Token | Meaning | Use for |
|-------|---------|---------|
| `--app-bg` | page background | app shell, page backgrounds |
| `--app-surface` | raised surface | cards, dialogs, inputs, table cells, overlays |
| `--app-text` | primary text | headings, body, input text |
| `--app-muted` | secondary text | labels, placeholders, helper text, icons |
| `--app-border` | borders/dividers | input borders, card borders, table lines |

Accent / brand tokens (these flip per accent theme):

| Token | Meaning |
|-------|---------|
| `--app-primary` | the brand color (buttons, links, active states) |
| `--app-primary-50 … -950` | full tint/shade ramp |
| `--app-primary-700` | primary hover/darker state |
| `--app-primary-soft` | `rgba(primary, 0.08)` — selected-row / soft fills |
| `--app-primary-subtle` | `rgba(primary, 0.13)` |
| `--app-primary-hover-soft` | `rgba(primary, 0.06)` — hover fills |
| `--app-primary-ring` | `rgba(primary, 0.16)` — focus rings |
| `--app-primary-gradient` | brand gradient (heroes, banners) |
| `--app-primary-rgb` | raw `r, g, b` to build custom `rgba()` |

Other: `--font-family`, `--app-bg-art` / `--app-bg-size` / `--app-bg-position` /
`--app-bg-repeat` / `--app-bg-attachment` (background image layers for themed modes),
`--app-scrollbar-thumb` / `--app-scrollbar-thumb-hover`.

## How to apply tokens (in SCSS)

Give the element a semantic class in the template, then style that class in the component's
`.scss` file using `var(--app-*)`. Nest with `&` for variants/states, mirroring the existing
files (e.g. `vendor-preview.scss`, `highlight-preview.scss`).

```html
<!-- template: semantic classes only, no utility/styling classes -->
<article class="offer-card">
  <h2 class="offer-card__title">{{ title }}</h2>
  <span class="offer-card__hint">{{ subtitle }}</span>
  <a class="offer-card__link" href="…">View</a>
  <button class="offer-card__cta">Save</button>
</article>
```

```scss
// component .scss
.offer-card {
  background: var(--app-surface);
  color: var(--app-text);
  border: 1px solid var(--app-border);

  &__title { color: var(--app-text); }
  &__hint  { color: var(--app-muted); }

  &__link {
    color: var(--app-primary);
    &:hover { color: var(--app-primary-700); }
  }

  &__cta {
    background: var(--app-primary);
    color: #fff;
    border: 1px solid var(--app-primary);
    &:hover {
      background: var(--app-primary-700);
      border-color: var(--app-primary-700);
    }
  }

  &.is-selected { background: var(--app-primary-soft); }
}
```

Use `color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%)` for subtle
hover/active states that must stay correct in both light and dark — that's the pattern used
throughout `styles.scss` for option hovers.

`#fff` (and `#000`) are acceptable as on-primary contrast colors — that matches how the
codebase handles button text on a primary fill. Everything else goes through a token.

## Fields / inputs (PrimeNG)

`src/app/shared/Components/offer-form/` is the **canonical, exhaustive** reference for field
styling — copy its patterns. The whole form is wrapped in one root class (`.offer-form`) and
every field rule is scoped under it, so the styling never leaks to other components.

### Global baseline (already in `styles.scss`)

- All `.p-inputtext`, `.p-select`, `.p-multiselect`, `.p-datepicker`, `.p-dropdown` have
  `box-shadow: none` and **square corners** (`border-radius: 0` on selects, dropdowns,
  datepickers, options, paginator selects). Keep new fields square.
- In dark mode they inherit `--app-surface` / `--app-text` / `--app-border`.

### The house field recipe (the values to reuse verbatim)

| Aspect | Value |
|--------|-------|
| Field fill | `color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%)` (slightly off-surface) |
| Border (rest) | `1px solid var(--app-border)` |
| Border (focus) | `var(--app-primary)` — **no** glow/shadow/outline |
| Text | `var(--app-text)` |
| Placeholder | `var(--app-muted)`, `opacity: 1` |
| Min height | `2.75rem` for select/multiselect/autocomplete |
| Dropdown icon / chevrons | `var(--app-muted)` (set `color` **and** `fill`) |
| Dropdown button divider | `border-left: 1px solid var(--app-border)` |
| Multiselect chip | bg `var(--app-primary-soft)`, text `var(--app-primary)` |
| Selected option | bg `var(--app-primary-soft)`, text `var(--app-primary)` |
| Option hover/focus | `color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%)` |
| Label | `var(--app-text)`, `font-weight: 600` |
| Error text | `text-red-500` (validation only — the one non-token color, plus `#dc2626`) |

Plain HTML inputs:

```scss
.offer-form input,
.offer-form textarea,
.offer-form select { border-color: var(--app-border) !important; }

.offer-form input:focus,
.offer-form textarea:focus,
.offer-form select:focus {
  border: 1px solid var(--app-primary) !important;
  box-shadow: none !important;
  outline: none !important;
}
```

### PrimeNG selects/multiselects/autocompletes — the `__field` convention

Tag every PrimeNG control with `styleClass="offer-form__field"` and pair it with
`panelStyleClass="offer-form__overlay-panel"`. The wrapper class themes the **closed control**;
the panel class themes the **portal overlay** (see next subsection):

```html
<p-select
  [options]="categories"
  styleClass="w-full offer-form__field"
  panelStyleClass="offer-form__overlay-panel"
  appendTo="body"
  placeholder="Select category"
  formControlName="category" />
```

Theme the wrapper in the component `.scss`, piercing PrimeNG internals with `::ng-deep`
scoped under the root:

```scss
::ng-deep .offer-form .offer-form__field.p-select,
::ng-deep .offer-form .offer-form__field .p-select-label,
::ng-deep .offer-form .offer-form__field .p-select-dropdown,
::ng-deep .offer-form .offer-form__field.p-multiselect,
::ng-deep .offer-form .offer-form__field .p-multiselect-label,
::ng-deep .offer-form .offer-form__field .p-autocomplete-input {
  background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important;
  color: var(--app-text) !important;
  border-color: var(--app-border) !important;
  box-shadow: none !important;
}

::ng-deep .offer-form .offer-form__field.p-select,
::ng-deep .offer-form .offer-form__field.p-multiselect,
::ng-deep .offer-form .offer-form__field .p-autocomplete-input { min-height: 2.75rem; }

::ng-deep .offer-form .offer-form__field.p-select:focus-within,
::ng-deep .offer-form .offer-form__field.p-multiselect:focus-within,
::ng-deep .offer-form .offer-form__field .p-inputtext:focus {
  border-color: var(--app-primary) !important;
  box-shadow: none !important;
  outline: none !important;
}

::ng-deep .offer-form .offer-form__field .p-multiselect-chip {
  background: var(--app-primary-soft) !important;
  color: var(--app-primary) !important;
}

::ng-deep .offer-form .offer-form__field .p-select-dropdown,
::ng-deep .offer-form .offer-form__field .p-multiselect-dropdown {
  border-left: 1px solid var(--app-border) !important;
  color: var(--app-muted) !important;
  fill: var(--app-muted) !important;
}
```

### The overlay panel (portal-rendered list)

PrimeNG renders option lists at `<body>`, outside your component — so the panel class must be
**global** (put it in `styles.scss`, *not* behind `:host`), and it can't use `::ng-deep`
scoping. The full `.offer-form__overlay-panel` block in `offer-form.css` is the template;
the essentials:

```scss
.offer-form__overlay-panel,
.offer-form__overlay-panel .p-select-option,
.offer-form__overlay-panel .p-multiselect-option,
.offer-form__overlay-panel .p-multiselect-header,
.offer-form__overlay-panel .p-multiselect-filter-container .p-inputtext {
  background: var(--app-surface) !important;
  color: var(--app-text) !important;
  border-color: var(--app-border) !important;
}

.offer-form__overlay-panel .p-select-option,
.offer-form__overlay-panel .p-multiselect-option { border-radius: 0 !important; }  /* square */

.offer-form__overlay-panel .p-select-option:hover,
.offer-form__overlay-panel .p-select-option.p-focus {
  background: color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%) !important;
}

.offer-form__overlay-panel .p-select-option.p-select-option-selected,
.offer-form__overlay-panel .p-multiselect-option.p-multiselect-option-selected {
  background: var(--app-primary-soft) !important;
  color: var(--app-primary) !important;
}
```

### Datepicker

Style the datepicker as a **single bordered field** with the calendar-trigger living inside
it (border only on the left divider), using `.offer-form__datepicker`:

```scss
::ng-deep .offer-form__datepicker .p-datepicker {
  border: 1px solid var(--app-border) !important;
  background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important;
  border-radius: 0 !important;
}
::ng-deep .offer-form__datepicker .p-datepicker-input { border: none !important; background: transparent !important; }
::ng-deep .offer-form__datepicker .p-datepicker-dropdown { border-left: 1px solid var(--app-border) !important; }
::ng-deep .offer-form__datepicker .p-datepicker:focus-within { border-color: var(--app-primary) !important; }
```

The calendar **overlay** itself is themed globally in `styles.scss` (`.p-datepicker-panel`
and `.offer-form__overlay-panel.p-datepicker-panel`) — day/month/year hover, selected day
(`--app-primary` fill, white text), today (primary outline). Reuse that block.

### Radio buttons & checkboxes

Custom-painted: box uses `--app-surface` + `--app-border`, hover/checked border
`--app-primary`, the inner dot/check scales in as `--app-primary`, and focus shows a soft
ring `box-shadow: 0 0 0 2px var(--app-primary-ring)` (the one allowed shadow — a focus ring,
not a drop shadow). Copy the `.p-radiobutton` / `.p-checkbox` blocks from `offer-form.css`.

### Tag chips / pills

Input-adjacent chips use `--app-primary-subtle` bg with `--app-primary` text
(`.offer-form__tag-chip`). "Frequent" suggestion pills use the off-surface `color-mix` fill,
`--app-border`, `--app-muted` text, hovering to `--app-primary` border.

### Form-level utility bridge

Because the form template still carries some legacy utility/hard-coded classes, `offer-form`
re-maps them to tokens **scoped under `.offer-form`** — same contained-bridge idea as previews
(`.offer-form [class*="bg-white"] → var(--app-surface)`, `.text-gray-500 → var(--app-muted)`,
`[class*="text-[#003CC7]"] → var(--app-primary)`, etc.). For brand-new forms prefer semantic
classes + tokens and skip the bridge; only lean on it when mirroring existing markup.

## Backgrounds

- Page/app background: `var(--app-bg)` plus the `--app-bg-art` image layers. The body and
  `.app-shell-bg` already wire all `--app-bg-*` vars. National-day mode layers a gradient +
  PNG via `--app-bg-art`; dark mode clears art and just uses the dark bg.
- Cards / panels / dialogs: `var(--app-surface)`.
- Selected/active fills: `var(--app-primary-soft)`; hover fills: `var(--app-primary-hover-soft)`
  or the `color-mix` pattern above.

## Buttons

Primary PrimeNG buttons are globally overridden to `--app-primary` (hover `--app-primary-700`)
in `styles.scss`. Don't restyle them per-component; rely on the `severity` attribute
(`primary`, `secondary`, etc.). For custom buttons, write SCSS rules using the tokens as in
the `.offer-card__cta` example above.

## Pop-ups / dialogs

Pop-ups are built on PrimeNG `p-dialog`, themed in the component `.scss` with tokens, and
kept **square** (no `border-radius`). Two reference components in
`src/app/shared/Components/`:

- **`confirmation-pop-up/`** — small, reusable yes/no (or acknowledge) dialog. Copy this when
  you need a confirm/cancel prompt.
- **`location-creation-offer/`** — large form-in-a-dialog. Copy this shape when a pop-up hosts
  a full form.

### Confirmation pop-up (the reusable pattern)

A standalone component driven entirely by `input()`/`output()` signals — no internal state:

```ts
// confirmation-pop-up.ts
visible = input(false);
title = input('Confirmation');
message = input('Are you sure you want to proceed?');
allowHtml = input(false);          // render message as HTML when true
confirmLabel = input('Confirm');
cancelLabel = input('Cancel');
loading = input(false);            // spinner on confirm button
showCancel = input(true);          // false = forced acknowledgement (confirm only)
dismissableMask = input(true);     // click backdrop to dismiss

confirm = output<void>();
cancel = output<void>();
```

Dialog wiring (note the flags — this is the house style for modals):

```html
<p-dialog
  [visible]="visible()"
  [modal]="true"
  [closable]="false"
  [draggable]="false"
  [resizable]="false"
  [dismissableMask]="dismissableMask()"
  [style]="{ width: '30rem', maxWidth: '90vw' }"
  styleClass="confirmation-pop-up"
  (onHide)="cancel.emit()">
  <ng-template pTemplate="header">
    <div class="confirmation-pop-up__header">
      <h2 class="confirmation-pop-up__title">{{ title() }}</h2>
    </div>
  </ng-template>

  <div class="confirmation-pop-up__body">
    <p class="confirmation-pop-up__message" *ngIf="!allowHtml()">{{ message() }}</p>
    <p class="confirmation-pop-up__message" *ngIf="allowHtml()" [innerHTML]="message()"></p>
  </div>

  <ng-template pTemplate="footer">
    <div class="confirmation-pop-up__actions">
      @if (showCancel()) {
        <p-button [label]="cancelLabel()" severity="secondary" (onClick)="cancel.emit()" />
      }
      <p-button [label]="confirmLabel()" [loading]="loading()" (onClick)="confirm.emit()" />
    </div>
  </ng-template>
</p-dialog>
```

Styling in SCSS — force every dialog part square via `::ng-deep` on the `styleClass`, and use
tokens for color (the live file still has a couple of hard-coded slate hexes; **prefer tokens
as below**):

```scss
:host ::ng-deep .confirmation-pop-up.p-dialog,
:host ::ng-deep .confirmation-pop-up .p-dialog-header,
:host ::ng-deep .confirmation-pop-up .p-dialog-content,
:host ::ng-deep .confirmation-pop-up .p-dialog-footer {
  border-radius: 0;          // square corners — the house rule
}

.confirmation-pop-up__header { display: flex; align-items: center; }

.confirmation-pop-up__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--app-text);    // token, not #0f172a
}

.confirmation-pop-up__body { padding-top: 0.25rem; }

.confirmation-pop-up__message {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--app-muted);   // token, not #475569
  white-space: pre-line;
}

.confirmation-pop-up__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}
```

Use it from a parent:

```html
<app-confirmation-pop-up
  [visible]="showConfirm()"
  title="Delete offer"
  message="This cannot be undone. Continue?"
  confirmLabel="Delete"
  [loading]="deleting()"
  (confirm)="onDeleteConfirmed()"
  (cancel)="showConfirm.set(false)" />
```

### Form pop-up (large dialog)

For a pop-up that hosts a form, follow `location-creation-offer/`:

- `p-dialog` with `[modal]="true" [closable]="false" [draggable]="false" [resizable]="false"`,
  `appendTo="body"`, a fixed width + `max-w-[..vw]`/`max-h-[..vh]`, and
  `[contentStyle]="{ padding: '0', overflow: 'hidden' }"` so your own container controls
  padding/scroll. Emit `(visibleChange)` for two-way `[(visible)]` binding.
- A custom header row with title (`var(--app-text)`), subtitle (`var(--app-muted)`), and a
  `pi pi-times` close button — `[showHeader]="false"` on the dialog and build your own.
- Theme the dialog shell in SCSS via `::ng-deep` on the dialog's `styleClass`:

```scss
::ng-deep .location-creation-offer-dialog .p-dialog,
::ng-deep .location-creation-offer-dialog .p-dialog-content {
  background: var(--app-surface) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--app-border) !important;
}
```

- Theme the fields with tokens and the `color-mix` input fill used in that file:

```scss
.location-creation-offer input,
.location-creation-offer textarea {
  background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important;
  border: 1px solid var(--app-border) !important;
  color: var(--app-text) !important;
  box-shadow: none !important;
}
.location-creation-offer input:focus,
.location-creation-offer textarea:focus {
  border-color: var(--app-primary) !important;
  box-shadow: none !important;
  outline: none !important;
}
.location-creation-offer input::placeholder { color: var(--app-muted) !important; opacity: 1; }
```

  Mirror the same block with `::ng-deep .location-creation-offer .p-inputtext / .p-select /
  .p-select-label / .p-inputtextarea` so PrimeNG-wrapped controls match.

> Note: the live `location-creation-offer.html` still uses Tailwind utilities and a few
> hard-coded `#0033A0`/`bg-gray-50` classes from before the SCSS+token migration. Treat its
> `.scss` (token-based) as the model and, for new pop-ups, move layout into SCSS classes
> rather than copying the utility soup. Keep `rounded-none` / square everywhere.

### Pop-up rules of thumb

1. Base on `p-dialog`; set `modal`, `closable=false`, `draggable=false`, `resizable=false`.
2. Force **square corners** on every `.p-dialog*` part via `::ng-deep` (no `border-radius`).
3. Color via tokens: shell/content `--app-surface`, text `--app-text`, secondary `--app-muted`,
   borders `--app-border`, primary actions `--app-primary`.
4. Drive visibility/labels via `input()`/`output()` (or `[(visible)]`); keep the dialog
   stateless where possible like `confirmation-pop-up`.
5. Put a confirm spinner through a `loading` input bound to the confirm `p-button`.

## Previews (phone mockups)

Preview components render a **mobile phone mockup** showing how content (offer, vendor,
banner, highlight) will look in the consumer app. They live next to their feature
(e.g. `src/app/features/Offers/Components/preview-offer-details/`) and share one sizing mixin:
`src/app/shared/styles/mobile-preview-mockup.scss`.

### Shared mockup mixin

Import it at the top of the component `.scss` and you get the phone frame, language toggle,
and custom scrollbar for free:

```scss
@use '../../../../shared/styles/mobile-preview-mockup' as *;   // adjust depth to the file
```

It provides `.preview-wrapper`, `.phone-mockup`, `.language-toggle-container`,
`.toggle-button`, `.custom-scrollbar`, `.no-scrollbar` — all token-themed
(`var(--app-surface)`, `var(--app-border)`, `var(--app-primary)`, `var(--app-primary-soft)`).

**Rounded-corner exception:** `.phone-mockup` uses `border-radius: 3rem` — this is the one
sanctioned place to round, because it's imitating a physical phone bezel. That's the kind of
explicit justification the no-rounded-corners rule allows. Everything *inside* the screen
stays square.

### The preview "token bridge" pattern

A preview deliberately reproduces the **consumer app's markup**, which is built with utility
classes (`bg-white`, `text-gray-900`, `border-gray-200`, …). Rather than rewrite that markup,
the preview's `.scss` **scopes overrides to its root class and re-maps those utilities to
tokens** so the mockup follows the admin's active theme/mode:

```scss
:host { display: block; }

.preview-offer-details { color: var(--app-text); }

// remap the consumer-style utilities → tokens, scoped to this component only
.preview-offer-details .bg-white { background: var(--app-surface) !important; }

.preview-offer-details .bg-slate-50,
.preview-offer-details [class*='bg-gray-50'] {
  background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important;
}

.preview-offer-details .border-gray-100,
.preview-offer-details .border-gray-200,
.preview-offer-details .border-gray-300 { border-color: var(--app-border) !important; }

.preview-offer-details .text-gray-900,
.preview-offer-details .text-black { color: var(--app-text) !important; }

.preview-offer-details .text-gray-700,
.preview-offer-details .text-gray-500 { color: var(--app-muted) !important; }
```

This is the **one place** the utility-remap approach is correct — it's a contained bridge for
mirrored consumer markup, not an excuse to use utilities in normal admin UI. Keep the
overrides namespaced under the component root class so they never leak.

### Semantic preview elements

For the preview's own interactive bits, use semantic `__bem` classes styled with tokens
(not utilities):

```scss
.preview-offer-details__redeem-button {
  background: var(--app-primary) !important;
  color: #ffffff !important;
  &:hover { background: var(--app-primary-700) !important; }
}

.preview-offer-details__tab-button.font-bold {
  color: var(--app-primary) !important;
  border-bottom-color: var(--app-primary) !important;   // active tab underline
}

.preview-offer-details__bottom-nav {
  background: var(--app-surface) !important;
  border-top: 1px solid var(--app-border) !important;
  color: var(--app-muted) !important;
}
```

### RTL (Arabic) support

Previews support `language: 'en' | 'ar'`. Handle direction with explicit `--rtl` modifier
classes rather than relying on `dir` alone:

```scss
.preview-offer-details__location-row--rtl   { justify-content: flex-end; text-align: right; }
.preview-offer-details__contact-row--rtl    { flex-direction: row-reverse; }
.preview-offer-details__location-text--rtl  { align-items: flex-end; text-align: right; }
```

### Subtle detail elements

Decorative bits also use `color-mix` over tokens so they track the theme — e.g. the dotted
price separator:

```scss
.rate-dots {
  flex: 1;
  border-bottom: 1px dotted color-mix(in srgb, var(--app-border) 85%, var(--app-muted) 15%);
  margin-bottom: 4px;
}
```

### Preview rules of thumb

1. `@use` the shared `mobile-preview-mockup` mixin for the frame/toggle/scrollbar.
2. The phone bezel may be rounded; **screen content stays square**.
3. Bridge mirrored consumer utility classes → tokens, **scoped under the component root**.
4. Style the preview's own controls with semantic `__bem` classes + tokens.
5. Support `--rtl` modifier classes for Arabic.
6. Use `color-mix(... var(--app-*) ...)` for tints so previews respond to mode + accent.

## Theming — the full picture

Theming has **two independent axes** that combine freely:

1. **Appearance mode** — `light` | `dark` | `national-day`. Controls the *surface/chrome*
   tokens (`--app-bg`, `--app-surface`, `--app-text`, `--app-muted`, `--app-border`) and the
   background art.
2. **Accent theme** — 9 brand palettes (`blue` default, `purple`, `cyan`, `brown`, `lime`,
   `teal`, `burgundy`, `forest`, `deep-teal`). Controls the *brand* tokens
   (`--app-primary*`, gradient, ring) **and** supplies the light/dark surface values that the
   appearance mode then selects from.

Both are owned by **`ThemeService`** (`src/app/shared/services/theme.service.ts`), the single
source of truth. Components never touch CSS classes or `--app-*` directly to change theme —
they call the service. Both selections persist to `localStorage`
(`admin-web-theme`, `admin-web-accent-theme`) and are restored on boot in
`initializeTheme()` (falling back to `prefers-color-scheme` for the mode).

### How the mode axis works

`setAppearanceMode(mode)` just toggles two classes on `<html>` (`document.documentElement`):

```ts
root.classList.toggle('dark-mode', mode === 'dark');
root.classList.toggle('national-day-mode', mode === 'national-day');
```

`styles.scss` then redefines the surface tokens under each class:

- **light** — the `:root` defaults (`--app-light-*` values).
- **dark** — `.dark-mode` re-points `--app-*` to the `--app-dark-*` variants, sets
  `color-scheme: dark`, and adds PrimeNG component overrides (cards, tables, inputs, overlays
  → `--app-surface`/`--app-text`/`--app-border`). It also carries a **legacy migration
  bridge** (`.dark-mode .bg-white → var(--app-surface)`, `.text-gray-900 → var(--app-text)`,
  etc.) for old hard-coded utility classes — don't rely on or extend it.
- **national-day** — `.national-day-mode` sets a light-on-green palette plus layered
  background art via `--app-bg-art` (gradient + `/assets/themes/founding321.png`) and
  `color-scheme: light`.

Because your component SCSS reads `var(--app-*)`, switching mode "just works" — you normally
write **no** `.dark-mode`/`.national-day-mode` rules of your own. Only add
`.dark-mode .your-class { … }` for a genuine exception the tokens can't express.

### How the accent axis works

`setAccentTheme(name)` does two things (`applyAccentTheme`):

```ts
updatePrimaryPalette(theme.palette);            // 1. PrimeNG's own primary ramp
const root = document.documentElement;
root.dataset['accentTheme'] = theme.name;       // 2a. data-accent-theme="purple" (for CSS hooks)
root.style.setProperty('--app-light-bg', theme.background.appBg);
root.style.setProperty('--app-dark-bg',  theme.darkBackground.appBg);
// …writes every --app-light-*, --app-dark-*, --app-primary*, -rgb, -soft,
//   -subtle, -hover-soft, -ring, -gradient as inline styles on <html>…
```

Key point: the accent theme writes **both** the light *and* dark surface values
(`--app-light-*` and `--app-dark-*`). The mode classes in `styles.scss` then choose which set
`--app-*` resolves to. That's why accent + mode are orthogonal — e.g. "purple + dark" works
without any purple-specific dark CSS.

The `-soft`/`-subtle`/`-hover-soft`/`-ring` tokens are derived at runtime from the theme's
`rgb` (`rgba(${rgb}, 0.08)` etc.), so they always track the active accent.

### The accent catalog (`accent-themes.ts`)

Each entry of `ACCENT_THEMES` is an `AccentTheme`:

```ts
{
  name: 'purple',            // AccentThemeName union member (also add it there)
  label: 'Purple',           // shown in the switcher UI
  swatch: '#643278',         // dot color in the switcher
  background:     { appBg, surface, text, muted, border },  // light-mode surfaces
  darkBackground: { appBg, surface, text, muted, border },  // dark-mode surfaces
  palette: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 }, // full ramp
  rgb: '100, 50, 120',       // raw channels for rgba() tokens
  gradient: 'linear-gradient(91.48deg, #643278 10%, #875093 90%)',
}
```

Note `palette[600]` becomes `--app-primary`, `palette[700]` becomes `--app-primary-700`
(hover). `DEFAULT_ACCENT_THEME = ACCENT_THEMES[0]` (blue); `getAccentTheme(name)` resolves a
stored name back to its object, falling back to the default.

### Consuming / switching themes in a component

Inject the service and proxy its signals; the navbar and
`setting-app-features` components are the reference switchers:

```ts
private readonly themeService = inject(ThemeService);

appearanceModes  = () => this.themeService.appearanceModes;   // [{value,label}]
appearanceMode   = () => this.themeService.appearanceMode();  // current mode signal
accentThemes     = () => this.themeService.accentThemes;      // ACCENT_THEMES
activeAccentTheme = () => this.themeService.accentTheme();     // current AccentTheme signal

onAppearanceModeChange(mode: AppearanceMode) { this.themeService.setAppearanceMode(mode); }
onAccentThemeChange(name: AccentThemeName)   { this.themeService.setAccentTheme(name); }
```

`isDarkMode` is a `computed()` on the service if you need to branch logic (rarely — prefer
tokens). Render swatches from `theme.swatch`, labels from `theme.label`.

### Recipes

- **Add an accent theme** — append an `AccentTheme` to `ACCENT_THEMES` with all fields and add
  its `name` to the `AccentThemeName` union. No CSS or service changes — it appears in every
  switcher and themes the whole app automatically.
- **Change the default brand color** — edit the `blue` entry (or repoint
  `DEFAULT_ACCENT_THEME`) **and** update the matching fallback literals in `:root` of
  `styles.scss` (those are only used before the service runs / if JS is disabled).
- **Add an appearance mode** — extend the `AppearanceMode` union + `appearanceModes` list,
  toggle a new class in `applyTheme`, and add a `.your-mode { --app-*: … }` block in
  `styles.scss` (follow `.national-day-mode`).
- **Hook CSS to a specific accent** — use the `data-accent-theme` attribute the service sets,
  e.g. `:root[data-accent-theme='lime'] .foo { … }`. Rarely needed.

## Scrollbars, fonts, misc

- Font is `Ghawar` via `@font-face` + `--font-family`, applied to `html, body, .p-component`.
- Scrollbars are themed thin via `--app-scrollbar-thumb*` (dark mode mixes in primary).
- `box-shadow: none` and square corners are intentional design choices — match them.

## Checklist for any styling change

1. Are you writing it in **SCSS** (component `.scss` or `styles.scss`) with a semantic class,
   not Tailwind utilities in the template? Do that.
2. Is there an existing token for this color? Use it — don't hard-code.
3. Will it look right in **dark** and **national-day**? (Tokens handle this; literals don't.)
4. Does it survive an **accent switch**? Use `--app-primary*`, not a fixed hex.
5. New PrimeNG overlay? Add a panel/overlay class and theme it in SCSS like the existing
   `*__overlay-panel` blocks (surface, text, border, square, primary-soft selected).
6. Keep corners **square** (no `border-radius` unless explicitly justified) and remove input
   shadows to match the system.

## Porting this skill to a sibling project

Copy these three files and keep the contract identical:

- `src/styles.scss` (token declarations + mode/overlay overrides)
- `src/app/shared/theme/accent-themes.ts` (catalog)
- `src/app/shared/services/theme.service.ts` (runtime applier)

Requires SCSS support and PrimeNG with `@primeuix/themes` for `updatePrimaryPalette`. The
token system is plain CSS custom properties, so it does **not** depend on Tailwind — write
your component styles in SCSS using `var(--app-*)` and follow the rules above in every
component.
