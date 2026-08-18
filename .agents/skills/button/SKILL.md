---
name: button
description: How to use the reusable button components (<app-button>, <app-back-button>, <app-cancel-button>) instead of hand-rolling button markup + CSS. Use whenever adding, changing, or reviewing buttons (submit, action, edit, back, cancel, CTA) in a component template.
---

# Button components

Three standalone components under `src/app/shared/Components/`. Together they cover every
button in the app — writing new `.scss` button rules per component is the thing they exist
to prevent.

| Component | Folder | Look |
|---|---|---|
| `<app-button>` | `button/` | primary / outline / ghost |
| `<app-back-button>` | `back-button/` | ghost + left arrow (RTL-flipped) |
| `<app-cancel-button>` | `cancel-button/` | outline |

## `<app-button>`

```ts
import { Button } from '../../../shared/Components/button/button';
@Component({ imports: [Button, /* ... */] })
```

```html
<app-button (click)="save()">{{ 'x.save' | translate }}</app-button>
<app-button variant="outline" (click)="preview()">…</app-button>
<app-button variant="primary" type="submit" [icon]="'pi pi-pencil'">…</app-button>
<app-button [disabled]="form.invalid" (click)="submit()">…</app-button>
```

| input      | type                                  | default     |
|------------|---------------------------------------|-------------|
| `variant`  | `'primary' \| 'outline' \| 'ghost'`   | `'primary'` |
| `type`     | `'button' \| 'submit'`                | `'button'`  |
| `disabled` | `boolean`                             | `false`     |
| `icon`     | `string` (PrimeIcon cls)              | —           |

Text goes in the projected content. `ghost` is the transparent/muted look that
`<app-back-button>` is built on — reach for it directly only for something back-button-like
that isn't a back button (e.g. a dialog close).

## `<app-back-button>` and `<app-cancel-button>`

Thin wrappers over `<app-button>`. Their only input is the label, and **it is an i18n key**,
so each page names its own destination or action:

```ts
import { BackButton } from '../../../shared/Components/back-button/back-button';
import { CancelButton } from '../../../shared/Components/cancel-button/cancel-button';
```

```html
<!-- defaults: common.back / common.cancel -->
<app-back-button (click)="goBack()" />
<app-cancel-button (click)="onCancel()" />

<!-- page-specific wording -->
<app-back-button label="offerForm.backToOffers" (click)="goBack()" />
<app-back-button label="profile.backToProfile" (click)="goBack()" />
<app-cancel-button label="offerForm.cropper.cancel" (click)="cancelCrop()" />
<app-cancel-button [disabled]="saving()" (click)="onCancel()" />
```

| input      | type      | default          |
|------------|-----------|------------------|
| `label`    | i18n key  | `common.back` / `common.cancel` |
| `disabled` | `boolean` (cancel only) | `false` |

The back arrow flips in RTL automatically (`:host-context(html[lang="ar"])` in
`button.css`) — don't add a `flex-direction: row-reverse` at the call site.

Back-button navigation stays in the component: `(click)="goBack()"` calling an explicit
`router.navigate([...])`, not `history.back()`. See the
[page-chrome skill](../page-chrome/SKILL.md) for where the back button sits on the page.

## Rules

- **Never hand-roll a button.** No `<button class="page__btn">` + CSS, no `pButton`, no
  `<p-button>` for these three looks. Refactors delete those — see
  [REFACTOR.md](../style/REFACTOR.md) Step 3.
- Click is the **native DOM event** — `(click)="…"`. No `@Output`.
- Don't restyle per call site. All three read `--app-primary`, `--app-primary-700`,
  `--app-primary-soft`, `--app-primary-hover-soft`, `--app-muted`, `--app-border`,
  `--app-surface`, so they track the active accent theme. Need a genuinely new look? Add a
  variant to `button.css`.
- No fallback hexes in `var()` — the tokens are always defined; a fallback is a stale color
  that survives an accent switch.

Not built (add only when a real call site needs it): size variants, loading spinner,
icon-only mode, `@Output` events.
