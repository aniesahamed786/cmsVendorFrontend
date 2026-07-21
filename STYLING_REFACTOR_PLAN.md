# Styling / Token Refactor Plan

Companion to `I18N_RTL_PLAN.md`, same shape: phased, one subagent per phase, a
review gate before anything commits.

## Decisions taken

- **Target**: templates carry **only BEM classes**. No Tailwind utilities, no
  `style=`, no `[ngStyle]`. All appearance lives in the component `.scss`.
- **Colors**: every value is a token. Fallback hexes (`var(--app-primary, #0033a0)`)
  count as hard-coded and go too.
- **Buttons**: `<app-button>` / `<app-back-button>` / `<app-cancel-button>`.
  Per-page button CSS is deleted, not converted.
- **Fields, filters, search, select/multiselect/listbox, labels**: already global
  in `styles.scss`. Per-page copies are deleted, not converted.
- **Tables**: header strip, rows and paginator are one `--app-surface`.
- **Review**: one phase per page, nothing committed until you approve.
- **Authority**: `.claude/skills/style/REFACTOR.md`. `scss-refactor` is now a
  pointer at it, so there is one procedure, not two.
- **Agents**: the general-purpose `claude` subagent, one per phase, with the model
  chosen per phase — **Opus 4.8** where the phase needs judgement, **Sonnet 5**
  where it needs recognition. See *Model selection* below.

---

## Why "delete" beats "convert"

The instinct on a styling refactor is to rewrite each component's CSS in tokens.
On this codebase that is the wrong default, because **275 of the local rules are
re-implementations of something `styles.scss` already does**:

| | Delete the local rule (chosen) | Convert it to tokens |
|---|---|---|
| Diff | net negative, ~1 file per feature | net neutral, every file grows |
| Next restyle | one token edit in `:root` reaches every page | 20 files to re-sweep |
| Drift | impossible — there's one definition | guaranteed, they fall out of sync |
| Dark mode | inherited, already correct | re-verified per component |
| Risk | a page that *needed* its override looks wrong — visible immediately | silent divergence |

So the per-phase question is **"does `styles.scss` already do this?"** before
"what token is this hex?". Only what survives that question gets converted.

The same logic covers the two `@keyframes …ulse` copies (→ `.app-skeleton`) and
the 20 hand-rolled button rules (→ the three button components).

---

## Phase 0 — Foundation — ✅ DONE, awaiting your review

| Done | Detail |
|---|---|
| ✅ | Token engine already in place (`:root`, `.dark-mode`, accent themes, `ThemeService`) — predates this plan |
| ✅ | Global field/filter/label/overlay rules in `styles.scss` — predates this plan |
| ✅ | `ghost` variant added to `<app-button>`; brand-hex fallbacks stripped from `button.css` |
| ✅ | `<app-back-button>` — ghost + left arrow, `label` is an i18n key, RTL flip in `button.css` |
| ✅ | `<app-cancel-button>` — outline, `label` is an i18n key, `disabled` passthrough |
| ✅ | `common.back` added to `en.json` + `ar.json` |
| ✅ | `.app-skeleton` / `.app-skeleton--on-primary` / `@keyframes app-skeleton-pulse` in `styles.scss` |
| ✅ | `style/REFACTOR.md` rewritten — clean-HTML target, scope rules, delete-first step, table rule |
| ✅ | `style/SKELETON.md` written; `number_animation.md` cross-linked from both |
| ✅ | `button/SKILL.md` rewritten for the three components |
| ✅ | `scss-refactor/SKILL.md` reduced to a pointer, contradictions removed |
| ✅ | `npm run build` clean |
| ⬜ | **First call site converted** — `edit-vendor-profile-page` only (1 of 3 back buttons) |

### The contradiction this phase removed

