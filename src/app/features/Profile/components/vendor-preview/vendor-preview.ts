import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { resolveAssetUrl } from '../../../../shared/utils/resolve-asset-url';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorSocialLink } from '../../../vendors/models/createNewVendor';
import { MobilePreview } from '../../../../shared/Components/mobile-preview/mobile-preview';

@Component({
  selector: 'app-vendor-preview',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, TranslatePipe, MobilePreview],
  templateUrl: './vendor-preview.html',
  styleUrl: './vendor-preview.scss',
})
export class VendorPreview implements OnChanges {
  private readonly document = inject(DOCUMENT);

  @Input() loading = false;
  @Input() isDialog = false;
  @Input() name: string | null = null;
  @Input() nameAr: string | null = null;
  @Input() description: string | null = null;
  @Input() descriptionAr: string | null = null;
  @Input() logo: string | null = null;
  @Input() cover: string | null = null;
  @Input() email: string | null = null;
  @Input() phone: string | null = null;
  @Input() website: string | null = null;
  @Input() offers: unknown[] = [];
  @Input() locations: any[] = [];
  @Input() socialLinks: (string | VendorSocialLink)[] = [];

  language = signal<'en' | 'ar'>('en');
  bannerImageFailed = signal(false);
  logoImageFailed = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logo'] || changes['cover']) {
      this.bannerImageFailed.set(false);
      this.logoImageFailed.set(false);
    }
  }

  toggleLanguage(): void {
    this.language.update((value) => (value === 'en' ? 'ar' : 'en'));
  }

  setLanguage(lang: 'en' | 'ar'): void {
    this.language.set(lang);
  }

  scrollToSection(sectionId: string): void {
    if (!sectionId) return;
    setTimeout(() => {
      const el = this.document.getElementById(sectionId);
      if (el) {
        const container = el.closest('.mobile-preview__screen, .vendor-preview__screen') as HTMLElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetScrollTop =
            container.scrollTop + (elRect.top - containerRect.top) - (container.clientHeight / 2) + (el.clientHeight / 2);
          container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        }
      }
    }, 50);
  }

  getVendorLogo(): string | null {
    if (this.logoImageFailed()) {
      return null;
    }
    return this.logo;
  }

  getVendorBanner(): string | null {
    if (this.bannerImageFailed()) {
      return null;
    }
    return this.cover;
  }

  markBannerImageFailed(): void {
    this.bannerImageFailed.set(true);
  }

  markLogoImageFailed(): void {
    this.logoImageFailed.set(true);
  }

  getVendorName(): string {
    if (this.language() === 'ar') {
      return this.nameAr || 'اسم البائع';
    }
    return this.name || 'Vendor Name';
  }

  getVendorDescription(): string {
    if (this.language() === 'ar') {
      return this.descriptionAr || 'وصف البائع والخدمات التي يقدمها للعملاء.';
    }
    return this.description || 'Description of the vendor and the services it offers';
  }

  getOffers(): unknown[] {
    return this.offers?.length ? this.offers : [{}];
  }

  getLocations(): any[] {
    return Array.isArray(this.locations) ? this.locations : [];
  }

  getSocialLinks(): VendorSocialLink[] {
    return (this.socialLinks ?? [])
      .map((item) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed ? { url: trimmed } : null;
        }
        if (item && typeof item === 'object' && typeof (item as VendorSocialLink).url === 'string') {
          const url = (item as VendorSocialLink).url.trim();
          if (!url) return null;
          return {
            url,
            ...((item as VendorSocialLink).platform ? { platform: (item as VendorSocialLink).platform } : {}),
            ...((item as VendorSocialLink).accountName ? { accountName: (item as VendorSocialLink).accountName } : {}),
          };
        }
        return null;
      })
      .filter((l): l is VendorSocialLink => l !== null);
  }

  getSocialLinkHref(link: string | VendorSocialLink): string {
    const value = typeof link === 'string' ? link : link?.url ?? '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  getSocialLinkIconPath(link: string | VendorSocialLink): string | null {
    const platform = typeof link === 'object' ? link?.platform?.toLowerCase() : null;
    if (platform) {
      const path = this.resolveSocialIconPathFromType(platform);
      if (path) return path;
    }

    const value = typeof link === 'string' ? link : link?.url ?? '';
    const domain = value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();

    if (domain.includes('facebook') || domain.includes('fb.me')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-facebook.svg');
    }
    if (domain.includes('instagram') || domain.includes('instagr.am')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-instagram.svg');
    }
    if (domain.includes('twitter') || domain.includes('x.com')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-twitter.svg');
    }
    if (domain.includes('linkedin')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-linkedin.svg');
    }
    if (domain.includes('youtube') || domain.includes('youtu.be')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-youtube.svg');
    }
    if (domain.includes('tiktok')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-tiktok.svg');
    }
    if (domain.includes('snapchat')) {
      return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-snapchat.svg');
    }
    return null;
  }

  getSocialLinkIconClass(link: string | VendorSocialLink): string {
    return 'vendor-preview__social-icon';
  }

  private resolveSocialIconPathFromType(platform: string): string | null {
    const normalized = platform.trim().toLowerCase();
    switch (normalized) {
      case 'facebook':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-facebook.svg');
      case 'instagram':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-instagram.svg');
      case 'twitter':
      case 'x':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-twitter.svg');
      case 'linkedin':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-linkedin.svg');
      case 'youtube':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-youtube.svg');
      case 'tiktok':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-tiktok.svg');
      case 'snapchat':
        return resolveAssetUrl(this.document, 'assets/svg/vendor-preview/ic-social-snapchat.svg');
      default:
        return null;
    }
  }

  formatPhone(): string {
    return this.phone?.trim() ? this.phone.trim() : '+966 00 000 0000';
  }

  formatEmail(): string {
    return this.email?.trim() ? this.email.trim() : 'vendor@example.com';
  }

  formatWebsite(): string {
    return this.website?.trim() ? this.website.trim() : 'www.vendor-website.com';
  }

  getLocationName(loc: any): string {
    if (this.language() === 'ar') {
      return loc?.branchNameAr || loc?.branchName || loc?.name_ar || loc?.name || 'فرع';
    }
    return loc?.branchName || loc?.branchNameAr || loc?.name || loc?.name_ar || 'Branch';
  }

  getLocationCity(loc: any): string {
    if (this.language() === 'ar') {
      return loc?.cityAr || loc?.city || loc?.addressAr || loc?.address || '';
    }
    return loc?.city || loc?.cityAr || loc?.address || loc?.addressAr || '';
  }
}
