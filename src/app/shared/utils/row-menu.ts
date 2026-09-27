import { Menu } from 'primeng/menu';

/**
 * Row action menus (`<p-menu [popup]="true">`) are declared inside the table's
 * row template, so every row gets its own Menu instance. PrimeNG closes a popup
 * from its own document-click listener — which never fires when the next row's
 * button calls `$event.stopPropagation()` to stop the row-click navigation. The
 * result is two menus on screen at once.
 *
 * Use this instead of calling `menu.toggle($event)` directly:
 *
 *   (click)="selectedRow.set(row); openRowMenu(menu, $event)"
 *
 * ponytail: one module-level reference, because only one row menu can be open
 * on screen at a time. If popups ever need to nest, this becomes a service.
 */
let openMenu: Menu | null = null;

export function openRowMenu(menu: Menu, event: Event): void {
  if (openMenu && openMenu !== menu) openMenu.hide();
  menu.toggle(event);
  openMenu = menu.visible ? menu : null;
}
