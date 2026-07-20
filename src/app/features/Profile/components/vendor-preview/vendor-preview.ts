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

@Component({
  selector: 'app-vendor-preview',
  standalone: true,
  imports: [CommonModule, PrimeUIModules],
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
  @Input() socialLinks: string[] = [];

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
      this.document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      return this.nameAr || 'اسم التاجر';
    }
    return this.name || 'Vendor Name';
  }

  getVendorDescription(): string {
    if (this.language() === 'ar') {
      return this.descriptionAr || 'وصف المتجر والخدمات التي يقدمها للعملاء.';
    }
    return this.description || 'Description of the branch and the services it offers';
  }

  getOffers(): unknown[] {
    return this.offers?.length ? this.offers : [{}];
  }

  getLocations(): any[] {
    return Array.isArray(this.locations) ? this.locations : [];
  }

  getSocialLinks(): string[] {
    return (this.socialLinks ?? []).filter((link) => !!link?.trim());
  }

  getSocialLinkHref(value: string): string {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  getSocialLinkIconPath(value: string): string | null {
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('instagram.com')) {
      return this.resolveSocialAsset('ic-instagram.svg');
    }
    if (lowerValue.includes('facebook.com') || lowerValue.includes('fb.com')) {
      return this.resolveSocialAsset('ic-facebook.svg');
    }
    if (lowerValue.includes('x.com') || lowerValue.includes('twitter.com')) {
      return this.resolveSocialAsset('X.svg');
    }
    if (lowerValue.includes('whatsapp') || lowerValue.includes('wa.me')) {
      return this.resolveSocialAsset('whatspp.svg');
    }
    return null;
  }

  getSocialLinkIconClass(_value?: unknown): string {
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
