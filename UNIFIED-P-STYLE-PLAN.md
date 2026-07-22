# Unified PrimeNG (`p-*`) Style — Portable Implementation Plan

Self-contained. Everything needed to reproduce this app's unified PrimeNG styling
in another Angular + PrimeNG project is in this file — no other files referenced.

---

## 0. The idea (read this first)

Every PrimeNG control in the app (`p-select`, `p-multiselect`, `p-inputtext`,
`p-datepicker`, `p-listbox`, `p-menu`, `p-button`, dialogs, chips, skeletons…)
reads its colors, sizes and borders from **CSS variables defined once in `:root`**.

Result: restyling *every* field in the app is a **token edit**, not a sweep
through selectors. Dark mode, brand-accent swaps, and RTL all fall out of the
same tokens.

Two layers make it work:

1. **PrimeNG theme preset** (TS, `app.config.ts`) — maps your brand color scale
   and sets a few structural defaults (square button corners, dark-mode selector).
2. **Global override sheet** (SCSS, one file loaded app-wide) — forces every
   `p-*` component onto the token system with `!important`. This is where the
   "unified field" shell lives.

You need **both**. The preset alone can't express the "one shell, transparent
inner parts, one height for every control" pattern; the override sheet does that.

---

## 1. Prerequisites (packages)

Versions this was built against — class names below assume **PrimeNG v21**:

```
@angular/core     ^21
primeng           ^21          // v18+ renamed p-dropdown → p-select; both handled below
primeicons        ^7
@primeuix/themes  (ships with primeng 21)
tailwindcss       ^4           // optional; only needed if you keep the dark-mode Tailwind bridges in §4
```

If you're on an **older PrimeNG (v17 or earlier)**: the components were named
`p-dropdown`, `p-dropdown-panel`, `p-dropdown-label` etc. The override sheet
already lists both the new (`p-select*`) and old (`p-dropdown*`) names in each
selector group, so it tolerates both — keep them.

---

## 2. Step 1 — PrimeNG theme preset (`app.config.ts`)

Register PrimeNG with a preset derived from **Aura**. Map your brand color into
the `primary` scale (600 = your base brand color), force square button corners,
and point dark mode at a `.dark-mode` class.

```ts
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const BrandPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#EEF4FF',
      100: '#D9E5FF',
      200: '#BCD1FF',
      300: '#8FB1FF',
      400: '#5C87F6',
      500: '#406ED1',
      600: '#0033A0',   // <-- your brand base color
      700: '#002C8A',
      800: '#00246F',
      900: '#001C54',
      950: '#001238',
    },
  },
  components: {
    button: { root: { borderRadius: '0' } },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    // ...your other providers
    providePrimeNG({
      ripple: true,
      theme: {
        preset: BrandPreset,
        options: {
          prefix: 'prime',
          darkModeSelector: '.dark-mode',      // dark mode = add .dark-mode on a wrapper/<html>
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',      // see §6 — this is why the override sheet wins
          },
        },
      },
    }),
  ],
};
```

**Why `cssLayer.order` matters:** PrimeNG emits its component CSS inside the
`primeng` cascade layer. Your global override sheet (Step 3+) is loaded
**unlayered**, and unlayered CSS beats *any* layered CSS regardless of
specificity. That's what lets the override sheet win. The `!important` in the
sheet is belt-and-suspenders (also beats component inline defaults and later
component stylesheets) — keep it.

---

## 3. Step 2 — Design tokens (`:root`)

Put this at the top of your **global** stylesheet (the one registered in
`angular.json` → `"styles"`, loaded app-wide — NOT a component `.scss`, those
are scoped). Every rule after this reads from these.

