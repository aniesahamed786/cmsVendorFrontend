# Font changes by Ali Almakhluk (2026-09-20 → 2026-09-22)

Commits: `f01605f8` `cb9181d6` `57ba3c12` `ba1267dc` `a9d9342e` `fd027882` `0471b179` `2a9e4ab8`

## The rule (apply this to the vendor page)

| Text role | font-family | font-weight |
|---|---|---|
| Big numbers / KPI values | `"Manifa Pro 2", var(--font-family)` | 700 |
| Page / hero titles, entity names | `"Manifa Pro 2", var(--font-family)` | 600 |
| Card titles, labels, badges, trend chips | `var(--font-family)` (Ghawar) | 700 (tiles/analytics) or 600 (detail pages) |
| Subtitles, descriptions, meta text | `var(--font-family)` | 400 |
| Detail-page field label + value | `var(--font-family)` | 600 |
| Buttons | global, don't touch | 600 |
| Sidenav labels | `"Ghawar Hefty"` | 300 |

`font-size` barely changed. Mostly family + weight.

## Global (`src/styles.scss`), already in place

- `@font-face` added: **Ghawar** 600 (SEMIBOLD) and 700 (BOLD), **Ghawar Hefty** 300, **Manifa Pro 2** variable 100–900.
- `button, .p-button-label { font-family: var(--font-family) !important; font-weight: 600 !important; }`
- Text color: `--app-light-text: #4C444E`, `--app-text: #323232` (was `#111827`).

## Per file

### Vendors
`vendors/pages/vendor-detail-page/vendor-detail-page.css`: **only the hero was done**
- `.vendor-detail__hero-name`: Manifa Pro 2, 400 → 600 (size 2.25rem unchanged)
- next selector (Arabic hero name): Manifa Pro 2, 400 → 600 (size 1.875rem)

`analytics/pages/vendor-analytics/vendor-analytics.css`
- `.analytics-kpi-card__value`: Manifa Pro 2, 700
- `.analytics-kpi-card__label`: Ghawar, 700

### Dashboard
- `quick-actions.css` hero value: Manifa, 1.25rem/600 → **1.5rem/700**; `.quick-actions__label` Ghawar
- `dashboard-page.css`: `__title` Manifa 700; `__subtitle` 400; `__section-title`, `__activity-title` Ghawar 600; `dashboard-scheduled-card__value` 700 → 600; `__label` 600
- `sidenav.css`: brand Manifa **1.25 → 1.375rem**, 600 (the separate name/role weights were removed); `.sidenav__label` Ghawar Hefty, 500 → 300

### Shared tiles
- `offer-tile.css`: `__value` Manifa; `__title` 600 → 700; `__subtitle` 400; trend chip 500 → 700
- `tile.css`: `__value` Manifa; `__label` 600 → 700; `__subtitle` 400

### Analytics
- `offer-analytics.css` and `overview-analytics.css`: an appended block at the end of each file. All `*value` classes get Manifa 700, titles/labels/badges get Ghawar 700, desc/subtitle/meta get 400.
- `user-analytics.css`: several labels 600 → 700, muted text 500/600 → 400; values (`overview-kpi-value`, `overview-cost-value`, `performance-summary-value`, …) Manifa 700
- `analytics-page.css`: tab 500 → 600

### Detail pages
- `offer-details-page.css`: `__title--split` Manifa 600; Arabic split title `row-reverse` + 600; riyal icon 2rem → 1.5rem
- `banner-view-page.css`: hero title Manifa 700 → 600, Arabic hero title Manifa 600; card title `--app-primary` color, 600; description, field label, field value all **600** (value was 500)
- `request-offer-details.css`: same as offer-details (`__title--split` Manifa 600)
- `request-edit-page.css`: `__title` 600, `__subtitle` 600

### Settings
- `setting-app-features.css`: `__row-title` 500 → 600

## Vendor page to-do
1. Hero names: done.
2. Section/card titles: Ghawar 600, and use the `--app-primary` color like the banner view.
3. Field labels + values: Ghawar 600.
4. Descriptions/meta: 400.
5. Any stat/count numbers: Manifa Pro 2 700.
