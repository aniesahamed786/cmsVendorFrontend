---
name: analytics-table
description: The analytics performance-table pattern in this CMS vendor app — client-side sortable columns, category/status/location filters (country→city cascade), search, CSV export button, header tooltips, and row-click routing to detail pages. Reference is the Vendor Performance table. Use whenever adding a sortable/filterable/exportable data table to an analytics page.
---

# Analytics table pattern ("Vendor Performance" style)

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

Reference: `vendor-analytics.ts/.html` (Vendor Performance table). For pagination
specifics use the [pagentation skill](../pagentation/skill.md) (this table is its
"client-side" pattern). Colors per the [style skill](../style/SKILL.md).

## State — signals + one computed

All filtering/sorting is client-side over the fetched rows; only search may hit the
backend (debounced Subject → API). Filter the *data*, never PrimeNG's filter API.

```ts
selectedCategory = signal<string | null>(null);   // null = "All"
searchQuery = signal('');
sortField = signal<keyof Row | null>(null);
sortOrder = signal<1 | -1>(1);
first = signal(0);        // paginator
pageRows = signal(10);

readonly filteredRows = computed(() => {
  let rows = this.rows();
  const cat = this.selectedCategory();
  if (cat) rows = rows.filter((r) => r.category === cat);
  const field = this.sortField();
  if (!field) return rows;
  const order = this.sortOrder();
  return [...rows].sort(/* numeric compare when both numbers, else localeCompare */);
});
```

`toggleSort(field)`: same field → flip order; new field → set field, order `1`.
`sortIcon(field)`: `pi-sort` (inactive) / `pi-sort-up` / `pi-sort-down`.

## Header

Toolbar row above the table: title on the left; on the right the filter
`p-select`s (with an explicit "All …" `null` option — never disabled), the search input,
and the Export button — **all the same height** (`h-10`).

```html
<th class="… cursor-pointer select-none" (click)="toggleSort('views')">
  Views <i class="pi text-[10px]" [ngClass]="sortIcon('views')"></i></th>
```

- Every sortable column shows its sort icon; unsortable columns (e.g. Category when
  requested) simply omit `(click)` + icon.
- Column definition tooltips: `pTooltip="…" tooltipPosition="top"` on the `<th>` plus a
  `pi pi-info-circle` icon (see "Potential redemption").
- Numeric cells: right-aligned, `tabular-nums`.

## Location filter (country → city cascade)

Two `p-select`s fed from the locations data (as in the control-center):
- Country select with "All countries" (`null`).
- City select is **never disabled**; with no country it lists all cities
  ("All cities" option included). Picking a country narrows the city options.
- No clear-"x" chips — resetting is done by picking the "All …" option.

## Export (CSV)

One reusable method per page — copy `exportFigureCsv` from `vendor-analytics.ts`:
builds `string[][]` matrix → CSV string (quote-escape, `﻿` BOM for Excel) → Blob →
temp `<a download>`. The table's Export button exports the **filtered+sorted** rows
(`filteredRows()`), header row first:

```html
<p-button label="Export" icon="pi pi-download" severity="secondary"
  styleClass="rounded-none h-10" (onClick)="exportTable()" />
```

## Rows

- Row click routes to the entity's detail page (`router.navigate(['/offers', row.id])`
  or vendor details) with `cursor-pointer` on the row — no hover background beyond the
  house `--app-primary-hover-soft` if any.
- Loading: skeleton rows (5×) inside the real `<tr>` structure so the column widths hold.
- Entity cell: thumbnail/logo image with a placeholder fallback + name; keep a
  `failedLogos` set so a broken image swaps to the placeholder once.