```scss
:root {
  --font-family: "YourFont", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;

  /* Surface / chrome tokens (these flip in dark mode, §4) */
  --app-bg: #F6F6F8;
  --app-surface: #ffffff;
  --app-text: #111827;
  --app-muted: #6b7280;
  --app-border: #e5e7eb;

  /* Semantic danger — accent-INDEPENDENT on purpose: a destructive action must
     not restyle itself when the brand accent changes. */
  --app-danger: #b41340;

  /* Brand / primary tokens (derive all from one base color) */
  --app-primary-rgb: 0, 51, 160;
  --app-primary: #0033A0;
  --app-primary-700: #002277;
  --app-primary-soft:       rgba(var(--app-primary-rgb), 0.08);
  --app-primary-subtle:     rgba(var(--app-primary-rgb), 0.13);
  --app-primary-hover-soft: rgba(var(--app-primary-rgb), 0.06);
  --app-primary-ring:       rgba(var(--app-primary-rgb), 0.16);
  --app-primary-gradient:   linear-gradient(91.48deg, #0033A0 10%, #002277 90%);

  /* Form field tokens — EVERY control reads these. Restyle all fields = edit here. */
  --field-bg:            color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%);
  --field-bg-hover:      color-mix(in srgb, var(--app-surface) 76%, var(--app-border) 24%);
  --field-bg-active:     var(--app-primary-soft);
  --field-border:        var(--app-border);
  --field-border-hover:  color-mix(in srgb, var(--app-border) 60%, var(--app-text) 40%);
  --field-border-focus:  var(--app-primary);
  --field-ring:          var(--app-primary-ring);
  --field-text:          var(--app-text);
  --field-placeholder:   var(--app-muted);
  --field-icon:          var(--app-muted);
  --field-height:        2.5rem;      /* match your button height so fields line up */
  --field-padding-x:     0.9rem;
  --field-padding-y:     0.55rem;
  --field-font-size:     0.9rem;

  /* Label tokens — label above the control, description/hint below it */
  --label-color:      var(--app-text);
  --label-size:       0.875rem;
  --label-weight:     600;
  --label-gap:        0.5rem;
  --label-desc-color: var(--app-muted);
  --label-desc-size:  0.75rem;
}

html, body, .p-component { font-family: var(--font-family); }

body { background: var(--app-bg); color: var(--app-text); }
```

**Key move:** `--field-bg` is *mixed* from `--app-surface` + `--app-border`. Both
of those flip in dark mode, so fields recolor for dark **automatically** — no
per-field dark override needed.

---

## 4. Step 3 — Dark mode

Toggling `.dark-mode` on a wrapper (or `<html>`) flips the surface tokens; every
field/overlay/label recolors because they all read the tokens.

```scss
.dark-mode {
  --app-bg: #232323;
  --app-surface: #111827;
  --app-text: #e5e7eb;
  --app-muted: #94a3b8;
  --app-border: #334155;
  color-scheme: dark;
}
.dark-mode body { background: var(--app-bg); color: var(--app-text); }

/* PrimeNG surfaces that don't read our tokens on their own — nudge them */
.dark-mode .p-card,
.dark-mode .p-toolbar,
.dark-mode .p-dialog,
.dark-mode .p-drawer,
.dark-mode .p-tabs,
.dark-mode .p-datatable,
.dark-mode .p-inputtext,
.dark-mode .p-select,
.dark-mode .p-datepicker,
.dark-mode .p-panel,
.dark-mode .p-overlaypanel { color: var(--app-text); }

.dark-mode .p-card,
.dark-mode .p-toolbar,
.dark-mode .p-drawer,
.dark-mode .p-dialog-content,
.dark-mode .p-datatable-table-container,
.dark-mode .p-overlaypanel-content {
  background: var(--app-surface) !important;
  border-color: var(--app-border) !important;
}
```

**OPTIONAL — Tailwind bridge (only if the project uses Tailwind utility classes
in templates).** Maps leftover `bg-white` / `text-gray-*` / `border-gray-*`
utilities onto the dark tokens. Skip entirely if you don't use Tailwind.

```scss
.dark-mode .bg-white { background-color: #111827 !important; }
.dark-mode .bg-gray-50,
.dark-mode .bg-slate-50 { background-color: #1f2937 !important; }
.dark-mode .text-gray-900, .dark-mode .text-slate-900, .dark-mode .text-slate-800,
.dark-mode .text-gray-700, .dark-mode .text-slate-700 { color: var(--app-text) !important; }
.dark-mode .text-gray-600, .dark-mode .text-gray-500,
.dark-mode .text-slate-500, .dark-mode .text-slate-400 { color: var(--app-muted) !important; }
.dark-mode .border-gray-100, .dark-mode .border-gray-200,
.dark-mode .border-slate-100, .dark-mode .border-slate-200 { border-color: var(--app-border) !important; }
```

