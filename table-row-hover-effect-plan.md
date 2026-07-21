# Table Row Hover Effect — Portable Spec

Self-contained. Nothing here depends on any other file, framework, or design system.

## What the effect does

On hovering a table row, four things change together over 160ms:

1. Row lifts 1px (`translateY(-1px)`)
2. A 3px accent bar appears on the row's left edge (inset box-shadow, not a border — no layout shift)
3. Every cell gets a very faint accent tint background
4. The title cell's text turns accent-colored (200ms, slightly slower so it trails the row)

Everything animates. Nothing reflows.

## Required markup

- Each `<tr>` needs the class `row`
- The cell text you want to recolor needs the class `row-title`

```html
<table class="hover-table">
  <tbody>
    <tr class="row">
      <td><span class="row-title">Some title</span></td>
      <td>Other cell</td>
    </tr>
  </tbody>
</table>
```

## Drop-in CSS (no variables, no dependencies)

Accent color here is `#0033A0`, surface is white. Change those two and you have it.

```css
/* Row: animate lift + edge bar */
.hover-table tbody > tr.row {
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

/* Cells: animate their own background separately */
.hover-table tbody > tr.row > td {
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

/* Hover: lift + left accent bar */
.hover-table tbody > tr.row:hover {
  transform: translateY(-1px);
  box-shadow: inset 3px 0 0 #0033A0;
}

/* Hover: faint accent tint on cells */
.hover-table tbody > tr.row:hover > td {
  background: rgba(0, 51, 160, 0.032);
}

/* Title text: accent on hover, slightly slower */
.row-title {
  color: #111827;
  transition: color 200ms ease;
}

.hover-table tbody > tr.row:hover .row-title {
  color: #0033A0;
}
```

## Themeable variant (light/dark)

Same effect, driven by four variables. Swap the `:root` block for your own tokens.

```css
:root {
  --accent: #0033A0;
  --accent-rgb: 0, 51, 160;
  --surface: #ffffff;
  --text: #111827;
}

.dark {
  --surface: #111827;
  --text: #e5e7eb;
}

.hover-table tbody > tr.row {
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.hover-table tbody > tr.row > td {
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.hover-table tbody > tr.row:hover {
  transform: translateY(-1px);
  box-shadow: inset 3px 0 0 var(--accent);
}

.hover-table tbody > tr.row:hover > td {
  background: color-mix(in srgb, rgba(var(--accent-rgb), 0.08) 40%, var(--surface) 60%);
}

.row-title {
  color: var(--text);
  transition: color 200ms ease;
}

.hover-table tbody > tr.row:hover .row-title {
  color: var(--accent);
}
```

The `color-mix` line is the exact tint math: take an 8%-alpha accent, blend 40% of it with 60% of the surface. On white that lands at ~`#F7F8FC`. On a dark surface it stays proportionally subtle — that's why it's a mix and not a fixed color.

## Values to tune

| Value | What it controls | Safe range |
|---|---|---|
| `160ms` | Row lift + tint speed | 120–220ms |
| `200ms` | Title color speed | keep ≥ row duration so it trails |
| `translateY(-1px)` | Lift amount | -1px to -2px; more looks jumpy in a dense table |
| `inset 3px 0 0` | Left bar thickness | 2–4px |
| `0.08` alpha / `40%` mix | Tint strength | raise the mix % to strengthen |

## Integration gotchas

**Cell backgrounds must be transparent or explicitly overridden.** If your rows/cells already set an opaque `background`, the hover tint on `td` will be covered or will lose to specificity. Either give `td` a transparent default, or match the specificity of the existing rule.

**Zebra striping conflicts.** `tr:nth-child(even) td { background: ... }` has equal-ish specificity and will fight the hover rule. Put the hover rule after it, or raise its specificity (`tbody > tr.row:hover > td`, already done here).

**Component-library tables (PrimeNG, MUI, AntD) render their own row markup.** Two adjustments: (a) target their generated row class instead of / in addition to `.row`, (b) the styles must escape component style encapsulation — in Angular that means `::ng-deep`, in Vue `:deep()`, in CSS Modules `:global()`. Scoped styles will silently not apply otherwise.

**`transform` on `<tr>`** works in all current browsers but creates a stacking context — if you have sticky columns or overlays inside rows, verify their z-order still looks right. If it breaks, drop the `translateY` and keep the other three changes; the effect still reads.

**Reduced motion.** Add if your project honors it:

```css
@media (prefers-reduced-motion: reduce) {
  .hover-table tbody > tr.row,
  .hover-table tbody > tr.row > td,
  .row-title {
    transition: none;
  }
  .hover-table tbody > tr.row:hover {
    transform: none;
  }
}
```

## Verification

Hover a row and confirm all four: lift, left bar, cell tint, title color — and that column widths don't shift. If the row jumps horizontally, something replaced the inset shadow with a real border.
