---
name: design-tokens-styling
description: Portable house style for themeable web apps — style in real CSS/SCSS with CSS-variable design tokens instead of utility classes or hard-coded colors, so light/dark (and any extra) appearance modes and swappable accent themes work automatically. Square corners by default. Framework-agnostic; PrimeNG shown as the worked example for component-library overrides. Use whenever adding or changing colors, backgrounds, inputs, buttons, tables, dialogs, overlays, or theme support.
---

# Styling guide (design tokens + theming) — portable

**Style in SCSS/CSS with semantic class names, not utility classes.** Put styles in the
component's stylesheet (or the global stylesheet for app-wide rules) using real selectors and
the design tokens below. Do **not** add utility classes (`bg-*`, `text-*`, `border-*`, `flex`,
`p-4`, arbitrary `[var(...)]` utilities) to templates for styling — keep templates to semantic
class names and style those classes in the stylesheet.

Everything is themed through **CSS custom properties (design tokens)** defined on `:root`.
Colors are never hard-coded in components — they reference tokens so that **appearance modes**
(light / dark / any extra) and **swappable accent themes** all work automatically.

> Adopting this in a fresh project? Set up the three moving parts (below), then follow the
> per-element recipes. Converting an existing utility/hex-heavy project? Inventory the
> hard-coded colors, build a hex→token map, convert component by component, verify in every
> mode + accent.

Three moving parts to stand up once per project:

1. **Global stylesheet** — declares the tokens on `:root`, the per-mode overrides, and any
   global component-library overrides.
2. **Accent catalog** (a data file, e.g. `accent-themes.ts`) — the list of accent themes
   (palettes + light/dark surface colors).
3. **Theme service/controller** — applies the chosen mode/accent at runtime by toggling
   classes on `<html>` and writing `--*` custom properties. Single source of truth; persists
   to `localStorage` and restores on boot.

## The golden rules

1. **Style in the stylesheet, not utilities.** Give the element a semantic class
   (e.g. `class="offer-card"`) and write its rules in the component stylesheet.
2. **Never hard-code a color.** Always reference a token. If you're about to write `#0033A0`,
   `white`, `#111827`, `#e5e7eb`, etc., use the matching token. Hard-coded colors break dark
   mode and accent switching.
3. **Corners stay square — no `border-radius`.** Deliberate design language: sharp `0` corners
   everywhere (inputs, selects, datepickers, overlays, options, paginators). Only round with a
   real, stated justification — a circular avatar, a status pill, a phone-mockup bezel — and
   call out that justification in the code/PR. (Adjust this rule if your product's design
   language is rounded; the point is *consistency by token/convention, not per-element guesses*.)

## The token vocabulary

Surface / chrome tokens (these flip per appearance mode):

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

Other: `--font-family`, background-art layers (`--app-bg-art` / `-size` / `-position` /
`-repeat` / `-attachment`), `--app-scrollbar-thumb` / `--app-scrollbar-thumb-hover`.

The one sanctioned non-token color is validation/state color: error `#dc2626` / red, success
`#16a34a` / green, and `#fff`/`#000` as on-primary contrast (button text on a primary fill).
Everything else goes through a token.

## How to apply tokens

Give the element a semantic class in the template, then style that class using `var(--app-*)`.
Nest with `&` for variants/states.

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
    color: #fff;                       // on-primary contrast — allowed
    border: 1px solid var(--app-primary);
    &:hover {
      background: var(--app-primary-700);
      border-color: var(--app-primary-700);
    }
  }

  &.is-selected { background: var(--app-primary-soft); }
}
```

Use `color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%)` for subtle hover/active
states that must stay correct in both light and dark — the general pattern for tints that must
track the theme.

## Fields / inputs

Keep one **canonical form component** as the exhaustive reference and copy its patterns. Wrap
the whole form in one root class (e.g. `.offer-form`) and scope every field rule under it so
styling never leaks.

### Global baseline (set once, in the global stylesheet)

- Force `box-shadow: none` and **square corners** (`border-radius: 0`) on every input control
  and its inner parts (labels, dropdown triggers, option lists, datepicker panels, paginator
  selects) so fields are square everywhere with **no per-component override needed**.
- In dark mode they inherit `--app-surface` / `--app-text` / `--app-border` automatically.

### The house field recipe (reuse verbatim)

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
| Chip / selected option | bg `var(--app-primary-soft)`, text `var(--app-primary)` |
| Option hover/focus | `color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%)` |
| Label | `var(--app-text)`, `font-weight: 600` |
| Error text | red `#dc2626` (validation only) |

