# Skeleton + count-up unification plan

Goal: **one term** for every loading affordance in the app — one CSS dialect, one flag
convention, one count-up helper, one a11y treatment. This plan unifies what already exists;
it does **not** add loading states to pages that never had one (see Appendix B).

---

## 0. The decision — RESOLVED

There is no conflict. `SKELETON_PATTERN.md` does not exist: not in the working tree, not
anywhere in git history (`git log --all -- SKELETON_PATTERN.md` → empty). The only references
to it were inside this plan.

**`.claude/skills/style/SKELETON.md` is the sole standard**, by default rather than by choice.
Items 2 and 7 stay in scope: the messaging-center thread spinner still converts to skeleton
bubbles, because SKELETON.md says "never a centered spinner on a page that has a known shape".

Button spinners are the one sanctioned exception — now written into SKELETON.md itself, since
that was the only rule the missing doc carried that the house skill did not.

---

## 1. The single standard (what "one term" means)

**CSS** — `.app-skeleton` (global, `src/styles.scss:596`) carries fill + pulse.
Modifiers: `--pill`, `--circle`, `--on-primary`. Size only, in the component's own `.scss`,
via a BEM class. No `p-skeleton`. No local `@keyframes`. No inline `style="width:…"`.

**Flag** — one `signal(false)` *per data source*, set before the call, cleared in
`.pipe(finalize(…))`. Never infer loading from `arr().length === 0`.
Cache-gate anything that refetches: `loading() && !hasLoadedFor(id)`.

> Note: not `complete` — it never fires after `error` and pins the skeleton forever.
> `finalize` everywhere.

**Numbers** — count-up (`number_animation.md`), not skeleton, for a number in a fixed slot.
Skeleton and count-up are **sequential**: skeleton while the card's whole contents are absent,
count-up kicked off in the same callback that clears the flag. Never both at once.

**Bars** — no breakdown/progress bars exist in this repo today (verified by grep). When one
lands, its width reads the same `animated()` map as its number so bar and digits move together
(`segmentWidthPct` pattern). Nothing to build now.

**a11y** — `role="status" aria-live="polite"` + an `.sr-only` label on the skeleton wrapper,
`aria-hidden="true"` on the placeholder blocks. **Currently zero occurrences app-wide.**

**Reference implementation**: `request-center-list.ts` / `.html` / `.scss`. Copy from there.

---

## 2. Gap table

| Feature | Dialect | Flag | Count-up | a11y | Verdict |
|---|---|---|---|---|---|
| `request-center-list` | `.app-skeleton` | `finalize` ×2 | ✅ | ❌ | reference; a11y only |
| `request-detail` / `request-edit` | `.app-skeleton` | `finalize` | — | ❌ | a11y only |
| `analytics-page` | `.app-skeleton` | `finalize` | ✅ | ❌ | uniform column widths (item 5) |
| `offers` (offer-list) | `.app-skeleton` | fake timer, flagged | ✅ | ❌ | fine; timer marked `DELETE WHEN THE API IS WIRED` |
| `offer-details` (page + component) | `.app-skeleton` | real, but `set(false)` ×2 | — | ❌ | → `finalize`; delete dead lines 97–99 |
| `branches-page` | **mixed**: `p-skeleton` KPIs + `.app-skeleton` rows/table | real | ✅ | ❌ | item 1 |
| `view-branch` | `p-skeleton` | real | — | ❌ | item 1 |
| `branch-form` | `p-skeleton` | real | — | ❌ | item 1 |
| `offer-form` (shared) | `p-skeleton` ×~28 | real | — | ❌ | item 1, the bulk |
| `messaging-center-list` | `.app-skeleton` | fixed last session | — | ❌ | a11y only |
| `messaging-center-ticket-details` | **spinner** | fixed last session | — | ❌ | item 2 |

---

## 3. Work items, by phase

Five phases. Each one is independently shippable and independently reviewable — stop after any
of them and the app is in a consistent state. The order is by dependency, not by size.

