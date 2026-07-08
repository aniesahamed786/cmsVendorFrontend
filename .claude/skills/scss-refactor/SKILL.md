---
name: scss-refactor
description: Procedure for refactoring a feature folder in this CMS vendor app from Tailwind utilities and hard-coded colors to SCSS with design tokens. Use whenever asked to "remove the hard-coded styling and tailwind styling" from a component/feature, de-Tailwind a page, or convert legacy styling to the token system. The style skill says WHAT the values are; this skill is the step-by-step HOW.
---

# SCSS refactor playbook (de-Tailwind a feature)

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

Companion to the [style skill](../style/SKILL.md) — read that first for the token
vocabulary and per-element recipes. This file is the repeatable procedure for the
recurring task: *"Remove the hard-coded styling and tailwind styling in `@<feature>`,
use the style skill."*

## Scope rules (learned the hard way)

1. **Only touch the folder you were given.** Never edit `src/styles.scss` or
   `accent-themes.ts` during a feature refactor unless explicitly asked.
2. **Structure stays, colors go.** Tailwind *layout* utilities (`flex`, `grid`, `gap-*`,
   `p-*`, `w-full`…) may stay if rewriting them isn't requested — the target is **color,
   border, background, shadow, and radius** utilities plus hard-coded hex values.
3. **Ambiguous color → ask, don't guess.** If a hex doesn't map cleanly to a token
   (is `#7c3aed` "brand" or "a deliberate purple"?), list it and ask before converting.

## Procedure

### 1. Inventory
```bash
grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\(|bg-(white|gray|slate|blue|red)|text-(gray|slate|white|black)|border-(gray|slate)|shadow|rounded' src/app/features/<feature> --include='*.html' --include='*.css' --include='*.scss' --include='*.ts'
```
Check the `.ts` too — colors hide in `[style.color]` bindings and data arrays
(e.g. category metadata with per-item hex).

### 2. Map hex → token
The common ones in this codebase:

| Found | Replace with |
|-------|--------------|
| `#ffffff`, `bg-white` (surface) | `var(--app-surface)` |
| `#0f172a`, `#111827`, `text-slate-900` | `var(--app-text)` |
| `#64748b`, `#94a3b8`, `#667085`, `text-slate-500` | `var(--app-muted)` |
| `#e2e8f0`, `#e5e7eb`, `#EEF2F6`, `border-slate-200` | `var(--app-border)` |
| `#0033a0`, `#0033A0`, brand blue | `var(--app-primary)` |
| `rgba(0, 51, 160, 0.xx)` fills | `var(--app-primary-soft/-subtle/-ring)` or `rgba(var(--app-primary-rgb), 0.xx)` |
| light gray fills (`#f8fafc`, `bg-gray-50`) | `color-mix(in srgb, var(--app-surface) 84%, var(--app-border) 16%)` |
| error red `#dc2626` / success green `#16a34a` / `#fff` on primary | **keep** — sanctioned literals |

### 3. Convert
- Give elements semantic classes (`.offer-card__title`), move rules into the component
  stylesheet. **Tailwind classes in the HTML override your CSS file** — removing them from
  the template is part of the fix, not optional (this bit highlight-form-data).
- PrimeNG controls: `styleClass="<root>__field"` + `panelStyleClass` for overlays, themed
  per the style skill recipes. Overlay panel classes go in the *component's* styles only
  if not `appendTo="body"`; otherwise they must be global — flag it if so.
- Component-scoped tokens (the `--ui-*` aliasing in `analytics/style.scss`) are fine —
  alias once on the page root, use the alias below.

### 4. Verify (all four, every time)
1. `npm run build` passes (the PostToolUse hook runs it, still read its output).
2. **Light mode** looks unchanged.
3. **Dark mode** — every converted surface/text/border follows; no white cards, no black-on-black.
4. Corners still square; no new `border-radius` snuck in from a PrimeNG default.

Report any hex you deliberately kept and why (one line each).