`scss-refactor` used to own the trigger phrase *"remove the hard-coded styling and
tailwind styling"* and told the agent two things that are now false: that layout
utilities may stay in the template, and that `styles.scss` is never to be touched.
An agent asked to clean a page loaded that file, not `REFACTOR.md`. Its unique
content (check the `.ts` for hex, ambiguous color → ask, utilities-override-your-CSS,
`appendTo="body"` overlays must be global) moved into `REFACTOR.md` before it was
gutted.

### The check this phase leaves behind

`npm run build` is the only automated gate, and it catches almost nothing here — a
page can build perfectly and still be white in dark mode. **The real check is the
per-phase visual matrix** (light / dark / national-day / accent-switch / RTL), which
is human. Budget for that; there is no test that replaces it.

Worth adding at some point, not before Phase 1: a spec that greps the touched
folder for hex and utility classes and fails on a hit. Cheap, and it converts the
"re-grep clean" checklist line into something that can't be forgotten.

### The known ceiling

The delete-first rule assumes `styles.scss` genuinely covers the local case. Where
it doesn't — a page that legitimately needs a different field height, say — the
right fix is a **new token**, not a local override. If tokens start multiplying
per-page (`--field-height-branches`), the rule has failed and the component should
keep its scoped override instead. Watch for it around Phase 5.

---

## Clean HTML — the cross-cutting mechanic

The equivalent of the i18n plan's RTL section: the thing every phase touches.

**Corrected inventory.** The headline numbers look worse than the work is:

| Sweep | Raw hits | Actually in scope |
|---|---|---|
| Utility classes in templates | 659 | 659, concentrated in **3 files** |
| `[style.…]` / `[ngStyle]` bindings | 59 | **4** |
| `style="…"` attributes | 8 | 8 |
| Hard-coded hex | 174 | **~55** |
| Local PrimeNG field/table overrides | 275 | 275, mostly deletable |
| `border-radius` / `shadow` | 175 | needs per-case triage |
| Local `@keyframes …pulse` | 2 | 2 |
| Hand-rolled button rules | 20 | 20 |

Three of those deflate on inspection and it matters for sequencing:

- **`[style.…]` is 58/59 the icon-mask pattern** — `[style.webkitMaskImage]` +
  `[style.maskImage]` with a computed SVG path. That is genuinely dynamic and
  `REFACTOR.md` sanctions it. The real offenders are two `[style.color]`, one
  `[style.height]`, one `[style.background]`.
- **119 of the hexes are the engine** — `accent-themes.ts` (37) and `app.config.ts`
  (11) *define* the palettes, plus the sanctioned `#fff`/`#000`/`#dc2626` literals.
  Leave them.
- **The utilities live in 3 files**: `preview-offer-details.html` (305),
  `vendor-preview.html` (225), `offer-form.html` (87). Everything else in the app
  is already utility-free — the messaging-center, Branches, Redemption, Dashboard
  and Analytics templates score **0**.

So this is not a 25-template sweep. It is **~6 cheap delete-phases** plus **3 real
rewrites**.

### What the phases actually do

| Feature | Utilities | Local p-* rules | Hex | Character of the work |
|---|---|---|---|---|
| `offer-form` (shared) | 87 | **127** | 12 | the big one: delete + rewrite + skeleton |
| `preview-offer-details` | **305** | 0 | 0 | pure de-Tailwind |
| `vendor-preview` | **225** | 0 | 5 | pure de-Tailwind |
| `vendor-profile-edit-form` | 25 | 27 | 2 | mixed |
| `recent-activities` | 0 | 17 | 3 | delete-only |
| `offer-list` | 0 | 16 | 0 | delete-only + table rule |
| `branches-page` | 0 | 16 | 7 (in `.ts`) | delete-only + table rule |
| `messaging-center` (5 tpl) | 0 | 20 | 19 | delete-only + table rule |
| dialogs (`vendor-location`, `location-creation`) | 0 | 28 | 4 | delete-only |
| `redemption` | 0 | 10 | 1 | delete-only |
| `analytics-page` | 2 | 8 | 2 | delete-only |

