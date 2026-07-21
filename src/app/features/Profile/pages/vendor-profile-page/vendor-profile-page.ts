import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorPreview } from '../../components/vendor-preview/vendor-preview';
import { MOCK_VENDOR_PROFILE } from '../../data/mock-vendor-profile';
import {
  OfferStatus,
  RequestStatus,
  VendorProfile,
} from '../../models/vendor-profile.model';

@Component({
  selector: 'app-vendor-profile-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, VendorPreview, TranslatePipe],
  templateUrl: './vendor-profile-page.html',
  styleUrl: './vendor-profile-page.css',
})
export class VendorProfilePage {
  readonly profile = signal<VendorProfile>(MOCK_VENDOR_PROFILE);

  constructor(private readonly router: Router) {}

  onEditProfile(): void {
    this.router.navigate(['/profile/edit']);
  }

  onViewAllOffers(): void {
    this.router.navigate(['/offers']);
  }

  onViewAllRequests(): void {
    this.router.navigate(['/request-center']);
  }

  onMessageRepresentative(): void {
    this.router.navigate(['/messaging-center']);
  }

  offerStatusClass(status: OfferStatus): string {
    switch (status) {
      case 'Active':
        return 'status-badge status-badge--success';
      case 'Rejected':
        return 'status-badge status-badge--danger';
      case 'Ending Soon':
        return 'status-badge status-badge--warning';
    }
  }

  requestStatusClass(status: RequestStatus): string {
    switch (status) {
      case 'Ending Soon':
      case 'Action Required':
        return 'status-badge status-badge--danger';
      case 'In-Progress':
        return 'status-badge status-badge--warning';
    }
  }
}
