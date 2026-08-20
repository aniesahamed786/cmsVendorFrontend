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

@Component({
  selector: 'app-vendor-preview',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, TranslatePipe],
  templateUrl: './vendor-preview.html',
  styleUrl: './vendor-preview.scss',
})
export class VendorPreview implements OnChanges {
  private readonly document = inject(DOCUMENT);

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
        const container = el.closest('.vendor-preview__screen') as HTMLElement;
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
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('instagram.com')) return this.resolveSocialAsset('ic-instagram.svg');
    if (lowerValue.includes('facebook.com') || lowerValue.includes('fb.com')) return this.resolveSocialAsset('ic-facebook.svg');
    if (lowerValue.includes('x.com') || lowerValue.includes('twitter.com')) return this.resolveSocialAsset('X.svg');
    if (lowerValue.includes('whatsapp') || lowerValue.includes('wa.me')) return this.resolveSocialAsset('whatspp.svg');
    if (lowerValue.includes('tiktok.com')) return this.resolveSocialAsset('tiktok.svg');
    if (lowerValue.includes('linkedin.com')) return this.resolveSocialAsset('linkedin.svg');
    if (lowerValue.includes('youtube.com') || lowerValue.includes('youtu.be')) return this.resolveSocialAsset('youtube.svg');
    if (lowerValue.includes('snapchat.com')) return this.resolveSocialAsset('ic-snapchat.svg');
    return null;
  }

  private resolveSocialIconPathFromType(type: string): string | null {
    switch (type) {
      case 'instagram': return this.resolveSocialAsset('ic-instagram.svg');
      case 'linkedin': return this.resolveSocialAsset('linkedin.svg');
      case 'facebook': return this.resolveSocialAsset('ic-facebook.svg');
      case 'tiktok': return this.resolveSocialAsset('tiktok.svg');
      case 'youtube': return this.resolveSocialAsset('youtube.svg');
      case 'snapchat': return this.resolveSocialAsset('ic-snapchat.svg');
      case 'whatsapp': return this.resolveSocialAsset('whatspp.svg');
      case 'x':
      case 'twitter': return this.resolveSocialAsset('X.svg');
      default: return null;
    }
  }

  getSocialLinkIconClass(link?: unknown): string {
    const platform = typeof link === 'object' && link ? (link as VendorSocialLink).platform?.toLowerCase() : null;
    if (platform === 'linkedin') {
      return 'vendor-preview__social-icon vendor-preview__social-icon--linkedin';
    }
    return 'vendor-preview__social-icon';
  }

  getLocationName(loc: Record<string, string>): string {
    if (this.language() === 'ar') {
      return loc['nameAr'] || loc['branchNameAr'] || loc['name'] || 'اسم الفرع';
    }
    return loc['nameEn'] || loc['branchName'] || loc['name'] || 'Branch Name';
  }

  getLocationCity(loc: Record<string, string>): string {
    if (this.language() === 'ar') {
      return loc['city_ar'] || loc['city'] || 'الخبر';
    }
    return loc['city'] || 'Khobar';
  }

  formatPhone(): string {
    return this.phone || '+966 123 456-7890';
  }

  formatEmail(): string {
    return this.email || 'vendor@email.com';
  }

  formatWebsite(): string {
    return this.website || 'www.vendor.com';
  }

  private resolveSocialAsset(iconFile: string): string {
    return resolveAssetUrl(this.document, `svg/social-media/${iconFile}`);
  }
}