---

## 5. Step 4 — The unified override sheet

All of this goes in the same global stylesheet, after the tokens. Grouped by
concern; paste all groups.

### 5a. Buttons — force primary onto the brand color

```scss
.p-button:not(.p-button-secondary):not(.p-button-success):not(.p-button-info):not(.p-button-warning):not(.p-button-danger),
p-button[severity="primary"] .p-button,
.p-button.p-button-primary {
  background-color: var(--app-primary) !important;
  border-color: var(--app-primary) !important;
  color: #ffffff !important;
}
.p-button:not(.p-button-secondary):not(.p-button-success):not(.p-button-info):not(.p-button-warning):not(.p-button-danger):enabled:hover,
p-button[severity="primary"] .p-button:enabled:hover,
.p-button.p-button-primary:enabled:hover {
  background-color: var(--app-primary-700) !important;
  border-color: var(--app-primary-700) !important;
}
```

### 5b. Square corners (app-wide flat look)

```scss
.p-card, .p-card .p-card, .p-card-body, .p-card-content,
.p-panel, .p-dialog, .p-drawer, .p-popover, .p-tag {
  border-radius: 0 !important;
}
/* Confirmation dialog: header/footer share the body surface */
.p-dialog.confirmation-pop-up .p-dialog-header,
.p-dialog.confirmation-pop-up .p-dialog-content,
.p-dialog.confirmation-pop-up .p-dialog-footer { background: var(--app-surface) !important; }
```

### 5c. Menu (`p-menu`)

```scss
.p-menu { background: var(--app-surface) !important; border-color: var(--app-border) !important; padding: 0.25rem 0; }
.p-menu .p-menuitem-link { background: transparent !important; border-radius: 0 !important; padding: 0.75rem 1rem; }
.p-menu .p-menuitem-link:hover { background: color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%) !important; }
.p-menu .p-menuitem-icon { color: var(--app-muted) !important; margin-inline-end: 0.75rem; }
.p-menu .p-menuitem-text { color: var(--app-text) !important; font-size: 0.9rem; font-weight: 500; }

/* Utility class you add to a menu item for a destructive action */
.p-menuitem-danger .p-menuitem-text,
.p-menuitem-danger .p-menuitem-icon { color: #dc2626 !important; }
```

### 5d. Unified form fields — THE core pattern

The whole "unified" idea. Read the comments; this is the part worth understanding
rather than blindly copying.

**Mental model:** the outer wrapper (`.p-select`, `.p-multiselect`, …) is the
only thing that carries a background + border + height. The inner label/input
(`.p-select-label`, `.p-inputtext` inside, …) is made **transparent, borderless,
full-height** so it rides *inside* the shell. That's what makes a text input, a
select, a datepicker and a custom search box all render as the identical box and
line up pixel-perfect in a filter row.