---

## Scope

~16 files carry real hex, 3 carry the utilities, 15 carry local PrimeNG overrides.
`features/vendors/` and `features/setting/` have no templates and no styles — skip
them. `src/app/main-layout/` (navbar, sidenav) has 4 hexes and 2 style bindings and
rides along in Phase 1.

---

## Model selection

Every phase runs on the `claude` subagent. The model is the only thing that varies,
and the split is not about how *much* work a phase is — it's about whether the work
is **judgement** or **recognition**.

**Opus 4.8** when the phase has to decide something that isn't written down yet:

- inventing the semantic structure — a template with 305 utilities has no BEM names
  yet, and picking them badly is a mistake every later phase copies;
- **establishing a pattern** the following phases imitate (Phase 1) or **validating
  an unproven rule** (Phase 3, the first real table);
- judging what is load-bearing before deleting it — 127 override rules in one file,
  where a few genuinely need to stay;
- the rewrite-vs-bridge escape-hatch call (Phases 13–14).

**Sonnet 5** when the pattern already exists and the phase applies it:

- delete-only phases — "does `styles.scss` already do this?" is a lookup, not a
  judgement call;
- mechanical swaps (hand-rolled button → `<app-cancel-button>`, local keyframes →
  `.app-skeleton`);
- hex → token by the mapping table, which is a table.

Two rules that keep this honest:

- **A Sonnet phase that hits an ambiguity stops and asks** rather than deciding.
  That is already brief item 8; the model split makes it load-bearing rather than
  polite.
- **Complexity is measured after the deflation**, not before. Phase 6 looks big at
  5 templates and 19 hexes but every one of those templates already scores 0
  utilities, so it is recognition work. Phase 1 looks trivial at 3 files and goes
  to Opus anyway, because everything after it copies what it does.

Invocation, per phase:

```
Agent(subagent_type: "claude", model: "opus" | "sonnet", prompt: <the brief below>)
```

Run one at a time — not in parallel. Phases share `styles.scss` and the review gate
is sequential by design.

**Escalation is a gate decision, not a mid-phase one.** If a Sonnet phase comes back
with a long "could not verify" list or a pile of questions, re-run that phase on Opus
rather than patching its output by hand — the second run costs less than reviewing a
refactor you don't trust. Two escalations in a row means the split above is wrong for
this codebase and the remaining Sonnet phases should move up.

---

## Context budget — where to compact

**The subagent split is itself the token strategy.** Each phase's file reads, greps
and dead ends happen in the *subagent's* context and are discarded when it finishes.
The main chat grows by the **report only**. So the thing that actually protects the
budget is never doing phase work inline in the main chat — not compaction frequency.

Four rules:

1. **Compact at the gate, after you approve or reject — never mid-phase.** An
   unreviewed finding summarised is a decision made by guesswork. Approve first, then
   compact; the decision is worth keeping, the deliberation isn't.
2. **Write the outcome to this file before compacting.** The plan is the record, not
   the summary. Update the phase row and Phase 0's table with: what was deleted, what
   was kept and why, what couldn't be verified. Then a lossy compaction costs nothing.
   This matters most for the *hex kept and why* lists — exactly what evaporates in a
   summary and gets re-litigated three phases later.
3. **Batch the cheap phases.** Two or three Sonnet delete-phases fit comfortably.
   Compacting between them costs fidelity on the running picture of what's already
   been deleted app-wide, and buys little.
4. **Cap the report** (brief item 10). The report is the only thing that lands in the
   main chat, so an unbounded one defeats rule 1.

### Compaction points

