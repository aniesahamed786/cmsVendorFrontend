import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorPreview } from '../../components/vendor-preview/vendor-preview';
import { VendorHeroCard } from '../../components/vendor-hero-card/vendor-hero-card';
import { MOCK_VENDOR_PROFILE } from '../../data/mock-vendor-profile';
import {
  OfferStatus,
  RequestStatus,
  VendorProfile,
} from '../../models/vendor-profile.model';
import { VendorProfileService } from '../vendor-profile.service';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { PendingRequestCheck } from '../../../request-center/services/pending-request-check.service';
import { resolveAssetUrl, resolveMaskImageStyle } from '../../../../shared/utils/resolve-asset-url';

@Component({
  selector: 'app-vendor-profile-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, VendorPreview, TranslatePipe, ConfirmationPopUp, VendorHeroCard],
  templateUrl: './vendor-profile-page.html',
  styleUrl: './vendor-profile-page.css',
  // Component-scoped so this page's "already pending" state is its own.
  providers: [PendingRequestCheck],
})
export class VendorProfilePage implements OnInit {
  readonly isLoading = signal(true);
  readonly profile = signal<any | null>(null);
  readonly backendUrl = environment.backendUrl;
  readonly pendingRequest = inject(PendingRequestCheck);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);

  constructor(
    private readonly router: Router,
    private readonly vendorProfileService: VendorProfileService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadVendorProfile();
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    return this.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
  }

  private loadVendorProfile(): void {
    this.isLoading.set(true);
    this.vendorProfileService
      .getVendorProfile()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.profile.set(response);
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  /**
   * Editing the profile raises a PROFILE/UPDATE request, and only one may be open at a time.
   * Check first so the vendor is told up front instead of hitting a 409 on save.
   */
  onEditProfile(): void {
    this.pendingRequest.guardEdit(this.authService.getVendorId(), ['/profile/edit']);
  }

  /** Message for the "already pending" dialog, naming the request that is holding the profile. */
  pendingRequestMessage(): string {
    return this.i18n.t('requestCenter.pending.message', {
      requestId: this.pendingRequest.blockedBy() ?? '',
    });
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

  getVendorIconMask(iconName: string): string {
    return resolveMaskImageStyle(this.document, `svg/vendors/add-vendor/${iconName}`);
  }

  getSocialLinkUrl(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object' && typeof (value as any).url === 'string') {
      return (value as any).url.trim();
    }
    return '';
  }

  getExternalLinkHref(value: unknown): string {
    const url = this.getSocialLinkUrl(value);
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  getSocialPlatform(value: unknown): string {
    if (value && typeof value === 'object') {
      const link = value as Record<string, unknown>;
      const p = String(link['platform'] ?? link['type'] ?? link['platformType'] ?? '').trim().toLowerCase();
      if (p) return p === 'twitter' ? 'x' : p;
    }
    const url = this.getSocialLinkUrl(value).toLowerCase();
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
    if (url.includes('x.com') || url.includes('twitter.com')) return 'x';
    if (url.includes('whatsapp') || url.includes('wa.me')) return 'whatsapp';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('snapchat.com')) return 'snapchat';
    return '';
  }

  getSocialLinkIconPath(value: unknown): string | null {
    const platform = this.getSocialPlatform(value);
    switch (platform) {
      case 'instagram': return resolveAssetUrl(this.document, 'svg/social-media/ic-instagram.svg');
      case 'linkedin': return resolveAssetUrl(this.document, 'svg/social-media/linkedin.svg');
      case 'facebook': return resolveAssetUrl(this.document, 'svg/social-media/ic-facebook.svg');
      case 'tiktok': return resolveAssetUrl(this.document, 'svg/social-media/tiktok.svg');
      case 'youtube': return resolveAssetUrl(this.document, 'svg/social-media/youtube.svg');
      case 'snapchat': return resolveAssetUrl(this.document, 'svg/social-media/ic-snapchat.svg');
      case 'whatsapp': return resolveAssetUrl(this.document, 'svg/social-media/whatspp.svg');
      case 'x': return resolveAssetUrl(this.document, 'svg/social-media/X.svg');
      default: return null;
    }
  }

  formatSocialLinkLabel(value: unknown): string {
    if (value && typeof value === 'object' && typeof (value as any).accountName === 'string' && (value as any).accountName.trim()) {
      return (value as any).accountName.trim();
    }
    const url = this.getSocialLinkUrl(value);
    if (!url) return '';
    const withoutQuery = url.split('?')[0];
    const normalizedValue = /^https?:\/\//i.test(withoutQuery) ? withoutQuery : `https://${withoutQuery}`;
    try {
      const parsed = new URL(normalizedValue);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
      const pathParts = path.split('/').filter(Boolean);
      const hostname = parsed.hostname.replace(/^www\./, '');

      if (hostname.includes('linkedin.com') && pathParts[0]?.toLowerCase() === 'in' && pathParts[1]) {
        return pathParts[1];
      }
      if (hostname.includes('tiktok.com')) {
        const username = pathParts.find((p) => p.startsWith('@'));
        if (username) return username;
      }
      if (hostname.includes('snapchat.com') && pathParts[0]?.toLowerCase() === 'add' && pathParts[1]) {
        return pathParts[1];
      }
      return pathParts[pathParts.length - 1] || hostname;
    } catch {
      const fallbackParts = withoutQuery
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter(Boolean);
      return fallbackParts[fallbackParts.length - 1] || withoutQuery;
    }
  }
}