```scss
/* --- The outer shell: carries background + border --- */
.p-inputtext, .p-textarea, .p-select, .p-multiselect, .p-listbox,
.p-datepicker, .p-dropdown, .p-password, .p-inputnumber, .p-autocomplete,
.app-search {
  background: var(--field-bg) !important;
  color: var(--field-text) !important;
  border: 1px solid var(--field-border) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  font-size: var(--field-font-size);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

/* One height for every single-line control (they line up in a filter row).
   Multiselect/listbox get min-height — they grow when chips wrap. */
.p-select, .p-datepicker, .p-inputtext:not(textarea), .app-search { height: var(--field-height); }
.p-multiselect, .p-listbox { min-height: var(--field-height); }

/* Side gap: one token via padding-inline (mirrors itself in RTL). Wrapper
   controls carry NO padding themselves — their inner label/input does, else the
   gap lands twice. */
.p-select, .p-multiselect, .p-datepicker, .p-iconfield { padding-inline: 0 !important; }

.p-inputtext, .p-textarea, .p-select-label, .p-multiselect-label,
.p-datepicker-input, .p-password-input, .p-inputnumber-input,
.p-autocomplete-input, .p-listbox-option, .p-select-option, .p-multiselect-option,
.app-search { padding-inline: var(--field-padding-x) !important; }

/* --- Inner parts ride on the shell: no 2nd background, no 2nd border --- */
.p-select-label, .p-multiselect-label, .p-datepicker-input, .p-password-input,
.p-inputnumber-input, .p-autocomplete-input, .app-search input {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: inherit !important;
  height: 100%;
  min-height: 0 !important;
  font-size: inherit;
}
/* Text centered in the fixed height. Spans can flex; real <input>s can't. */
.p-select-label, .p-multiselect-label { display: flex !important; align-items: center; }
.app-search input { padding-inline: 0 !important; }

/* Chevron/calendar button sits --field-padding-x from the end edge, matching the
   label's start padding. width:auto kills PrimeNG's fixed 2.5rem box. */
.p-select-dropdown, .p-multiselect-dropdown, .p-datepicker-dropdown {
  width: auto !important;
  padding-inline: 0 var(--field-padding-x) !important;
}

/* Exception: paginator's rows-per-page select is a compact table control. */
.p-paginator .p-select { height: auto !important; min-height: 2rem; }
.p-paginator .p-select-label, .p-paginator .p-select-dropdown { padding-inline: 0.5rem !important; }

/* --- States: hover / focus / open = primary border + soft ring --- */
.p-inputtext:enabled:hover, .p-textarea:enabled:hover,
.p-select:not(.p-disabled):hover, .p-multiselect:not(.p-disabled):hover,
.p-listbox:not(.p-disabled):hover, .p-datepicker:not(.p-disabled):hover,
.app-search:hover {
  background: var(--field-bg-hover) !important;
  border-color: var(--field-border-hover) !important;
}
.p-inputtext:enabled:focus, .p-textarea:enabled:focus,
.p-select:focus-within, .p-multiselect:focus-within, .p-listbox:focus-within,
.p-datepicker:focus-within, .p-select.p-select-open, .p-multiselect.p-multiselect-open,
.app-search:focus-within {
  border-color: var(--field-border-focus) !important;
  box-shadow: 0 0 0 3px var(--field-ring) !important;
  outline: none !important;
}
.p-disabled, .p-inputtext:disabled { opacity: 0.6; cursor: not-allowed; }

::placeholder, .p-select-label.p-placeholder, .p-multiselect-label.p-placeholder {
  color: var(--field-placeholder) !important; opacity: 1;
}

/* Trailing icons (chevrons, calendar, search glass) — one muted tone */
.p-select-dropdown, .p-multiselect-dropdown, .p-datepicker-dropdown,
.p-inputicon, .app-search i {
  color: var(--field-icon) !important;
  fill: var(--field-icon) !important;
  background: transparent !important;
  border: none !important;
}

/* --- Overlays (select/multiselect/datepicker/autocomplete popups) --- */
.p-select-overlay, .p-select-panel, .p-multiselect-overlay, .p-multiselect-panel,
.p-autocomplete-overlay, .p-datepicker-panel, .p-dropdown-panel, .p-select-list-container {
  background: var(--app-surface) !important;
  color: var(--app-text) !important;
  border: 1px solid var(--field-border) !important;
  border-radius: 0 !important;
}

/* In-overlay filter boxes are fields too */
.p-select-filter, .p-multiselect-filter, .p-autocomplete-filter {
  background: var(--field-bg) !important;
  border: 1px solid var(--field-border) !important;
  border-radius: 0 !important;
  color: var(--field-text) !important;
}
.p-select-filter:focus, .p-multiselect-filter:focus {
  border-color: var(--field-border-focus) !important;
  box-shadow: 0 0 0 3px var(--field-ring) !important;
  outline: none !important;
}

/* --- Options: rest / hover+keyboard-focus / selected --- */
.p-select-option, .p-multiselect-option, .p-listbox-option, .p-autocomplete-option {
  background: transparent !important;
  color: var(--app-text) !important;
  border-radius: 0 !important;
  font-size: var(--field-font-size);
}
.p-select-option:hover, .p-select-option.p-focus,
.p-multiselect-option:hover, .p-multiselect-option.p-focus,
.p-listbox-option:hover, .p-listbox-option.p-focus,
.p-autocomplete-option:hover, .p-autocomplete-option.p-focus {
  background: var(--field-bg-hover) !important;
}
.p-select-option.p-select-option-selected, .p-multiselect-option.p-multiselect-option-selected,
.p-listbox-option.p-listbox-option-selected, .p-autocomplete-option.p-autocomplete-option-selected {
  background: var(--field-bg-active) !important;
  color: var(--app-primary) !important;
  font-weight: 600;
}

/* Chips (multiselect selections) */
.p-multiselect-chip, .p-chip {
  background: var(--app-primary-soft) !important;
  color: var(--app-primary) !important;
  border-radius: 0 !important;
}
```