Plain HTML inputs:

```scss
.offer-form input,
.offer-form textarea,
.offer-form select { border-color: var(--app-border); }

.offer-form input:focus,
.offer-form textarea:focus,
.offer-form select:focus {
  border: 1px solid var(--app-primary);
  box-shadow: none;
  outline: none;
}
.offer-form input::placeholder { color: var(--app-muted); opacity: 1; }
```

### Component-library controls (worked example: PrimeNG)

If you use a component library (PrimeNG, MUI, etc.), it renders its own DOM you must pierce.
The pattern: tag every control with a wrapper class (`offer-form__field`) that themes the
**closed control**, and a panel class (`offer-form__overlay-panel`) that themes the **portal
overlay** (see next subsection). PrimeNG shown:

```html
<p-select
  styleClass="w-full offer-form__field"
  panelStyleClass="offer-form__overlay-panel"
  appendTo="body"
  placeholder="Select category"
  formControlName="category" />
```

Theme the wrapper, piercing internals with the framework's shadow-piercing combinator
(`::ng-deep` in Angular; in others, a global scoped selector) under the root:

```scss
::ng-deep .offer-form .offer-form__field.p-select,
::ng-deep .offer-form .offer-form__field .p-select-label,
::ng-deep .offer-form .offer-form__field .p-select-dropdown {
  background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important;
  color: var(--app-text) !important;
  border-color: var(--app-border) !important;
  box-shadow: none !important;
}
::ng-deep .offer-form .offer-form__field.p-select { min-height: 2.75rem; }
::ng-deep .offer-form .offer-form__field.p-select:focus-within {
  border-color: var(--app-primary) !important;
  box-shadow: none !important; outline: none !important;
}
::ng-deep .offer-form .offer-form__field .p-select-dropdown {
  border-left: 1px solid var(--app-border) !important;
  color: var(--app-muted) !important; fill: var(--app-muted) !important;
}
```

### The overlay panel (portal-rendered list)

Component libraries often render option lists at `<body>`, outside your component — so the
panel class must be **global** (put it in the global stylesheet, not scoped to the component),
and it can't use component-scoping combinators:

```scss
.offer-form__overlay-panel,
.offer-form__overlay-panel .p-select-option {
  background: var(--app-surface) !important;
  color: var(--app-text) !important;
  border-color: var(--app-border) !important;
}
.offer-form__overlay-panel .p-select-option { border-radius: 0 !important; }
.offer-form__overlay-panel .p-select-option:hover,
.offer-form__overlay-panel .p-select-option.p-focus {
  background: color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%) !important;
}
.offer-form__overlay-panel .p-select-option.p-select-option-selected {
  background: var(--app-primary-soft) !important;
  color: var(--app-primary) !important;
}
```

### Datepicker, radios/checkboxes, chips

- **Datepicker** — one bordered field with the trigger inside it (border only on the left
  divider); the calendar overlay themed globally (day/month hover, selected day = `--app-primary`
  fill + white text, today = primary outline).
- **Radios/checkboxes** — custom-painted: box `--app-surface` + `--app-border`, hover/checked
  border `--app-primary`, inner dot/check `--app-primary`, focus ring
  `box-shadow: 0 0 0 2px var(--app-primary-ring)` (the one allowed shadow — a focus ring, not a
  drop shadow).
- **Chips/pills** — `--app-primary-subtle` bg + `--app-primary` text; suggestion pills use the
  off-surface `color-mix` fill, `--app-border`, `--app-muted` text, hovering to `--app-primary`
  border.

### Legacy utility bridge (only when mirroring existing markup)

If a template still carries legacy utility/hex classes you can't rewrite yet, re-map them to
tokens **scoped under the component root** (`.offer-form [class*="bg-white"] → var(--app-surface)`,
`.text-gray-500 → var(--app-muted)`, etc.). For brand-new work prefer semantic classes + tokens
and skip the bridge.

## Backgrounds

- Page/app background: `var(--app-bg)` plus optional `--app-bg-art` image layers.
- Cards / panels / dialogs: `var(--app-surface)`.
- Selected/active fills: `var(--app-primary-soft)`; hover fills: `var(--app-primary-hover-soft)`
  or the `color-mix` pattern above.

