import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { Button } from '../button/button';

/**
 * The one cancel/dismiss button. Outline variant of <app-button>.
 *
 * Label is an i18n key so a page can say "Discard" or "Cancel edit" instead;
 * it falls back to `common.cancel`. Click is the native DOM event.
 */
@Component({
  selector: 'app-cancel-button',
  imports: [Button, TranslatePipe],
  template: `<app-button variant="outline" [disabled]="disabled()">{{ label() | translate }}</app-button>`,
})
export class CancelButton {
  label = input('common.cancel');
  disabled = input(false);
}