| After phase | Compact | Carry forward into the next window |
|---|---|---|
| 1 Shell | **yes** | the BEM naming conventions chosen — phases 2–14 copy them |
| 2 Redemption | no — batch | — |
| 3 Recent activities | **yes** | the table recipe *as validated*, plus any correction to `REFACTOR.md` Step 4 |
| 4 Branches | no — batch | — |
| 5 Offers list | **yes** | table rule now applied 3×; note any page that legitimately deviated |
| 6 Messaging Center | **yes** | back/cancel swap is complete app-wide after this |
| 7 Analytics | no — batch | — |
| 8 Shared dialogs | no — batch | — |
| 9 Offer sub-forms | **yes** | the full list of deleted override rules so far |
| 10 Vendor profile | **yes** | how the mixed delete+rewrite was sequenced — 11 repeats it bigger |
| 11 **Offer form** | **yes, plus one mid-phase** | which of the 127 overrides survived and why |
| 12 Offer details | **yes** | skeleton migration complete; both local keyframes gone |
| 13 **preview-offer-details** | **yes, plus one mid-phase** | the rewrite-vs-bridge decision and its reasoning |
| 14 **vendor-preview** | **yes** | final re-grep results |

Phases 11, 13 and 14 are large enough to hit the limit mid-phase regardless of
cadence. That mid-phase compaction is unavoidable, not a planning failure — but it
lands inside the *subagent's* context, so it costs you nothing in the main chat.

---

## Phases

One subagent per phase, run one at a time, ending at a review gate. Ordering is
deliberate: **the cheap delete-phases come first** so the delete-first rule is
proven on low-risk surfaces before the three rewrites, and the two preview
components come last because they are the most likely to need your eye.

| # | Target | Tpl | Model | Character | Why that model |
|---|---|---|---|---|---|
| 1 | Shell — navbar, sidenav, layout | 3 | **Opus 4.8** | hex + 2 style bindings; smallest surface, proves the pattern | sets the precedent every later phase copies |
| 2 | Redemption | 1 | Sonnet 5 | delete 10 local `p-*` rules | pure lookup against `styles.scss` |
| 3 | Recent activities | 1 | **Opus 4.8** | delete 17; first table-rule application | validates an unproven rule (open question 1) |
| 4 | Branches | 1 | Sonnet 5 | delete 16, table rule, 7 hexes hiding in the `.ts` | table rule proven in Phase 3 |
| 5 | Offers list | 1 | Sonnet 5 | delete 16, table rule | same shape as Phase 4 |
| 6 | Messaging Center | 5 | Sonnet 5 | delete 20, table rule, 19 hexes, finish the back/cancel swap | 5 templates but all already utility-free |
| 7 | Analytics | 1 | Sonnet 5 | delete 8; check against the `analytics-card` skill | skill already prescribes the answers |
| 8 | Shared dialogs — vendor-location, location-creation, confirmation-pop-up | 3 | Sonnet 5 | delete 28, cancel-button swap | mechanical swap |
| 9 | Offer sub-forms — room, hotel, category/audience dropdowns | 4 | Sonnet 5 | delete 6, cancel-button swap | mechanical swap |
| 10 | Vendor profile — page + edit form | 4 | **Opus 4.8** | delete 27, de-Tailwind 25 | first mixed delete + rewrite; naming judgement |
| 11 | **Offer form** (shared) | 1 | **Opus 4.8** | delete 127, de-Tailwind 87, 12 hexes, skeleton migration, `@keyframes offerFormPulse` | 1899 lines; must judge which overrides are load-bearing |
| 12 | Offer details + `offer-details` skeletons | 3 | Sonnet 5 | 3 hexes, `@keyframes pulse` → `.app-skeleton` | mechanical migration |
| 13 | **`preview-offer-details`** | 1 | **Opus 4.8** | 305 utilities, pure rewrite | invents the BEM structure; bridge-vs-rewrite call |
| 14 | **`vendor-preview`** | 1 | **Opus 4.8** | 225 utilities, pure rewrite | same |