## Buttons

Override the library's primary button once globally to `--app-primary` (hover `--app-primary-700`)
and drive variants via the library's `severity`/variant prop — don't restyle per component. For
custom buttons, write rules using the tokens as in the `.offer-card__cta` example.

## Pop-ups / dialogs

Keep two reference dialogs and copy them: a small reusable **confirm/cancel** dialog driven
entirely by `input()`/`output()` (stateless), and a large **form-in-a-dialog**. Rules of thumb:

1. Base on the library's dialog; set `modal`, `closable=false`, `draggable=false`, `resizable=false`.
2. Force **square corners** on every dialog part via the shadow-piercing combinator.
3. Color via tokens: shell/content `--app-surface`, text `--app-text`, secondary `--app-muted`,
   borders `--app-border`, primary actions `--app-primary`.
4. Drive visibility/labels via inputs/outputs (or two-way binding); keep it stateless where possible.
5. Confirm spinner via a `loading` input bound to the confirm button.

```scss
:host ::ng-deep .confirmation-pop-up.p-dialog,
:host ::ng-deep .confirmation-pop-up .p-dialog-header,
:host ::ng-deep .confirmation-pop-up .p-dialog-content,
:host ::ng-deep .confirmation-pop-up .p-dialog-footer { border-radius: 0; }

.confirmation-pop-up__title   { margin: 0; font-weight: 700; color: var(--app-text); }
.confirmation-pop-up__message { margin: 0; line-height: 1.6; color: var(--app-muted); white-space: pre-line; }
.confirmation-pop-up__actions { display: flex; justify-content: flex-end; gap: 0.75rem; width: 100%; }
```

## Data tables

House recipe (theme via the shadow-piercing combinator on a class set on the table):

- **Header cells** — `var(--app-muted)`, `font-weight: 600`, no fill, only
  `border-bottom: 1px solid var(--app-border)`. Show a sort icon next to every sortable label.
- **Body cells** — `var(--app-text)`, generous padding (`~1.1rem 1rem`), rows separated by a
  single `border-bottom: 1px solid var(--app-border)`. Hover row → `var(--app-primary-hover-soft)`.
- **Sort icons** — `var(--app-muted)` at rest, `var(--app-primary)` on the active column.
- **Paginator** — transparent bg, no border, centered; page buttons square + `var(--app-muted)`;
  the active page is a filled `var(--app-primary)` circle with white text (`border-radius: 999px`
  — a sanctioned rounded exception).
- **Status pill** — rounded lozenge (`border-radius: 999px`), `font-weight: 700`; color by state:
  success `rgba(34,197,94,0.16)`/`#16a34a`, danger `rgba(239,68,68,0.16)`/`#dc2626`, brand
  `var(--app-primary-soft)`/`var(--app-primary)`. (Justified rounded exception.)
- **Search input** — a plain square input, not a rounded pill; inherits the global input baseline.
- **Filter the data, not the table** — filter via signals/state + a computed that returns the
  rows, and bind the filtered rows. Don't reach into the library's filter API for in-memory lists.
- **Period filter** — a preset select (All time, Last 7/30/90 days, This year, Custom); a computed
  maps the preset to a `[from, to]` range; only "Custom" reveals a range datepicker.

Everything else stays square and token-driven; dark + accent switching come free because the
table reads `--app-surface`/`--app-text`/`--app-border`.

## Previews / embedded consumer markup (the token bridge)

When a component deliberately reproduces another app's markup (built with utility classes like
`bg-white`, `text-gray-900`), don't rewrite it — **scope overrides to the component root class
and re-map those utilities to tokens** so it follows the active theme:

```scss
.preview-x .bg-white { background: var(--app-surface) !important; }
.preview-x [class*='bg-gray-50'] { background: color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%) !important; }
.preview-x .border-gray-200 { border-color: var(--app-border) !important; }
.preview-x .text-gray-900 { color: var(--app-text) !important; }
.preview-x .text-gray-500 { color: var(--app-muted) !important; }
```

This is the **one place** the utility-remap approach is correct — a contained bridge for mirrored
markup, namespaced under the component root so it never leaks. Style the preview's own controls
with semantic `__bem` classes + tokens. Support RTL with explicit `--rtl` modifier classes rather
than relying on `dir` alone. A phone-mockup bezel may be rounded (`border-radius: 3rem`) — the
one place rounding is justified; screen content stays square.