| Phase | Items | Touches | Why here |
|---|---|---|---|
| **0 — Decide** ✅ done | 7 (docs) | this plan, `SKELETON.md` | Conflict was with a doc that doesn't exist; standard defaulted to SKELETON.md and the button-spinner exception moved into it |
| **1 — Foundation** ✅ done | 3, 6a, 9-directive | `shared/animation/count-up.ts`, `shared/directives/img-fallback.directive.ts`, `styles.scss`, one new SVG | The three shared pieces land *before* the files that will use them, so nothing gets converted twice. Write the directive here, roll it out in phase 4 |
| **2 — Dialect** ✅ done | 1 | `branches-page`, `view-branch`, `branch-form`, `offer-form` | The dark-mode bug. Biggest diff, zero logic change — reviewable as pure markup |
| **3 — Behaviour** | 2, 4, 5 | `messaging-center-ticket-details`, `offer-details`, `analytics-page` | Real logic/markup fixes; small, each independent of the others |
| **4 — Polish** | 6b, 8, 9-rollout | every file phase 2–3 touched, + messaging-center, + 38 `<img>` tags | a11y, the tab/ticket fade, and the image-placeholder rollout — applied once at the end so they aren't re-done per file mid-refactor |

Phase 4 is the biggest by file count (the image rollout alone is ~20 templates), so it can be
split per feature and shipped incrementally — the directive from phase 1 works on any subset.

Phase 1 before phase 2 matters: converting `branches-page` while its `animateTo` is still local
means editing that file twice. Phase 4 after 2–3 for the same reason.

Phases 2 and 3 are independent of each other — parallelisable if two people are on it.

---

### Phase 0 — settle the doc conflict ✅ done

### 7. Reconcile the docs
Nothing to reconcile — the second doc was never in this repo. Done instead:
- section 0 above rewritten to record that;
- the button-spinner exception added to `.claude/skills/style/SKELETON.md`, which otherwise
  says "not a spinner" flatly and would have flagged `button.html` in Appendix A;
- ghost-doc citations removed from §1 and Appendix A.

---

### Phase 1 — foundation (do before touching feature files) ✅ done

Landed: `shared/animation/count-up.ts` (+ spec), the four call sites swapped, the global
reduced-motion block, `shared/directives/img-fallback.directive.ts` (+ spec),
`public/assets/svg/shared/image-placeholder.svg` and the `.app-img-fallback` class.
Net −62 lines. Zero template changes — the four pages keep calling `animatedCount(key)`
because the delegate is a closure field, so phase 4's a11y pass is the only HTML edit left.

The placeholder SVG is a **CSS mask, not an `<img src>`**: a custom property can't cross into
an SVG document, so `--app-border` is unreachable through `src` and the "no hard-coded grey"
rule would have been unsatisfiable. The directive swaps `src` to a transparent 1×1 GIF and
lets `.app-img-fallback` paint the glyph.

### 3. Extract the count-up helper
`animateTo` + `animatedCount` are duplicated **verbatim in 4 files**
(`offers.ts:114/131`, `branches-page.ts:259/264`, `analytics-page.ts:185/199`,
`request-center-list.ts:40/52`). `number_animation.md` itself says extract at the third copy.

→ `src/app/shared/animation/count-up.ts`, ~25 lines, one class or a factory returning
`{ animatedCount, animateTo }`. Keeps the `prefers-reduced-motion` short-circuit (already in
all 4 copies — do not lose it). Four files each delete ~25 lines.

Leaves one check behind: the helper is non-trivial (rAF loop + easing + reduced-motion branch),
so it gets one small spec asserting the target value is reached and that reduced-motion jumps
straight to it.

### 6a. Global reduced-motion opt-out
Add the `prefers-reduced-motion` block for `.app-skeleton`'s pulse in `styles.scss`. Four
component `.scss` files already have one; the global skeleton does not.

---

### Phase 2 — one CSS dialect ✅ done

Landed: all 34 `<p-skeleton>` tags gone — `branches-page.html` (3), `view-branch.html` (4),
`branch-form.html` (5), `offer-form.html` (22). Each is now a `<span class="app-skeleton …">`
with its size in the component stylesheet; `borderRadius="0"` dropped everywhere.
`SkeletonModule` removed from `core/prime.import.ts` — **zero `p-skeleton` left app-wide**, so
no component still needs it. Also deleted the now-orphaned spacing shims
`branches-page__skel-mt{,-sm}`, `branch-view__mb-2`, `branch-form__mb-2`, `offer-form__mb-2`,
whose margins moved into the label/value size classes.

### 1. `p-skeleton` → `.app-skeleton` (the actual "two dialects" problem)
~35 call sites in 4 files. `p-skeleton`'s grey comes from the PrimeNG preset, **not** from
`--app-border` — it does not track dark mode. That, not the corners, is why it goes.