Six Opus phases, eight Sonnet. The Opus phases are 1, 3, 10, 11, 13, 14 — pattern
setters and the three rewrites.

Phases 11–14 are the expensive ones and all four are previews or shared forms —
i.e. exactly where a scoped token bridge is the sanctioned escape hatch if a full
rewrite proves unjustified. Decide that at the gate, per phase, not upfront.

### Per-phase subagent brief

Handed to a `claude` subagent at the model the table assigns. Prepend the phase's
target files; the rest is identical every phase.

1. Read `.claude/skills/style/REFACTOR.md` and follow it. Do not improvise.
2. **Delete first.** For every local rule, ask whether `styles.scss` already does
   it. Convert only what survives.
3. Template ends with **only BEM classes** — no utilities, no `style=`, no
   `[ngStyle]`. Keep the `[style.maskImage]` icon pattern; it is sanctioned.
4. Buttons → `<app-button>` / `<app-back-button>` / `<app-cancel-button>`, labels
   as i18n keys. Delete the CSS they replace.
5. Loading → `.app-skeleton` (`SKELETON.md`) or count-up (`number_animation.md`).
   Delete any local pulse keyframes.
6. Tables → header, rows and paginator on one `--app-surface`.
7. Grep the `.ts` too — hex hides in bindings and per-item metadata.
8. Ambiguous color → **list it and ask**, don't guess.
9. Square corners, no shadows, logical properties for RTL.
10. `npm run build`, then report — **and keep it under ~40 lines**, because the report
    is the only thing that survives into the main chat (see *Context budget*):
    - deleted: rule counts per file, one line each;
    - converted: only what wasn't a straight table lookup;
    - every hex kept, one line each, with the reason;
    - **what it could not verify** — never padded, never omitted;
    - anything that should change in `REFACTOR.md` because reality disagreed with it.

    No file dumps, no diffs, no narration of the steps. If it needs more than 40
    lines, that itself is the finding — say so and stop.

### Per-phase review gate — what I hand you

- Screenshots: the page in **light, dark, and RTL**, plus one accent switched.
- The list of deleted rules, so you can spot anything that was load-bearing.
- Any hex the agent kept, one line each.
- Explicitly: what the agent could **not** verify.

You approve, then that phase commits. **Then the phase row in this file gets its
outcome, and only then do we compact** — see the compaction table above. Then the
next phase starts.

---

## What this plan does not do

- **No visual redesign.** Every page should look *the same* after its phase,
  except where it was wrong in dark mode. If a phase changes the light-mode
  appearance, that's a finding, not a feature.
- **No component consolidation.** `offer-form.css` is 1899 lines and over its
  10 kB budget; splitting that component is a separate job and this plan only
  shrinks the file.
- **No new tokens up front.** Tokens get added when a phase proves one is needed,
  not speculatively.
- **No automated style linting.** Proposed above, deliberately deferred until the
  pattern has survived a few phases.
- **No `p-skeleton` removal** where it already works (`branches-page`) — new work
  uses `.app-skeleton`, existing PrimeNG skeletons are left alone unless the phase
  touches them anyway.

---

## Open questions

1. **The table rule is unverified.** The Step 4 recipe in `REFACTOR.md` is written
   but has never been rendered against a real table. Phase 3 is the first
   application — treat that gate as validating the rule, not just the page.
2. **`preview-offer-details` and `vendor-preview`** — full rewrite, or scoped
   token bridge? 530 utilities between them. The bridge is faster and contained;
   the rewrite is the actual target state. Worth deciding before Phase 13.
3. **`offer-form.css` at 41 kB** blows the 10 kB budget today. Does Phase 11 aim
   to get under budget, or just to remove the 127 override rules and accept it?
4. **Do the 175 `border-radius`/`shadow` hits get triaged per phase, or in one
   sweep?** Per phase keeps diffs reviewable; a sweep is faster and more
   consistent. My default is per phase, matching everything else here.
