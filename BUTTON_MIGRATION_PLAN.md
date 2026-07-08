# Button migration plan — for Gemini

Migrate hand-rolled buttons to the shared `<app-button>` component
(`src/app/shared/Components/button/`) **without changing how any button looks**.

## The one rule that matters

`<app-button>` renders exactly ONE of two looks (see `button.css`):

- **primary** — `background: --app-primary`, white text, square, `height 2.5rem`,
  `padding 0 1rem`, `gap .5rem`, `font 1rem/600`, hover `--app-primary-700`.
- **outline** — `background: --app-surface`, `--app-primary` text + border, square,
  same box metrics, hover `--app-primary-hover-soft`.

**Only replace a button whose current CSS is byte-for-byte this spec.** If any property
differs (height 2.75rem, `text-sm`, `rounded-full`, `py-2.5`, different colors, an icon,
`pButton`, transparent/borderless, absolute-positioned) → **leave it alone.** A swap that
changes pixels fails the task. When unsure, diff the old class against `button.css` first;
if it isn't identical, skip it.

## DO migrate (confirmed identical — 4 buttons, 2 files)

| File | Line | Button | variant | notes |
|------|------|--------|---------|-------|
| `src/app/features/Offers/pages/offer-details/offer-details.html` | 16 | `.offer-detail__outline-button` (Raise ticket) | `outline` | keep `(click)="raiseTicket()"`; drop `pRipple` |
| `src/app/features/Offers/pages/offer-details/offer-details.html` | 22 | `.offer-detail__primary-button` (Edit offer) | `primary` | keep `(click)="navigateToEditOffer()"`; drop `pRipple` |
| `src/app/features/Profile/pages/edit-vendor-profile-page/edit-vendor-profile-page.html` | 18 | `.edit-profile-draft-btn` | `outline` | keep `(click)="triggerSaveDraft()"` |
| `src/app/features/Profile/pages/edit-vendor-profile-page/edit-vendor-profile-page.html` | 21 | `.edit-profile-update-btn` | `primary` | keep `(click)="triggerUpdateChanges()"` |

Both `.edit-profile-*` classes are the exact app-btn spec (`edit-vendor-profile-page.css:56-84`);
both `.offer-detail__*-button` classes are too (`offer-details.scss:59-109`).

## Per-site steps

For each file above:

1. **Import** the component in the page's `.ts`:
   ```ts
   import { Button } from '<relative-path>/shared/Components/button/button';
   // then add Button to the standalone component's `imports: [...]`
   ```
   Relative paths:
   - offer-details.ts → `../../../../shared/Components/button/button`
   - edit-vendor-profile-page.ts → `../../../../shared/Components/button/button`
   (verify the depth — count `../` to `src/app/`.)

2. **Replace the markup.** Keep the same text, `(click)`, and any `[disabled]`. Example:
   ```html
   <!-- before -->
   <button pRipple class="offer-detail__primary-button" (click)="navigateToEditOffer()">
     Edit offer
   </button>
   <!-- after -->
   <app-button variant="primary" (click)="navigateToEditOffer()">Edit offer</app-button>
   ```
   If the original text sat in a `<span>` with an icon `<i class="pi ...">`, pass the icon
   via `[icon]="'pi pi-...'"` and put the bare text in the content.

3. **Delete the now-dead CSS.** Remove the migrated class blocks from the `.scss`/`.css`
   (`.offer-detail__outline-button`, `.offer-detail__primary-button`,
   `.edit-profile-draft-btn`, `.edit-profile-update-btn`) — but ONLY if no other element
   still uses the class (grep the class name across the repo first).

4. Leave every other button in the file untouched.

## DO NOT migrate (different look or not a plain button)

Leave all of these as-is — swapping them would change the design:

- `offer-form.html` `.offer-form__draft-button` — **height is 2.75rem, not 2.5rem**, and the
  paired submit is a PrimeNG `pButton`. Not identical → skip.
- Any `pButton` / `p-button` (file-upload, cropper, Add Room, submit-with-icon) — PrimeNG, out of scope.
- Pill buttons (`rounded-full`, `px-4 py-2 text-sm`) in `offer-form.html`.
- Dialog footer cancel/submit in `vendor-location-dialog.html`, `location-creation-offer.html`
  (`px-4 py-2.5 text-sm border` — different metrics).
- `messaging-center-create-ticket.html` `.create-ticket__btn--cancel/--submit` (own styling).
- Navbar profile menu items, sort buttons (`analytics-page`), tab buttons + redeem/branches
  (`preview-offer-details`), `.offers__export`, `.offers__row-action`, quick-action cards,
  `.vendor-profile-page__edit-btn` (transparent, white, borderless), back buttons, toggle buttons,
  `.vendor-form-social-action`, `.mc-list__new-btn`.

If you think one of these *should* look like primary/outline, that's a design change — do NOT
do it under this task; flag it separately.

## Verify before declaring done

1. `npm run build` (or `ng build`) — no template/import errors.
2. Visually confirm the 4 migrated buttons render identical to before (same size, color,
   hover, position). The whole point of the task is zero visual change.
3. Confirm no deleted CSS class is still referenced anywhere (grep each removed class name).

## Scope summary

- **4 buttons migrate** (offer-details ×2, edit-vendor-profile ×2).
- Everything else stays. This is deliberately small — most "buttons" in this app are not
  the primary/outline CTA and must not be forced into the component.
