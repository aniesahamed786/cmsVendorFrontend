import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';

@Component({
  selector: 'app-vendor-quick-actions',
  imports: [CommonModule],
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
