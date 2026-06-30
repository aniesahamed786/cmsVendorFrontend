import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { PrimeUIModules } from '../../../core/prime.import';

@Component({
  selector: 'app-confirmation-pop-up',
  imports: [CommonModule, PrimeUIModules],
  templateUrl: './confirmation-pop-up.html',
  styleUrl: './confirmation-pop-up.css',
})
export class ConfirmationPopUp {
  visible = input(false);
  title = input('Confirmation');
  message = input('Are you sure you want to proceed?');
  allowHtml = input(false);
  confirmLabel = input('Confirm');
  cancelLabel = input('Cancel');
  loading = input(false);
  /** When false, only the confirm button is shown (e.g. forced acknowledgement). */
  showCancel = input(true);
  dismissableMask = input(true);

  confirm = output<void>();
  cancel = output<void>();
}
