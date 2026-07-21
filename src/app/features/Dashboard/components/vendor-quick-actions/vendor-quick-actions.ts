import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-vendor-quick-actions',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './vendor-quick-actions.html',
  styleUrl: './vendor-quick-actions.css',
})
export class VendorQuickActions {
  createOffer = output<void>();
  editProfile = output<void>();
  contactSupport = output<void>();

  onCreateOffer(): void {
    this.createOffer.emit();
  }

  onEditProfile(): void {
    this.editProfile.emit();
  }

  onContactSupport(): void {
    this.contactSupport.emit();
  }
}
