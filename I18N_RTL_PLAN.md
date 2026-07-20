# Arabic / English + RTL Plan

## Decisions taken

- **i18n**: runtime JSON dictionaries, mirroring `~/OfferApp` — your call, after
  we first built and then reverted the `@angular/localize` version. See below.
- **RTL**: from CSS only. No `dir` attribute written by hand for page direction.
- **Arabic copy**: subagents draft it; you review at each phase gate.
- **Review**: one phase per page, nothing committed until you approve.

---

## Why runtime JSON and not `@angular/localize`

Phase 0 was built twice. The first version used official Angular i18n; you saw
that it produced no `en.json`/`ar.json` to point at and asked why it didn't look
like OfferApp. It couldn't — `@angular/localize` is **build-time**: one compiled
bundle per locale, XLIFF catalogs instead of JSON, and switching language means
navigating to `/ar/` with a full page reload.

The runtime approach we settled on instead:

| | Runtime JSON (chosen) | `@angular/localize` (reverted) |
|---|---|---|
| Switch | instant, signal-driven, no reload | full page reload, unsaved form state lost |
| Files | `public/assets/i18n/{en,ar}.json` | `messages.xlf` + `messages.ar.xlf` |
| Deploy | one bundle | two bundles + nginx locale routing |
| Dev | unchanged | `ng serve` runs one locale at a time |
| Missing key | renders the raw key | build error |
| Cost | impure pipe re-runs per change-detection cycle | none at runtime |

The two real downsides of the choice are in the last two rows. The parity spec
(below) covers the first. The second is a known ceiling, not a bug — see
*Performance* below.

**Matching OfferApp buys more than consistency**: its `ar.json` already fixes
the terminology this app was going to have to invent. `Vendor` → `البائع` — an
option I hadn't even offered, having weighed only `المورّد` and `التاجر`.

---

## Phase 0 — Foundation — ✅ DONE (runtime version), awaiting your review

| Done | Detail |
|---|---|
| ✅ | `I18nService` — signal dict, localStorage persistence, `{{param}}` interpolation, en fallback |
| ✅ | `TranslatePipe` — impure, reads `lang()` + `loadSeq()` so switches propagate |
| ✅ | `provideAppInitializer` blocks bootstrap until the dictionary loads |
| ✅ | `public/assets/i18n/{en,ar}.json` seeded with the navbar |
| ✅ | `html[lang="ar"] { direction: rtl }` — verified in the built CSS |
| ✅ | Arabic font hook on the same selector |
| ✅ | Shell logical properties (`styles.scss`, `navbar.css`, `sidenav.css`) |
| ✅ | Language switcher in the navbar profile menu, navbar fully translated |
| ✅ | `i18n.spec.ts` — 4 tests, passing |
| ✅ | Build clean |
| ✅ | Arabic font — fallback accepted, text scaled down via `font-size-adjust` |
| ✅ | Glossary settled: aligned to OfferApp, Highlight skipped, Store→Branch done |

### Reverted cleanly

`angular.json`, `tsconfig.app.json`, `nginx.conf`, `package.json`,
`package-lock.json` are back to their committed state; `src/locale/` is gone.
Nothing from the localize experiment survives except the RTL and font work,
which was approach-independent.

`node_modules/@angular/localize` is still on disk — `package.json` no longer
references it, so a fresh `npm ci` drops it. Harmless meanwhile.

### The check this phase leaves behind

`src/app/shared/i18n/i18n.spec.ts` — the smallest thing that fails if the
dictionary logic breaks:

1. flatten produces dotted paths
2. **both languages have identical key sets** — the failure mode that matters,
   since a key added to `en.json` and forgotten in `ar.json` silently renders
   the raw key string on the Arabic page
3. no Arabic value is still the English string
4. `{{param}}` placeholders match across languages

