---
name: pagentation
description: How to add pagination to tables/lists in this CMS admin app — both PrimeNG p-table server-side lazy pagination (the offer-list/vendor-list pattern) and client-side p-paginator over in-memory rows. Use whenever adding paging, page-size options, or a paginator to any table or list.
---

# Pagination guide

Two patterns live in this codebase. Pick by **where the data is**.

| Data source | Pattern | Reference |
|-------------|---------|-----------|
| Backend, fetched one page at a time | **Server-side lazy** `p-table` | `offer-list-page`, `vendor-list-page` |
| Already fully in memory (e.g. derived/computed rows) | **Client-side** `p-paginator` + `slice` | `vendor-analytics` |

`PaginatorModule` and `TableModule` are both re-exported by `core/prime.import.ts`
(`PrimeUIModules`) — import that, don't add per-component PrimeNG imports.

Square corners (no `border-radius`) apply to the paginator like everything else;
the global `styles.scss` overrides already force `.p-paginator` selects square.

---

## Pattern A — server-side lazy `p-table`

Use when the backend paginates (`getXPaginated({ page, pageSize, searchTerm, ... })`
returning `{ data, total, page, pageSize }`). The table never holds more than one page.

State (signals):

```ts
currentPage = signal(1);
currentPageSize = signal(10);
loading = signal(false);
total = signal(0);
rows = signal<Row[]>([]);
tableTotalRecords = computed(() => this.total());
```

Template — `[lazy]="true"`, drive `first`/`rows` from the signals, handle `onLazyLoad`:

```html
<p-table [value]="rows()" [lazy]="true" [paginator]="true"
  [totalRecords]="tableTotalRecords()"
  [first]="(currentPage() - 1) * currentPageSize()"
  [rows]="currentPageSize()" [rowsPerPageOptions]="[5, 10, 20, 50]"
  [loading]="loading()" (onLazyLoad)="onTablePage($event)"
  paginatorDropdownAppendTo="body">
  ...
</p-table>
```

Handler — convert PrimeNG's `first`/`rows` into 1-based page, refetch only on change:

```ts
onTablePage(event: TableLazyLoadEvent) {
  const page = event.first != null && event.rows != null
    ? Math.floor(event.first / event.rows) + 1 : 1;
  const pageSize = event.rows ?? this.currentPageSize();
  if (page !== this.currentPage() || pageSize !== this.currentPageSize()) {
    this.loadPage(page, pageSize);
  }
}

loadPage(page: number, pageSize: number) {
  this.loading.set(true);
  this.service.getXPaginated({ page, pageSize, /* + filters */ }).subscribe({
    next: (res) => {
      this.rows.set(res.data);
      this.total.set(res.total);
      this.currentPage.set(res.page);
      this.currentPageSize.set(res.pageSize);
      this.loading.set(false);
    },
    error: () => this.loading.set(false),
  });
}
```

When a filter/search changes, reset to page 1: `this.loadPage(1, this.currentPageSize())`.
`onLazyLoad` also fires once on init, so a separate initial fetch is usually unneeded —
but match whatever the page you're editing already does.

Sorting integrates through the same event (`event.sortField` / `event.sortOrder`) — see
`offer-list-page.ts` `mapSortField`/`mapSortOrder`.

---

## Pattern B — client-side `p-paginator`

Use when rows are already all in memory (a `computed()` over fetched/derived data) and
you only need to page the view. Don't fake a server round-trip.

State + paged slice:

```ts
first = signal(0);
pageRows = signal(10);
readonly pagedRows = computed(() =>
  this.filteredRows().slice(this.first(), this.first() + this.pageRows()),
);
```

Reset to the first page whenever the underlying list changes (filter/search/sort), so
you never strand the user on an empty page:

```ts
private resetPage(): void { this.first.set(0); }
```

Template — iterate the **paged** slice, add the paginator over the **full filtered** length:

```html
@for (row of pagedRows(); track row.id) { ... }

<p-paginator [first]="first()" [rows]="pageRows()"
  [totalRecords]="filteredRows().length" [rowsPerPageOptions]="[5, 10, 20, 50]"
  (onPageChange)="first.set($event.first); pageRows.set($event.rows)" />
```

`onPageChange` gives `{ first, rows, page, pageCount }` (`PaginatorState`).
Keep the empty-state check against `filteredRows().length`, not the paged slice.

---

## Gotchas

- **PrimeNG `first` is a row offset, not a page index.** Page = `first / rows + 1`.
- **`onLazyLoad` fires on init** — guard refetches with a change check or you double-load.
- **Resetting page on filter change is mandatory** — otherwise filtering down to 2 rows
  while on page 5 shows a blank table.
- **Don't mix the patterns.** If the data is fully in memory, server-lazy `p-table`
  just adds dead `onLazyLoad` plumbing; if it's backend-paged, client `slice` only pages
  the one page you fetched.
