# Refactor process — migrating an existing project to this style

This is the **migration playbook**, kept separate from `SKILL.md` on purpose:

- `SKILL.md` = the styling **rules** — use it when building new pages/components.
- `REFACTOR.md` (this file) = the **process** for converting an *existing* same-stack
  project to the token system. Only needed when refactoring; ignore it for greenfield pages.

Assumes the target shares the stack: **Angular + PrimeNG + `@primeuix/themes` + SCSS**. If it
doesn't, only the token philosophy transfers, not the concrete selectors.

---

## Step 0 — Install the engine first

Nothing below works until the three engine files exist in the target, because every token
reference (`var(--app-*)`) resolves against them:

1. `src/styles.scss` — the `:root` token declarations + `.dark-mode` / `.national-day-mode`
   overrides + global PrimeNG normalization (square corners, `box-shadow: none`).
2. `src/app/shared/theme/accent-themes.ts` — the `ACCENT_THEMES` catalog.
3. `src/app/shared/services/theme.service.ts` — the runtime applier.

Copy these from the reference project verbatim, then confirm:

- Tailwind v4 present (or remove the Tailwind-specific bits if the target has no Tailwind).
- PrimeNG + `@primeuix/themes` installed (`updatePrimaryPalette` import resolves).
- `ThemeService` is provided (`providedIn: 'root'`) and instantiated once at app start so
  `initializeTheme()` runs.
- The font + any themed background asset (e.g. `founding321.png`) are copied, or the
  `--font-family` / `--app-bg-art` values adjusted.

**Verify the foundation before touching components:** toggle dark mode and switch an accent —
the app chrome (bg, text) should already respond. If it doesn't, fix the engine first.

---

## Step 1 — Inventory the hard-coded styling

Find everything that bypasses the token system. Useful sweeps (adjust globs to the target):

```bash
# hard-coded hex colors in templates and styles
grep -rEn '#[0-9a-fA-F]{3,8}' src/app --include=*.html --include=*.scss --include=*.css

# tailwind color utilities that should become tokens
grep -rEn '\b(bg|text|border)-(white|black|gray|slate|zinc|neutral)-[0-9]{2,3}\b' src/app --include=*.html

# arbitrary-value color utilities
grep -rEn '\[(bg|text|border)?-?#?[0-9a-fA-F]{3,8}\]' src/app --include=*.html

# rounded corners (candidates to remove)
grep -rEn 'rounded|border-radius' src/app --include=*.html --include=*.scss

# box-shadows on inputs/cards (candidates to remove)
grep -rEn 'shadow|box-shadow' src/app --include=*.html --include=*.scss
```

Group the hits by component and by the role each color plays (background / surface / text /
muted / border / primary). Roles, not raw hexes, drive the mapping in Step 2.

---

## Step 2 — Map hexes → tokens

Translate by **role**, using the default (blue) values as the recognition key. Match by intent
even if the source hex differs slightly.

| Source (typical) | Role | Token |
|------------------|------|-------|
| `#F6F6F8`, page greys | page background | `var(--app-bg)` |
| `#ffffff`, `bg-white` | raised surface (card/dialog/input) | `var(--app-surface)` |
| `#111827`, `#1F2937`, `text-gray-900`, `text-black` | primary text | `var(--app-text)` |
| `#6b7280`, `#94A3B8`, `text-gray-500/600`, `text-slate-400` | secondary text | `var(--app-muted)` |
| `#e5e7eb`, `border-gray-200`, `border-slate-200` | border / divider | `var(--app-border)` |
| `#0033A0`, `#003CC7`, `#0537A4` | brand / primary | `var(--app-primary)` |
| `#002C8A`, `#03297d` | primary hover/darker | `var(--app-primary-700)` |
| `rgba(0,51,160,0.08)`, `#EEF2FF` | soft brand fill / selected | `var(--app-primary-soft)` |
| `rgba(0,51,160,0.13)` | subtle brand fill | `var(--app-primary-subtle)` |
| `rgba(0,51,160,0.16)` | focus ring | `var(--app-primary-ring)` |
| input fill (off-white) | field background | `color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%)` |
| subtle hover (off-surface) | option/row hover | `color-mix(in srgb, var(--app-surface) 86%, var(--app-border) 14%)` |
| brand gradient | hero / banner | `var(--app-primary-gradient)` |

Allowed exceptions (do **not** tokenize): `#fff`/`#000` as on-primary contrast text, and
validation red (`text-red-500` / `#dc2626`). Everything else gets a token.

---

## Step 3 — Choose a conversion mode per component

Two valid approaches — pick per component, don't mix randomly:

- **A. Rewrite to SCSS (preferred for owned/simple components).** Replace utility/styling
  classes in the template with semantic `__bem` classes, and write the rules in the
  component `.scss` using tokens. This is the end state `SKILL.md` teaches.
- **B. Scoped token bridge (for large mirrored markup, e.g. previews/forms).** Keep the
  existing markup, add a root class, and re-map the old utilities → tokens **scoped under that
  root** (see the preview/offer-form bridge blocks in `SKILL.md`). Faster, contained, but
  leaves utilities in place — use only when a full rewrite isn't worth it.

Rule of thumb: small/custom UI → rewrite; big legacy screens you're mirroring → bridge.

---

## Step 4 — Apply the rules

Now follow `SKILL.md` for the actual work. Per component, in order:

1. Backgrounds → `--app-surface` (raised) / `--app-bg` (page).
2. Text → `--app-text` / `--app-muted`.
3. Borders → `--app-border`.
4. Brand (buttons, links, active, selected) → `--app-primary*`.
5. **Remove every `border-radius`** unless explicitly justified (phone bezel, avatar, a
   product-required pill) — square is the house rule.
6. **Remove `box-shadow`** except the sanctioned focus ring
   (`0 0 0 2px var(--app-primary-ring)`).
7. Fields → the `__field` + `__overlay-panel` recipe (the field cheat-table in `SKILL.md`).
8. Pop-ups → the `p-dialog` recipe; force `.p-dialog*` square via `::ng-deep`.

---

## Step 5 — Verify (the matrix)

A token refactor is only correct if it survives every axis. For each refactored screen check:

- **Light mode** — looks right, no leftover hard greys.
- **Dark mode** — toggle it; surfaces/text/borders flip correctly, nothing stays white.
- **National-day mode** — chrome still legible over the bg art.
- **Accent switch** — change accent (e.g. blue → purple); all brand color follows, no fixed
  blue left behind.
- **RTL** — if the screen has Arabic, direction modifiers (`--rtl`) behave.
- **Corners** — no stray rounded elements.
- **Focus** — fields show the border-color focus (no glow); radios/checkboxes show the ring.

Re-grep (Step 1 sweeps) over the touched files — ideally zero color hexes remain except the
allowed exceptions.

---

## Quick checklist

1. Engine files in place and verified (dark + accent already respond). 
2. Inventory of hard-coded colors / utilities / radii / shadows done.
3. Each hex mapped to a token by role.
4. Per component: rewrite-to-SCSS or scoped-bridge chosen.
5. Rules from `SKILL.md` applied (surface/text/border/primary, square, no shadow).
6. Verified across light / dark / national-day / accent-switch / RTL.
7. Re-grep clean (only `#fff`/`#000` contrast + validation red remain).