Two test files in the repo fail already and are unrelated to this work:
`app.spec.ts` (the Angular scaffold's `Hello, ...` assertion, never updated) and
`offer-form.spec.ts` (a PrimeNG `CascadeSelect` circular-init error).

### Performance — the known ceiling

`pure: false` means the pipe re-evaluates on every change-detection cycle for
every translated string. OfferApp runs this at 445 keys without trouble, so it
is not a launch risk. If a heavy page (Phase 5's offer form, ~90 strings) gets
janky, the upgrade path is a `computed()` per component rather than a pipe —
worth knowing about, not worth pre-building.

---

## RTL

`I18nService` sets only `<html lang>`. `styles.scss` turns that into direction:

```css
html[lang="ar"] { direction: rtl; }
```

Per your "RTL from CSS, not HTML" rule. One caveat worth stating plainly: the
CSS `direction` property drives layout and the bidi algorithm correctly, but it
is *not* exposed to screen readers or to `:dir()` — only the `dir` attribute is.
Setting `document.documentElement.dir` alongside `lang` is one line in
`applyLang()` if you decide the a11y signal matters more than the rule.

**Corrected inventory.** The original count of 37 was `.scss` only and missed
every `.css` file — the real surface is **~110 declarations**:

| Physical | Logical |
|---|---|
| `text-align: right` / `left` | `text-align: end` / `start` |
| `padding-right` / `left` | `padding-inline-end` / `start` |
| `margin-right` / `left` | `margin-inline-end` / `start` |
| `right:` / `left:` | `inset-inline-end` / `start` |
| `border-radius: 0 x x 0` | `border-start-end-radius` etc. |

The bulk sits in `offer-form.css` (~25), `vendor-form.css` (~17) and
`branches-page.scss` (~9), so it lands inside the per-page phases rather than a
big-bang sweep — which is where it belongs.

**Not every one converts.** Several `text-align: right` rules sit on classes
applied to Arabic data fields that already carry `dir="rtl"` (e.g.
`.offer-form__input--right`). Those are content alignment, not layout, and each
needs a per-case judgement — exactly what the per-page review gates are for.

Tailwind v4 utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`)
are already logical-aware — the classes in your templates need auditing, not the
Tailwind config.

### The existing `dir` attributes stay

There are ~20 hardcoded `dir="rtl"` / `dir="ltr"` attributes in templates. **Do
not remove them.** They are a different thing from page direction:

- `dir="rtl"` on an Arabic *data* field (`seasonAr`, `getHighlightTitleAr()`) —
  correct. Marks known-Arabic content inside an English page.
- `dir="ltr"` on phone numbers and discount amounts — correct and load-bearing.
  Without it, `05412345434` and `50% Discount` render with digits and the `%`
  in the wrong order once the page goes RTL.

Content direction is a property of the content. Page direction comes from CSS.
Subagents are briefed on this distinction explicitly — it is the single easiest
thing for them to get wrong.

### The Ghawar font has no Arabic glyphs — accepted

All seven `.OTF` files are 45–49 KB, i.e. Latin-only, so Arabic falls back to a
system Arabic face. You accepted the fallback. Because that face renders visibly
larger than Ghawar at the same size, Arabic text is scaled down one step:

```css
html[lang="ar"] { font-size-adjust: 0.47; }
```

`font-size-adjust` normalises rendered glyph height, so it shrinks **text only**.
The obvious alternative — `font-size: 87.5%` on `<html>` — would have been wrong
here: this codebase has **730 rem-based** padding/margin/gap declarations against
**9 px-based** ones, so shrinking the root just zooms the whole UI out and leaves
text proportionally as large as before.

A literal "2xl → xl" Tailwind step is not reachable either: there are ~300
hardcoded `font-size` rules in component CSS against 39 Tailwind `text-*`
classes, so a utility-level override would only reach 12% of the text.

0.47 is a visual knob, not a derived constant — eyeball it against the English
page and nudge. Lower is smaller.

---

## Scope

~440 UI strings across 25 templates. Zero UI strings in `.ts` files (verified) —
except the `navItem` labels in `sidenav.ts` and the `userRole` placeholder in
`navbar.ts`, both handled in Phase 1.

---

## Phases

Each page phase is one subagent, run one at a time, ending at a review gate.
Nothing is committed until you approve.

| # | Page | Templates | Strings |
|---|---|---|---|
| 1 | Shell — sidenav, navbar, layout | 3 + `sidenav.ts` | ~9 |
| 2 | Dashboard | 2 | ~6 |
| 3 | Vendor Profile | 4 | ~29 |
| 4 | Offers list | 1 | ~32 |
| 5 | **Offer form** (shared) | 1 | ~90 |
| 6 | Offer sub-forms — room, hotel, location | 3 | ~35 |
| 7 | Offer details + preview | 3 | ~33 |
| 8 | Branches | 1 | ~29 |
| 9 | Redemption | 1 | ~16 |
| 10 | Messaging Center | 3 | ~30 |
| 11 | Analytics | 1 | ~21 |
| 12 | **Vendor form** (shared) | 1 | ~64 |

Ordering is deliberate: Phase 1 proves the pattern on the smallest surface;
Phases 5 and 12 are the big shared forms and come after the pattern is settled;
Phase 5 lands before 6 and 7 because they share vocabulary with it.

Each phase owns one top-level object in the JSON (`offers.*`, `redemption.*`),
so phases never edit the same region and the diffs stay reviewable.

### Per-phase subagent brief

1. Replace every user-visible string in that page's templates with
   `{{ 'page.key' | translate }}`, including placeholders and `aria-label`s.
2. Add the keys to **both** `en.json` and `ar.json`, nested under the page key.
3. Draft Arabic using `src/app/shared/i18n/GLOSSARY.md`. Reuse `~/OfferApp`'s
   `ar.json` wording for any term that exists there.
4. Import `TranslatePipe` into the component.
5. Audit that page's CSS for physical properties the Phase 0 sweep missed.
6. Audit that page's Tailwind classes for `pl-/pr-/ml-/mr-/text-left/text-right`.
7. **Leave content-level `dir` attributes alone** (see above).
8. Run `ng test` — the parity spec must stay green.
9. Report: strings translated, terms not in the glossary, layout that breaks
   mirrored, anything it could not verify.

### Per-phase review gate — what I hand you

- Screenshots: the page in `en` and in `ar`.
- The Arabic strings as a plain list, for you to correct.
- Any glossary additions the agent needed.
- Explicitly: what the agent could **not** verify.

You approve, then that phase commits. Then the next phase starts.

---

## What this plan does not do

- **No RTL-mirrored icons.** Directional icons (back arrows, chevrons) need
  `html[lang="ar"] & { transform: scaleX(-1); }`. Deferred to a cleanup pass
  after the pages land, since the icon set is small and shared.
- **No date/number/currency localization.** `I18nService.locale()` exposes
  `ar-SA`/`en-US` for the `date` and `number` pipes, but no template uses it
  yet. Arabic-Indic numerals (`٥٠` vs `50`) are a separate decision.
- **No API-side language.** The backend already returns `nameAr`/`nameEn` pairs.
  Whether the Arabic UI should prefer `_ar` fields is a real question this plan
  does not answer. Worth deciding before Phase 4.

---

## Store → Branch rename — done, separate from i18n

Ran before the page phases so their JSON keys are named `branches.*` from the
start rather than renamed later. The Stores feature was fully self-contained —
nothing outside it imported from the folder — so the rename was local.

Renamed: `features/Stores/` → `Branches/`, `stores-page.*` → `branches-page.*`,
`StoresPage`/`StoresService`/`StoreKPIs`/`StoreRow` → `Branches…`/`Branch…`,
the `stores-page__*` BEM prefix, route `/stores` → `/branches`, the sidenav link,
Redemption's "Store" label and its `store` control → `branch`, and stray copy in
Dashboard, vendor-preview and offer-details ("…at the store." → "…at the branch.",
Arabic "في المتجر" → "في الفرع").

Left alone on purpose: **"In-Store"** (a channel, the opposite of Online — and
`'in store'` is the literal API payload value in `OfferModePayload`) and
**`MessagingCenterStore`** (a state container). See the glossary.

## Open questions

1. **Data fields** — should the Arabic UI display `nameAr` over `nameEn`?
2. **Numerals** — Western (`50`) or Arabic-Indic (`٥٠`)?
3. **`font-size-adjust: 0.47`** — needs an eyeball pass against the English page.