### 5e. Labels — match on BEM `__label` instead of forcing a new class

Every feature names its label with a `*__label` class; this matches the pattern
so you don't have to retrofit a class onto every component. Adjust the exclusion
list to your own non-field label classes.

```scss
[class*="__label"]:not([class*="stat-label"]):not([class*="radio-label"]):not(.sidenav-item__label),
.app-filter-label, .app-field-label {
  display: block;
  color: var(--label-color) !important;
  font-size: var(--label-size) !important;
  font-weight: var(--label-weight) !important;
  line-height: 1.25rem;
  margin-block-end: var(--label-gap) !important;
}
/* Secondary copy under a label (hints/helper/description) */
[class*="__hint"], [class*="__helper"], [class*="__field-description"], .app-field-hint {
  display: block;
  color: var(--label-desc-color) !important;
  font-size: var(--label-desc-size) !important;
  font-weight: 400 !important;
  margin-block-start: 0.25rem;
}
/* The label owns the gap, so field wrappers must not add their own */
[class*="__field-group"], [class*="__field-wrapper"], .profile-form-grid > div {
  display: flex; flex-direction: column; gap: 0;
}
```

### 5f. Toggle switch — force white handle in all modes

PrimeNG's dark preset tints the handle; this pins it white.

```scss
html body .p-toggleswitch .p-toggleswitch-slider::before,
html body [data-pc-name="toggleswitch"] .p-toggleswitch-slider::before,
.dark .p-toggleswitch .p-toggleswitch-slider::before,
.p-dark .p-toggleswitch .p-toggleswitch-slider::before,
html body .p-toggleswitch .p-toggleswitch-handle,
html body [data-pc-name="toggleswitch"] .p-toggleswitch-handle,
.dark .p-toggleswitch .p-toggleswitch-handle,
.p-dark .p-toggleswitch .p-toggleswitch-handle {
  background: #ffffff !important; background-color: #ffffff !important;
}
html body .p-toggleswitch, html body [data-pc-name="toggleswitch"],
.dark .p-toggleswitch, .p-dark .p-toggleswitch {
  --p-toggleswitch-handle-background: #ffffff !important;
  --p-toggleswitch-checked-handle-background: #ffffff !important;
  --p-toggleswitch-handle-color: #ffffff !important;
  --p-toggleswitch-checked-handle-color: #ffffff !important;
}
```

### 5g. Skeleton loaders (token-driven, mode-aware)

The fill mixes from `--app-border`, so it flips with the mode instead of staying
light grey in dark. Each call site adds a BEM class that sets only its size.

```scss
.app-skeleton {
  display: block;
  background: color-mix(in srgb, var(--app-border) 55%, transparent);
  border-radius: 0.375rem;   /* deliberate exception to square corners: placeholders read as soft */
  animation: app-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.app-skeleton--pill   { border-radius: 999px; }
.app-skeleton--circle { border-radius: 50%; }
.app-skeleton--on-primary { background: color-mix(in srgb, #ffffff 30%, transparent); }
@keyframes app-skeleton-pulse { 50% { opacity: 0.5; } }
```

### 5h. Filters row + custom search box