- `branches-page.html:57-59` (KPI cards — 3 tags). Note `STYLING_REFACTOR_PLAN.md` previously
  fenced these off; this plan supersedes that fence since unification is the whole point.
- `view-branch.html:112-119` (4)
- `branch-form.html:161-171` (5)
- `offer-form.html:558, 1248-1310` (~28) — biggest single chunk, do it last.

Each `<p-skeleton width="Xrem" height="Yrem">` becomes `<span class="app-skeleton
<block>__skeleton-<name>">` with the size moved into the component `.scss`. Drop
`borderRadius="0"` — skeletons are the sanctioned exception to square corners.
Drop the `Skeleton` import from each component once the file is clean.

---

### Phase 3 — behaviour fixes (independent of each other)

### 2. Messaging-center thread: spinner → skeleton bubbles
`messaging-center-ticket-details.html:76-80`. Reuse the real `mc-details__message` row class
with a `--skeleton` modifier (SKELETON.md "reuse the real row"), 3 bubbles, alternating
incoming/outgoing so it reads as a thread. Also: the hardcoded `Loading messages…` string goes
(every other string in that file uses `| translate`).

### 4. `finalize` everywhere
`offer-details.ts:291/294` sets the flag twice instead of once in `finalize`. Sweep for any
other `set(false)` in both `next` and `error`.

### 5. Analytics table skeleton: per-column widths
`analytics-page.html:170-178` loops one `table-skeleton` class across all 6 columns — equal
bars read as a placeholder grid, not as content. Give each column its own width modifier, as
`request-center-list.html:122-128` already does (`--id`, `--text`, `--wide`, `--date`,
`--pill`, `--action`).

---

### Phase 4 — polish

### 6b. a11y pass (applies to every file touched above)
Wrapper gets `role="status" aria-live="polite"` and an `.sr-only` translated label;
placeholder blocks get `aria-hidden="true"`. Zero files have this today. Done once at the end
so it isn't re-applied per file mid-refactor.

### 8. Fade transition between tabs and tickets
Separate concern from loading — this is what happens **after** the data is there. Without it
the tab switch and the ticket switch are instant content swaps, which read as a flicker,
especially next to a skeleton that fades.

Two places, one keyframe:

- **Tab switch** (All / Unread / Read in `messaging-center-list.html`) — the card list swaps
  wholesale.
- **Ticket switch** (`messaging-center-ticket-details.html`) — the whole detail pane swaps.

CSS-only will not replay on a signal change: the DOM nodes are reused, so no animation
re-triggers. The lazy fix is to make the block **keyed on the thing that changed** so Angular
destroys and recreates it:

```html
@for (tab of [activeTab()]; track tab) {
  <div class="mc-list__cards mc-list__cards--enter"> … </div>
}
```

```scss
&--enter { animation: mc-fade-in 180ms ease-out; }

@keyframes mc-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mc-list__cards--enter, .mc-details__body--enter { animation: none; }
}
```

Notes:
- **Fade-in only, no fade-out.** A true out→in cross-fade needs the old content held on screen
  while the new one is absent, which means either Angular's `@animate.leave` or a manual
  double-buffer. 180 ms of in-only reads as smooth and costs 6 lines; add the leave half only if
  the in-only version actually looks abrupt to you.
- 180 ms, `ease-out` — long enough to register, short enough not to feel like waiting. Anything
  over ~250 ms starts to feel like lag on a tab click.
- `translateY(4px)` not a slide — a fade with a hint of motion; a real slide fights the RTL
  layout, which would need the direction flipped per locale.
- Reduced-motion opt-out is mandatory, same rule as the skeleton pulse and the count-up.
- Do **not** apply the enter animation to the skeleton branch — a skeleton fading in while it
  pulses is two animations on one element.

### 9. Image placeholder — missing image, and image that fails to load
An `<img>` is a loading affordance too, and today it is the **fourth dialect**. Audit of 38
`<img>` tags:

| What exists | Where | Problem |
|---|---|---|
| per-image error signal + `@else if` branch | `offer-details.html/.ts` (6 images) | one bespoke `mark…Error()` method per image — `markOfferMobileImageError`, `markHighlightDesktopImageError`, `markCategoryIconError`… |
| `.preview-offer-details__img-fallback` + `pi pi-image` | `preview-offer-details.html` | the right *look*, but local to one component |
| `(error)="$event.target.remove()"` | `preview-offer-details.html:38` | **bug** — rips the node out from under Angular; the layout collapses instead of reserving the box, and a re-render puts it back |
| nothing at all | **30 tags** — `offers.html:115` (row logo), `vendor-hero-card`, `vendor-preview`, `request-detail` profile images, `offer-form` previews, mc file preview | broken-image glyph, or an empty gap when the field is null |

**One directive replaces all four.** `src/app/shared/directives/img-fallback.directive.ts`,
standalone, `selector: 'img[appImgFallback]'`, ~30 lines. It covers the three states in one
place, which is what makes this part of the unification and not a separate feature:

| State | Trigger | Render |
|---|---|---|
| absent | `src` null / empty / whitespace | placeholder, box reserved |
| loading | src set, no `load` event yet | **`.app-skeleton` on the img box** — the same global class as every other skeleton |
| failed | `(error)` fires | placeholder, box reserved |

The loading row is the integration: an image is layout-shaped, so per SKELETON.md it skeletons
rather than spinning, and it reuses `.app-skeleton` rather than inventing a fifth fill.

Notes / traps:
- **No placeholder asset exists** (`find public -iname "*placeholder*"` → nothing). Add one:
  `public/assets/svg/shared/image-placeholder.svg`, drawn to match the `pi pi-image` glyph
  `preview-offer-details` already uses, and filled from `--app-border` like the skeleton so it
  flips in dark mode. Do **not** hard-code a grey.
- **`object-fit`.** Most of these imgs are `cover`. A placeholder glyph under `cover` gets
  cropped to nonsense — the directive's failed/absent class must force `contain` and centre it.
- **Never collapse the box.** The whole point is that the layout is identical whether the image
  loads or not; that is also what makes it safe to swap in mid-render.
- **`alt` still matters.** The directive must not clear it — a failed decorative image is
  `alt=""`, a failed meaningful one still needs its text. Leave the attribute alone.
- Delete the six `mark…Error()` methods and their signals from `offer-details.ts`, and the
  `$event.target.remove()` line, as the directive lands. A converted file must not keep both.
- Cached images fire `load` before the directive's listener attaches in some browsers — check
  `img.complete` in `ngOnInit` so a cached image never sticks in the skeleton state. This is the
  one bit of the directive that needs the runnable check.

---

## Appendix A — verification

- `grep -rn "<p-skeleton" src/` → must return **nothing** after item 1.
- `grep -rn "pi-spin" src/` → only `shared/Components/button/button.html` (the sanctioned
  exception in SKELETON.md — feedback belongs in the control you clicked).
- `grep -rn "@keyframes" src/ | grep -i "pulse\|shimmer"` → only `app-skeleton-pulse`.
- `grep -rn "DELETE WHEN THE API IS WIRED" src/` → only `offers.ts` (still fake, known).
- `grep -rn "<img" src/ | grep -v appImgFallback | grep -v "src=\"assets/"` → nothing; static
  `assets/svg/…` icons are bundled and can't 404, they don't need the directive.
- `grep -rn "target.remove()\|mark.*ImageError\|markOfferImageFailed" src/` → nothing.
- Manual: throttle to offline in devtools and reload a page with row logos — every image box
  must hold its size and show the placeholder, with **no layout shift** versus the loaded state.
- `npx tsc -p tsconfig.app.json --noEmit` clean; check every touched page in **both** dark and
  light mode — the whole point of dropping `p-skeleton` is the dark-mode fill.

## Appendix B — NOT in this pass

22 templates have no loading state at all. Adding them is a different job (each needs a real
service call to hang a flag on), and folding it in would triple the diff:

`dashboard-page`, `vendor-quick-actions`, `vendor-profile-page`, `edit-vendor-profile-page`,
`vendor-profile-edit-form`, `vendor-hero-card`, `vendor-preview`, `profile-settings`,
`redemption`, `recent-activities`, `create-offer`, `edit-offer`, `create-branch`, `edit-branch`,
`hotel-details`, `offer-hero-card`, `preview-offer-details`, `room-creation-offer`,
`create-ticket`, `messaging-center-create-ticket`, `messaging-center` (page shell), `login`.

Of these, `redemption` and `recent-activities` are the ones a user actually waits on — likely
first candidates for a follow-up pass.