## Theming — the two axes

Theming has **two independent axes** that combine freely:

1. **Appearance mode** (`light` | `dark` | any extra) — controls the *surface/chrome* tokens
   (`--app-bg`, `--app-surface`, `--app-text`, `--app-muted`, `--app-border`) and background art.
2. **Accent theme** (N brand palettes) — controls the *brand* tokens (`--app-primary*`, gradient,
   ring) **and** supplies the light/dark surface values the appearance mode then selects from.

A single **theme service/controller** owns both, persists both to `localStorage`, and restores
on boot (falling back to `prefers-color-scheme` for the mode). Components never touch classes or
`--*` directly — they call the service.

### Mode axis

`setAppearanceMode(mode)` toggles a class on `<html>`:

```ts
root.classList.toggle('dark-mode', mode === 'dark');
```

The global stylesheet redefines the surface tokens per class:

- **light** — the `:root` defaults.
- **dark** — `.dark-mode` re-points `--app-*` to the `--app-dark-*` variants, sets
  `color-scheme: dark`, and adds any library overrides (cards, tables, inputs, overlays →
  `--app-surface`/`--app-text`/`--app-border`).

Because component styles read `var(--app-*)`, switching mode "just works" — you normally write
**no** `.dark-mode` rules of your own. Only add `.dark-mode .your-class { … }` for a genuine
exception the tokens can't express.

### Accent axis

`setAccentTheme(name)` writes **both** light and dark surface values plus every brand token as
inline styles on `<html>`, and sets `data-accent-theme="…"` for optional CSS hooks:

```ts
updatePrimaryPalette(theme.palette);            // library's own primary ramp (if any)
const root = document.documentElement;
root.dataset['accentTheme'] = theme.name;
root.style.setProperty('--app-light-bg', theme.background.appBg);
root.style.setProperty('--app-dark-bg',  theme.darkBackground.appBg);
// …writes every --app-light-*, --app-dark-*, --app-primary*, -rgb, -soft, -subtle,
//   -hover-soft, -ring, -gradient…
```

The mode classes then choose which set `--app-*` resolves to — that's why accent + mode are
orthogonal (e.g. "purple + dark" works with no purple-specific dark CSS). The
`-soft`/`-subtle`/`-hover-soft`/`-ring` tokens are derived at runtime from the theme's `rgb`
(`rgba(${rgb}, 0.08)` etc.), so they always track the active accent.

### Accent catalog entry

```ts
{
  name: 'purple', label: 'Purple', swatch: '#643278',
  background:     { appBg, surface, text, muted, border },  // light-mode surfaces
  darkBackground: { appBg, surface, text, muted, border },  // dark-mode surfaces
  palette: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 },
  rgb: '100, 50, 120',
  gradient: 'linear-gradient(91.48deg, #643278 10%, #875093 90%)',
}
```

`palette[600]` → `--app-primary`, `palette[700]` → `--app-primary-700`. **Add an accent theme**
by appending an entry (and its name to the type union) — no CSS or service changes; it appears
in every switcher and themes the whole app.

## Checklist for any styling change

1. Written in the **stylesheet** with a semantic class, not utilities in the template?
2. Existing **token** for this color? Use it — don't hard-code.
3. Will it look right in **dark** (and any extra mode)? Tokens handle this; literals don't.
4. Does it survive an **accent switch**? Use `--app-primary*`, not a fixed hex.
5. New library overlay? Add a panel/overlay class and theme it globally (surface, text, border,
   square, primary-soft selected).
6. Corners **square** (no `border-radius` unless justified) and input shadows removed.

## Standing this up in a new project

Create/port three things and keep the contract identical:

- **global stylesheet** — token declarations on `:root`, `--app-dark-*` variants, `.dark-mode`
  (and any extra mode) overrides, global input/overlay/dialog square-corner + shadow-off rules.
- **accent catalog** — the data list of accent themes.
- **theme service/controller** — toggles mode classes and writes `--*` at runtime; persists +
  restores.

The token system is plain CSS custom properties, so it does **not** depend on any CSS framework
or component library. Write component styles in SCSS/CSS using `var(--app-*)` and follow the
rules above. If you use a component library, replace the PrimeNG selectors here with that
library's DOM classes and its shadow-piercing mechanism.
