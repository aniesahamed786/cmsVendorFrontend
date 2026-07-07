---
name: button
description: How to use the reusable <app-button> component (primary/outline variants, optional PrimeIcon) instead of hand-rolling button markup + CSS. Use whenever adding, changing, or reviewing buttons (submit, action, edit, cancel, CTA) in a component template.
---

# Button component (`<app-button>`)

Standalone Angular component at `src/app/shared/Components/button/`. Wraps a native
`<button>` with the app's two button styles (token-driven, square corners). Use it
instead of writing new `.scss` button rules per component.

## Import

```ts
import { Button } from '../../../shared/Components/button/button';
// adjust the relative path to your component's depth

@Component({ imports: [Button, /* ... */] })
```

## Usage

```html
<!-- primary (default) -->
<app-button (click)="save()">Save</app-button>

<!-- outline -->
<app-button variant="outline" (click)="cancel()">Cancel</app-button>

<!-- with icon + submit type -->
<app-button variant="primary" type="submit" [icon]="'pi pi-pencil'">Edit</app-button>

<!-- disabled -->
<app-button [disabled]="form.invalid" (click)="submit()">Submit</app-button>
```

## API

| input      | type                     | default     |
|------------|--------------------------|-------------|
| `variant`  | `'primary' \| 'outline'` | `'primary'` |
| `type`     | `'button' \| 'submit'`   | `'button'`  |
| `disabled` | `boolean`                | `false`     |
| `icon`     | `string` (PrimeIcon cls) | —           |

Click is the **native DOM event** — just use `(click)="…"`. No `@Output`.
Button text goes in the projected content (`<ng-content>`).

## Styling

Do not restyle it per call site. It reads `--app-primary`, `--app-primary-700`,
`--app-primary-hover-soft`, `--app-surface` (with brand-color fallbacks), so it
tracks the active accent theme automatically. If you need a genuinely new look,
add a variant to `button.css`, not a one-off override.

Not built (add only when a real call site needs it): size variants, loading
spinner, icon-only mode, `@Output` events.