`.app-search` is a hand-rolled search field that participates in the unified
field system (it's listed in every field selector group above), so it inherits
background/border/height/focus-ring for free. Here's only its own layout.

```scss
/* flex-end keeps controls on one baseline even when a group's label wraps */
.app-filters-row {
  display: flex; align-items: flex-end; justify-content: flex-start;
  gap: 1rem; flex-wrap: wrap; width: 100%;
}
/* gap:0 — the label owns spacing via --label-gap, same as form fields */
.app-filter-group { display: flex; flex-direction: column; gap: 0; }

.app-search {
  display: inline-flex; align-items: center; gap: 0.5rem; width: 16rem;
  padding-block: var(--field-padding-y);   /* inline padding comes from unified field rules */
  i     { font-size: 0.95rem; }
  input { flex: 1; outline: none; }
}
```

Template shape for `.app-search`:
```html
<div class="app-search">
  <i class="pi pi-search"></i>
  <input type="text" [placeholder]="..." [(ngModel)]="..." />
</div>
```

---

## 6. Cross-cutting rules you MUST preserve

1. **Load location.** The tokens + override sheet must be a **global** stylesheet
   (Angular `angular.json` → `"styles": ["src/styles.scss"]`), NOT a component
   `.scss` — component styles are view-encapsulated and can't reach `p-*`
   internals or overlays (overlays render at `<body>`).

2. **`!important` + unlayered.** PrimeNG components live in the `primeng` cascade
   layer (§2). This global sheet is unlayered → beats them. `!important` handles
   the remaining edge cases. Don't wrap this sheet in an `@layer`.

3. **Square corners everywhere** (`border-radius: 0`). The one sanctioned
   exception is skeleton placeholders (§5g). If your brand uses rounded corners,
   change the `0`s to your radius token in one pass.

4. **RTL for free via logical properties.** Everything uses `padding-inline`,
   `margin-inline-*`, `margin-block-*`, `text-align: end` — never `left`/`right`.
   RTL then needs only `html[lang="ar"] { direction: rtl; }` (set `lang` from your
   i18n layer). Do NOT reintroduce physical left/right properties.

5. **Dual class names for PrimeNG version tolerance.** Selector groups list both
   `p-select*` (v18+) and `p-dropdown*` (v17-). Harmless extras on either
   version — keep both so the sheet survives a PrimeNG upgrade/downgrade.

6. **Danger is accent-independent.** `--app-danger` / the `#dc2626` menu-danger
   color do NOT derive from `--app-primary`, so swapping the brand accent never
   recolors a destructive action.

---

## 7. Adapting to a NEW project (the only things you change)

1. **Brand color** → set it in TWO places, kept in sync:
   - `app.config.ts` preset `primary` scale (600 = base).
   - `:root` → `--app-primary`, `--app-primary-rgb` (same color as RGB triplet),
     `--app-primary-700` (darker hover), `--app-primary-gradient`.
2. **Font** → `--font-family` + `@font-face` blocks (if a custom face).
3. **Surface palette / dark values** → the `:root` and `.dark-mode` surface tokens.
4. **Field dimensions** → `--field-height`, `--field-padding-x/y`, `--field-font-size`.
5. **Rounded instead of square?** → replace `border-radius: 0` with your token.
6. **No Tailwind?** → drop the optional Tailwind bridge in §4. Nothing else depends on it.

Everything else is structural and stays as-is.

---

## 8. Verify checklist (after wiring it up)

- [ ] A `p-select`, a text `p-inputtext`, a `p-datepicker` and an `.app-search`
      placed in one `.app-filters-row` are the **same height** and align.
- [ ] Hover shows the darker fill + border; focus/open shows the primary border +
      soft ring; all four control types behave identically.
- [ ] Overlays (select list, multiselect panel, datepicker) use the surface color,
      square corners, and correct option hover/selected states.
- [ ] Primary `p-button` is the brand color and darkens on hover.
- [ ] Add `.dark-mode` on a wrapper → fields, overlays, cards, labels all recolor
      with no per-field override.
- [ ] Set page `dir="rtl"` → padding/icon sides mirror correctly (no left/right leaks).
- [ ] Corners are square everywhere except skeletons.
```
