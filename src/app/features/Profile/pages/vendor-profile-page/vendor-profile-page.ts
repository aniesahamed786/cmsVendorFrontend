import { CommonModule } from '@angular/common';
import { Component, signal,OnInit} from '@angular/core';
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
import { VendorProfileService } from '../vendor-profile.service';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-vendor-profile-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, VendorPreview, TranslatePipe],
  templateUrl: './vendor-profile-page.html',
  styleUrl: './vendor-profile-page.css',
})
export class VendorProfilePage implements OnInit {
  ngOnInit(): void {
  this.loadVendorProfile();
}
readonly backendUrl = environment.backendUrl;
getImageUrl(path: string): string {
  if (!path) return '';
  return this.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
}
  readonly profile = signal<any | null>(null);
  constructor(private readonly router: Router,private readonly vendorProfileService: VendorProfileService, private readonly authService: AuthService) {}
private loadVendorProfile(): void {

  const vendorId = this.authService.getVendorId();

if (!vendorId) {
  console.error('Vendor ID not found.');
  return;
}

  this.vendorProfileService
      .getVendorProfile(vendorId)
      .subscribe({

        next: (response) => {

          console.log(response);

          this.profile.set(response);

        },

        error: (err) => {

          console.error(err);

        }

      });

}
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
