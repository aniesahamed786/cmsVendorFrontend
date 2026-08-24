import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MobilePreview } from '../../../../shared/Components/mobile-preview/mobile-preview';
import { resolveStoredImageUrl } from '../../../../shared/utils/resolve-stored-image-url';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { environment } from '../../../../../environments/environment';
import { mapOfferModeToFormMode } from '../../models/createOffer';

@Component({
  selector: 'app-preview-offer-details',
  imports: [CommonModule, ButtonModule, TranslatePipe, MobilePreview],
  templateUrl: './preview-offer-details.html',
  styleUrl: './preview-offer-details.scss',
})
export class PreviewOfferDetails implements OnChanges {
  private readonly document = inject(DOCUMENT);
  @Input() offer: any;
  @Input() vendor: any;
  @Input() locations: any[] = [];
  @Input() showVendorLogo = true;
  offerImageFailed = false;
  readonly backendUrl = environment.backendUrl;

  @Input() language: 'en' | 'ar' = 'en';
  activeTab: 'avail' | 'contact' | 'feedback' = 'avail';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['offer']) {
      this.offerImageFailed = false;
    }
  }

  get isHotelOffer(): boolean {
    const categories =
      Array.isArray(this.offer?.categories) && this.offer.categories.length > 0
        ? this.offer.categories
        : this.offer?.category
          ? [this.offer.category]
          : [];
    return categories.some((category: any) => {
      const name = (category?.name || category?.categoryName || '')?.trim().toLowerCase();
      return name === 'hotels' || name === 'hotel';
    });
  }

  get hotelDetails(): any {
    return this.offer?.hotel_details || this.offer;
  }

  toggleLanguage() {
    this.language = this.language === 'en' ? 'ar' : 'en';
  }

  markOfferImageFailed(): void {
    this.offerImageFailed = true;
  }

  setActiveTab(tab: 'avail' | 'contact' | 'feedback') {
    this.activeTab = tab;
  }

  scrollToSection(fieldName: string): void {
    let sectionId = '';
    const mainFields = [
      'titleEn',
      'titleAr',
      'descriptionEn',
      'descriptionAr',
      'startdate',
      'expiry',
      'discountEn',
      'discountAr',
      'discountType',
      'highlight',
      'highlightTitleEn',
      'highlightTitleAr',
      'highlightDescription',
      'highlightDescriptionAr',
    ];
    const availFields = ['instructionsEn', 'instructionsAr', 'urlLink', 'discountCode', 'mode'];
    const contactFields = ['phone', 'landline', 'email'];
    const hotelFields = ['taxValue', 'taxValueAr', 'hotelAmenities', 'hotelAmenitiesAr', 'currency'];
    const locFields = ['locationIds'];
    const imageFields = ['offerImage'];

    if (mainFields.includes(fieldName)) {
      sectionId = 'preview-section-main';
    } else if (availFields.includes(fieldName)) {
      this.setActiveTab('avail');
      sectionId = 'preview-section-tabs';
    } else if (contactFields.includes(fieldName)) {
      this.setActiveTab('contact');
      sectionId = 'preview-section-tabs';
    } else if (hotelFields.includes(fieldName)) {
      sectionId = 'preview-section-hotel';
    } else if (locFields.includes(fieldName)) {
      sectionId = 'preview-section-locations';
    } else if (imageFields.includes(fieldName)) {
      sectionId = 'preview-section-image';
    }

    if (sectionId) {
      setTimeout(() => {
        const el = this.document.getElementById(sectionId);
        if (el) {
          const container = el.closest(
            '.mobile-preview__screen, .preview-offer-details__screen'
          ) as HTMLElement;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const targetScrollTop =
              container.scrollTop +
              (elRect.top - containerRect.top) -
              container.clientHeight / 2 +
              el.clientHeight / 2;
            container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
          }
        }
      }, 50);
    }
  }

  getOfferMode(): string {
    const mode = mapOfferModeToFormMode(this.offer?.offerMode);
    if (this.language === 'ar') {
      if (mode === 'Digital') return 'أونلاين';
      if (mode === 'In-Store & Digital') return 'في المتجر وأونلاين';
      return 'في المتجر';
    }
    return mode;
  }

  getOfferModeIcon(): string {
    const mode = mapOfferModeToFormMode(this.offer?.offerMode);
    if (mode === 'Digital') return 'pi-globe';
    if (mode === 'In-Store & Digital') return 'pi-shop';
    return 'pi-home';
  }

  getActionText(): string {
    return this.language === 'en' ? 'Redeem' : 'استرداد';
  }

  /**
   * Retrieves the mobile/portrait image for the offer.
   * Checks offerImages.image (the mobile image slot), followed by top-level image properties.
   */
  getOfferImage(offer: any): string | null {
    const raw =
      offer?.offerImages?.image ||
      offer?.image ||
      offer?.mobileImage ||
      offer?.image_mobile ||
      offer?.offerImage ||
      offer?.coverImage ||
      null;

    if (!raw) return null;

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
      if (/^\/?assets\//i.test(trimmed)) return trimmed.replace(/^\/+/, '');
      if (trimmed.startsWith('/api/v1/media/')) {
        return this.backendUrl + trimmed.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
      }
      if (trimmed.startsWith('/api/v1/cmsVendor/media/')) {
        return this.backendUrl + trimmed;
      }
      return resolveStoredImageUrl(trimmed);
    }

    if (typeof raw === 'object' && raw?.url && typeof raw.url === 'string') {
      return this.getOfferImage({ image: raw.url });
    }

    return null;
  }

  getVendorLogo(offer: any): string {
    const logo = this.offer?.vendorLogo || this.vendor?.logo || offer?.vendor?.logo || '';
    if (!logo) return '';
    if (typeof logo === 'string') {
      const trimmed = logo.trim();
      if (!trimmed) return '';
      if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
      if (/^\/?assets\//i.test(trimmed)) return trimmed.replace(/^\/+/, '');
      if (trimmed.startsWith('/api/v1/media/')) {
        return this.backendUrl + trimmed.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
      }
      if (trimmed.startsWith('/api/v1/cmsVendor/media/')) {
        return this.backendUrl + trimmed;
      }
      return resolveStoredImageUrl(trimmed) || '';
    }
    if (typeof logo === 'object' && (logo as any)?.url) {
      return resolveStoredImageUrl((logo as any).url) || '';
    }
    return '';
  }

  formatImageUrl(path: string | null | undefined): string | null {
    return resolveStoredImageUrl(path);
  }

  getVendorName(offer: any): string {
    if (this.language === 'ar') {
      return (
        this.vendor?.name_ar ||
        offer?.vendor?.name_ar ||
        this.vendor?.name ||
        offer?.vendor?.name ||
        'اسم المتجر'
      );
    }
    return this.vendor?.name || offer?.vendor?.name || 'Vendor Name';
  }

  getFormattedDiscount(offer: any): string {
    const isAr = this.language === 'ar';
    const amount = isAr
      ? offer?.discount_amount_ar ||
        offer?.Discount_amount_ar ||
        offer?.discountValueAr ||
        offer?.discount_amount ||
        offer?.Discount_amount ||
        offer?.discountValue ||
        ''
      : offer?.discount_amount ||
        offer?.Discount_amount ||
        offer?.discountValue ||
        '';
    const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
    if (!amount) return '';
    if (type === 'percentage') {
      const cleanAmount = String(amount).replace('%', '').trim();
      return isAr ? `${cleanAmount}% خصم` : `${cleanAmount}% Discount`;
    } else if (type === 'fixed') {
      return isAr ? `${amount} خصم` : `${amount} Discount`;
    }
    return amount;
  }

  hasDiscount(offer: any): boolean {
    return !this.getDiscountAmount(offer);
  }

  isPercentageDiscount(offer: any): boolean {
    const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
    return type === 'percentage';
  }

  isFixedDiscount(offer: any): boolean {
    const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
    return type === 'fixed';
  }

  isOtherDiscount(offer: any): boolean {
    const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
    return type !== 'percentage' && type !== 'fixed';
  }

  getDiscountAmount(offer: any): string {
    const isAr = this.language === 'ar';
    const rawAmount = isAr
      ? offer?.discount_amount_ar ??
        offer?.Discount_amount_ar ??
        offer?.discountValueAr ??
        offer?.discount_amount ??
        offer?.Discount_amount ??
        offer?.discountValue ??
        ''
      : offer?.discount_amount ??
        offer?.Discount_amount ??
        offer?.discountValue ??
        '';
    if (!rawAmount && rawAmount !== 0) return '';
    return String(rawAmount).replace('%', '').trim();
  }

  getEndDate(offer: any): string | null {
    return offer?.expiryDate || offer?.endDate || null;
  }

  getFormattedEndDate(offer: any): string {
    const dateStr = this.getEndDate(offer);
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleDateString(this.language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  }

  getRoomDetails(): any[] {
    const details = this.hotelDetails;
    return details?.rooms || details?.roomDetails || [];
  }

  getAmenities(): string[] {
    const details = this.hotelDetails;
    const isAr = this.language === 'ar';
    const amenities = isAr
      ? details?.hotelAmenitiesAr || details?.hotelAmenities || []
      : details?.hotelAmenities || [];
    return Array.isArray(amenities) ? amenities : [];
  }

  getTaxValue(): string {
    const details = this.hotelDetails;
    const isAr = this.language === 'ar';
    const tax = isAr
      ? details?.taxValueAr || details?.taxValue || ''
      : details?.taxValue || '';
    return tax ? String(tax) : '';
  }

  getCurrency(): string {
    const details = this.hotelDetails;
    return details?.currency || 'SAR';
  }

  isSAR(currency: string): boolean {
    if (!currency) return true;
    const c = currency.trim().toUpperCase();
    return c === 'SAR' || c === 'SR' || c === 'ر.س';
  }

  getLocationTitle(loc: any): string {
    const isAr = this.language === 'ar';
    return (
      (isAr ? loc?.branchNameAr || loc?.branchName : loc?.branchName || loc?.branchNameAr) ||
      (isAr ? loc?.name_ar || loc?.name : loc?.name || loc?.name_ar) ||
      (isAr ? 'فرع' : 'Branch')
    );
  }

  getLocationSubtitle(loc: any): string {
    const isAr = this.language === 'ar';
    return (
      (isAr ? loc?.cityAr || loc?.city : loc?.city || loc?.cityAr) ||
      (isAr ? loc?.addressAr || loc?.address : loc?.address || loc?.addressAr) ||
      ''
    );
  }
}
