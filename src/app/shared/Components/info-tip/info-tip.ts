import { Component, input } from '@angular/core';
import { PrimeUIModules } from '../../../core/prime.import';

/**
 * InfoTip — the small "?" / info glyph that sits next to a field label, a card
 * title or a table column header and explains what the thing is.
 *
 * Wraps PrimeNG's `pTooltip`, so there is exactly one place to change the
 * behaviour. The bubble itself is styled globally (`.p-tooltip` in
 * `src/styles.scss`) so pTooltip used directly on a button/element — e.g. the
 * form footer buttons — looks identical without repeating anything here.
 *
 * Text comes from the caller, already translated:
 *   <app-info-tip [text]="'offerForm.tooltip.expiryDate' | translate" />
 */
@Component({
  selector: 'app-info-tip',
  imports: [PrimeUIModules],
  templateUrl: './info-tip.html',
  styleUrl: './info-tip.css',
})
export class InfoTip {
  text = input.required<string>();
  position = input<'top' | 'bottom' | 'left' | 'right'>('top');
}
