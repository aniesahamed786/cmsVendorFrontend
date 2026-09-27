import { describe, expect, it } from 'vitest';
import { Menu } from 'primeng/menu';
import { openRowMenu } from './row-menu';

/** Stands in for PrimeNG's Menu: `toggle` hides when visible, shows otherwise. */
function fakeMenu(): Menu {
  const menu = {
    visible: false,
    toggle: (_event: Event) => {
      if (menu.visible) menu.hide();
      else menu.show();
    },
    show: () => {
      menu.visible = true;
    },
    hide: () => {
      menu.visible = false;
    },
  };
  return menu as unknown as Menu;
}

const click = () => new Event('click');

describe('openRowMenu', () => {
  it('closes the previous row menu when another row is opened', () => {
    const a = fakeMenu();
    const b = fakeMenu();

    openRowMenu(a, click());
    expect(a.visible).toBe(true);

    openRowMenu(b, click());
    expect(a.visible).toBe(false); // the bug: this used to stay open
    expect(b.visible).toBe(true);

    openRowMenu(b, click()); // reset module state for the next test
  });

  it('still toggles the same menu shut on a second click', () => {
    const a = fakeMenu();

    openRowMenu(a, click());
    expect(a.visible).toBe(true);

    openRowMenu(a, click());
    expect(a.visible).toBe(false);
  });
});
