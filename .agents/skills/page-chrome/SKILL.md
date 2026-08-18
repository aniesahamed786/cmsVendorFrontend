---
name: page-chrome
description: The canonical back-button and edit/create page header pattern in this CMS vendor app, aligned across banner, highlight, notification, offer, and vendor edit/create pages. Reference is edit-vendor-details. Use whenever adding a back button, page top bar, or building a new edit/create/detail page shell.
---

# Page chrome (back button + edit/create page shell)

> Copied from cmsAdminFrontend. The reference file paths below live in `~/cmsAdminFrontend-1/`; apply the same patterns to this repo's local equivalents.

Canonical reference: `src/app/features/vendors/pages/edit-vendor-details/`
(`edit-vendor-details.html` + `.css`). The banner/highlight/notification/offer
edit+create pages were all aligned to this — new pages copy it, they don't improvise.

## The back button

```html
<div class="w-full flex flex-row gap-3 items-center mb-6 px-1">
  <button type="button"
    class="<page>__back-button inline-flex h-10 items-center justify-center gap-2 px-4 cursor-pointer transition-colors duration-200"
    (click)="goBack()">
    <i class="pi pi-arrow-left text-sm"></i>
    <span class="text-md font-normal">Back to <Section></span>
  </button>
</div>
```

```css
.<page>__back-button {
  background: transparent;
  border: 1px solid var(--app-border);
  border-radius: 0;
  color: var(--app-muted);
}
.<page>__back-button:hover {
  background: var(--app-primary-soft);
  border-color: var(--app-primary);
  color: var(--app-primary);
}
.<page>__back-button i,
.<page>__back-button span { color: inherit; }
```

Rules:
- Ghost button: transparent fill, `--app-border` stroke, muted text; hover flips to
  primary-soft fill + primary border/text. Square corners.
- Label reads "Back to <plural section>" ("Back to Vendors", "Back to Offers").
- A dialog/panel "×" close button gets the **same hover treatment** as the back button.
- `goBack()` navigates to the list route (explicit route, not `history.back()`).

## Page shell

- Root: `<feature>-edit flex flex-col min-h-screen`; top bar first, then content.
- Edit pages with preview: `flex flex-col lg:flex-row gap-8 items-start` — form section
  `flex-1`, preview column fixed-width on the right.
- Loading: skeleton blocks inside the same card container (`animate-pulse` grid mirroring
  the form fields) so the layout doesn't jump — see the `isLoading()` branch in
  `edit-vendor-details.html`.
- Everything else (fields, buttons, cards) follows the [style skill](../style/SKILL.md).
