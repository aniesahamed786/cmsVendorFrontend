import { CommonModule } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { toVendorMediaUrl } from '../../../../shared/utils/media-url';

/** The vendor an offer belongs to, as the hero needs it. */
export interface OfferHeroVendor {
  name: string;
  nameAr: string;
  /** Stored media path or absolute URL; resolved for display here. */
  logo: string;
}

/**
 * The blue gradient banner at the top of an offer: vendor identity in both languages, the
 * discount headline, status and offer mode.
 *
 * Extracted from the offer details page so the Request Center can show a pending offer under
 * the exact same header — a request is reviewed by looking at the offer as it will appear,
 * and two copies of this markup would drift apart the first time either changed.
 */
@Component({
  selector: 'app-offer-hero-card',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, TranslatePipe],
  templateUrl: './offer-hero-card.html',
  styleUrl: './offer-hero-card.scss',
})
export class OfferHeroCard {
  offer = input.required<any>();
  vendor = input<OfferHeroVendor>({ name: '', nameAr: '', logo: '' });

  private readonly logoFailed = signal(false);

  vendorLogo(): string {
    if (this.logoFailed()) return '';
    return toVendorMediaUrl(this.vendor()?.logo);
  }

  markVendorLogoError(): void {
    this.logoFailed.set(true);
  }

  vendorName(): string {
    return this.vendor()?.name || this.offer()?.vendorName || 'Unknown vendor';
  }

  vendorNameAr(): string {
    return this.vendor()?.nameAr || this.offer()?.vendorNameAr || '';
  }

  getOfferTitleAr(offer: any): string {
    return offer?.title_ar || '';
  }

  getOfferStatus(offer: any): 'Active' | 'Scheduled' | 'Expired' | 'Inactive' {
    return offer?.status || 'Active';
  }

  getOfferMode(offer: any): 'in store' | 'online' | 'both' {
    const mode = (offer?.offerMode ?? '').toString().trim().toLowerCase();
    if (mode === 'in store' || mode === 'instore') return 'in store';
    if (mode === 'online') return 'online';
    if (mode === 'both') return 'both';
    return 'both';
  }

  getFormattedDiscountEn(offer: any): string {
    const amount = offer?.discount_amount || '';
    const type = (offer?.discount_type || '').toLowerCase().trim();
    if (!amount) return '';
    if (type === 'percentage') return `${amount.toString().replace('%', '').trim()}% Discount`;
    if (type === 'fixed') return `${amount} Discount`;
    return amount;
  }

  getFormattedDiscountAr(offer: any): string {
    const amount = offer?.discount_amount_ar || offer?.discount_amount || '';
    const type = (offer?.discount_type || '').toLowerCase().trim();
    if (!amount) return '';
    if (type === 'percentage') return `${amount.toString().replace('%', '').trim()}% خصم`;
    if (type === 'fixed') return `${amount} خصم`;
    return amount;
  }

  getDiscountAmount(offer: any, lang: 'en' | 'ar'): string {
    const type = (offer?.discount_type || '').toLowerCase().trim();
    const amount =
      lang === 'ar' ? offer?.discount_amount_ar || offer?.discount_amount : offer?.discount_amount;
    let normalized = String(amount || '').replace('%', '').trim();
    if (type === 'other' || type === 'others') {
      normalized = normalized.replace(/\bdiscount\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    }
    return normalized;
  }

  isPercentageDiscount(offer: any): boolean {
    return (offer?.discount_type || '').toLowerCase().trim() === 'percentage';
  }

  isOtherDiscount(offer: any): boolean {
    const type = (offer?.discount_type || '').toLowerCase().trim();
    return type === 'other' || type === 'others';
  }
}
