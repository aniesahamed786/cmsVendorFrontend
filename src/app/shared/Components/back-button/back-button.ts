import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { Button } from '../button/button';

/**
 * The one back button. Ghost variant of <app-button> + a left arrow.
 *
 * Label is an i18n key so each page names its own destination
 * ("Back to Offers", "Back to Profile"); it falls back to `common.back`.
 * Click is the native DOM event: <app-back-button (click)="goBack()" />.
 */
@Component({
  selector: 'app-back-button',
  imports: [Button, TranslatePipe],
  template: `<app-button variant="ghost" icon="pi pi-arrow-left">{{ label() | translate }}</app-button>`,
})
export class BackButton {
  label = input('common.back');
}
