import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { resolveStoredImageUrl } from '../../../../shared/utils/resolve-stored-image-url';

@Component({
  selector: 'app-preview-offer-details',
  imports: [CommonModule, ButtonModule],
  templateUrl: './preview-offer-details.html',
  styleUrl: './preview-offer-details.scss'
})
export class PreviewOfferDetails implements OnChanges {
  private readonly document = inject(DOCUMENT);
  @Input() offer: any;
  @Input() vendor: any;
  @Input() locations: any[] = [];
  @Input() showVendorLogo = true;
  offerImageFailed = false;

  @Input() language: 'en' | 'ar' = 'en';
  activeTab: 'avail' | 'contact' | 'feedback' = 'avail';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['offer']) { this.offerImageFailed = false; }
  }

  get isHotelOffer(): boolean {
    const categoryName = this.offer?.category?.name?.trim().toLowerCase();
    return categoryName === 'hotels' || categoryName === 'hotel';
  }

  get hotelDetails(): any { return this.offer?.hotel_details || this.offer; }

  toggleLanguage() { this.language = this.language === 'en' ? 'ar' : 'en'; }
  markOfferImageFailed(): void { this.offerImageFailed = true; }
  setActiveTab(tab: 'avail' | 'contact' | 'feedback') { this.activeTab = tab; }

  scrollToSection(fieldName: string): void {
    let sectionId = '';
    const mainFields = ['titleEn', 'titleAr', 'descriptionEn', 'descriptionAr', 'startdate', 'expiry', 'discountEn', 'discountAr', 'discountType', 'highlight', 'highlightTitleEn', 'highlightTitleAr', 'highlightDescription', 'highlightDescriptionAr'];
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
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }

  getOfferMode(): string {
    const mode = (this.offer?.offerMode || 'in store').toLowerCase();
    if (this.language === 'ar') {
      if (mode === 'online') return 'أونلاين';
      if (mode === 'both') return 'في المتجر وأونلاين';
      return 'في المتجر';
    }
    if (mode === 'online') return 'Digital';
    if (mode === 'both') return 'In-Store & Digital';
    return 'In-Store';
  }

  getOfferModeIcon(): string {
    const mode = (this.offer?.offerMode || 'in store').toLowerCase();
    if (mode === 'online') return 'pi-globe';
    if (mode === 'both') return 'pi-shop';
    return 'pi-home';
  }

  getActionText(): string { return this.language === 'en' ? 'Redeem' : 'استرداد'; }

  getOfferImage(offer: any): string | null {
    const image = offer?.image || offer?.coverImage;
    let path = null;
    if (typeof image === 'string' && image.trim()) path = image;
    else if (image?.url && typeof image.url === 'string') path = image.url;
    return this.formatImageUrl(path);
  }

  getVendorLogo(offer: any): string {
    const logo = this.vendor?.logo || offer?.vendor?.logo;
    return this.formatImageUrl(logo) || '';
  }

  formatImageUrl(path: string | null | undefined): string | null { return resolveStoredImageUrl(path); }

  getVendorName(offer: any): string {
    if (this.language === 'ar') {
      return this.vendor?.name_ar || offer?.vendor?.name_ar || this.vendor?.name || offer?.vendor?.name || 'اسم المتجر';
    }
    return this.vendor?.name || offer?.vendor?.name || 'Vendor Name';
  }

  getFormattedDiscount(offer: any): string {
    const isAr = this.language === 'ar';
    const amount = isAr
      ? (offer?.discount_amount_ar || offer?.Discount_amount_ar || offer?.discountValueAr || offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '')
      : (offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '');
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

  hasDiscount(offer: any): boolean { return !!this.getDiscountAmount(offer); }

  getOfferTitle(offer: any): string {
    return this.language === 'ar'
      ? (offer?.title_ar || offer?.title || 'عنوان العرض')
      : (offer?.title || 'Offer Title');
  }

  getEndDate(offer: any): Date | null {
    const d = offer?.expiryDate?.$date;
    if (!d) return null;
    return new Date(d);
  }

  getFormattedEndDate(offer: any): string {
    const endDate = this.getEndDate(offer);
    if (!endDate) return '';
    return new Intl.DateTimeFormat(this.language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }).format(endDate);
  }

  getLocationTitle(loc: any): string {
    if (this.language === 'ar') {
      return loc?.branch_name_ar || loc?.city_ar || loc?.branch_name || loc?.city || 'اسم الموقع';
    }
    return loc?.branch_name || loc?.city || 'Location name';
  }

  getLocationSubtitle(loc: any): string {
    if (this.language === 'ar') return loc?.address_ar || loc?.address || 'تفاصيل الموقع';
    return loc?.address || 'Location detail';
  }

  getRoomDetails(): any[] { return this.hotelDetails?.roomDetails || []; }
  getAmenities(): string[] { return this.hotelDetails?.hotelAmenitites || this.hotelDetails?.hotelAmenities || []; }
  getTaxValue(): string { return this.hotelDetails?.taxValue || ''; }
  getCurrency(): string { return this.hotelDetails?.currency || 'SAR'; }
  isSAR(currency: string | null | undefined): boolean { return currency?.toUpperCase() === 'SAR'; }

  getDiscountAmount(offer: any): string {
    const isAr = this.language === 'ar';
    const amount = isAr
      ? (offer?.discount_amount_ar || offer?.Discount_amount_ar || offer?.discountValueAr || offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '')
      : (offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '');
    return String(amount || '').replace('%', '').trim();
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
    return type === 'other' || type === 'others';
  }
}
