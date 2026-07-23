import { CommonModule, Location } from '@angular/common';
import { Component, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';
import { OfferDetails } from '../../Components/offer-details/offer-details';
import { PreviewOfferDetails } from '../../Components/preview-offer-details/preview-offer-details';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

type RedemptionTab = 'in-store' | 'online';

@Component({
  selector: 'app-offer-details-page',
  imports: [PrimeUIModules, CommonModule, PreviewOfferDetails, OfferDetails, Button, TranslatePipe],
  templateUrl: './offer-details.html',
  styleUrl: './offer-details.scss',
})
export class OfferDetailsPage {
  private readonly i18n = inject(I18nService);
  readonly offerDetailIconBasePath = 'assets/svg/Offers/offer-details';

  /**
   * Seeds from the app language on every switch; the preview's own toggle
   * overrides it until the next switch.
   */
  readonly previewLanguage = linkedSignal<'en' | 'ar'>(() => this.i18n.lang());

  // Mock data for Vendor project
  OfferBasicData = signal<any>({
    title: 'Summer Sale 2026',
    title_ar: 'تخفيضات الصيف 2026',
    description: 'Enjoy a limited-time discount across all participating branches this summer.',
    description_ar: 'استمتع بخصم لفترة محدودة في جميع الفروع المشاركة هذا الصيف.',
    startDate: new Date(2026, 0, 10).toISOString(),
    expiryDate: { $date: new Date(2026, 1, 10).toISOString() },
    category: { name: 'Retail', icon: 'pi pi-shopping-bag' },
    tags: ['Summer', 'Limited', 'Popular'],
    targetAudience: ['employees', 'Families'],
    discount_type: 'percentage',
    discount_amount: '50',
    discount_amount_ar: '٥٠',
    offerMode: 'both',
    howToAvail: 'Present your QR code or Aramco ID at the branch.',
    howToAvail_ar: 'اعرض رمز الاستجابة السريعة الخاص بك أو بطاقة هوية أرامكو في المتجر.',
    mobile: '+966 50 123 4567',
    telephone: '+966 11 234 5678',
    email: 'offers@vendor.com',
    highlight_title: 'Best Seller',
    highlight_title_ar: 'الأكثر مبيعاً',
    highlight_description: 'Most redeemed offer of the season.',
    highlight_description_ar: 'العرض الأكثر استرداداً لهذا الموسم.',
    status: 'Active'
  });
  vendor = signal<any>({ name: 'Vendor Name', name_ar: 'اسم المتجر', logo: '' });
  offerLocations = signal<any[]>([
    { branch_name: 'Main Branch', city: 'Dhahran', region: 'Eastern Province', country: 'Saudi Arabia', address: 'King Saud Rd' },
    { branch_name: 'City Center', city: 'Riyadh', region: 'Riyadh', country: 'Saudi Arabia', address: 'Olaya St' },
    { branch_name: 'Corniche', city: 'Jeddah', region: 'Makkah', country: 'Saudi Arabia', address: 'Corniche Rd' },
  ]);

  isLoading = signal(false);
  offerId = signal('');
  vendorLogoFailed = signal(false);
  selectedRedemptionTab = signal<RedemptionTab>('in-store');
  activeTab = signal<'0' | '1' | '2' | '3'>('0');
  language: 'en' | 'ar' = 'en';

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private location: Location
  ) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      this.offerId.set(id);
    });

    // ponytail: dummy loading to test skeleton loader; remove once real fetch wires up isLoading
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 3000);
  }

  getOfferStatus(offer: any): 'Active' | 'Scheduled' | 'Expired' | 'Inactive' {
    return offer?.status || 'Active';
  }

  getOfferStatusSeverity(status: 'Active' | 'Scheduled' | 'Expired' | 'Inactive'): 'success' | 'info' | 'danger' | 'warn' {
    switch (status) {
      case 'Active': return 'success';
      case 'Scheduled': return 'info';
      case 'Expired': return 'danger';
      case 'Inactive':
      default: return 'warn';
    }
  }

  toggleLanguage() {
    this.language = this.language === 'en' ? 'ar' : 'en';
  }

  getActionText(): string {
    return this.language === 'en' ? 'Redeem Offer' : 'استرداد العرض';
  }

  back() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/offers']);
  }

  navigateToEditOffer() {
    const offerID = this.offerId();
    if (!offerID) return;
    this.router.navigate(['/offers/edit', offerID]);
  }

  raiseTicket() {
    // Mock implementation for raising ticket
    console.log('Navigate to messaging center to raise ticket');
  }

  getVendorLogo(offer: any): string {
    if (this.vendorLogoFailed()) return '';
    return this.vendor()?.logo || offer?.vendor?.logo || '';
  }

  markVendorLogoError(): void {
    this.vendorLogoFailed.set(true);
  }

  getVendorNameAr(offer: any): string {
    return this.vendor()?.name_ar || offer?.vendor?.name_ar || '';
  }

  getOfferTitleAr(offer: any): string {
    return offer?.title_ar || '';
  }

  getVendorName(offer: any): string {
    return this.vendor()?.name || offer?.vendor?.name || 'Unknown vendor';
  }

  getOfferMode(offer: any): 'in store' | 'online' | 'both' {
    const m = (offer?.offerMode ?? '').toString().trim().toLowerCase();
    if (m === 'in store' || m === 'instore') return 'in store';
    if (m === 'online') return 'online';
    if (m === 'both') return 'both';
    return 'both';
  }

  onTabChange(value: string | number | undefined) {
    const v = String(value ?? '0') as '0' | '1' | '2' | '3';
    this.activeTab.set(v);
  }

  getOfferDetailIconPath(iconName: string): string {
    return `${this.offerDetailIconBasePath}/${iconName}`;
  }

  getFormattedDiscountAr(offer: any): string {
    const amount = offer?.discount_amount_ar || offer?.discount_amount || '';
    const type = (offer?.discount_type || '').toLowerCase().trim();
    if (!amount) return '';
    if (type === 'percentage') return `${amount.toString().replace('%', '').trim()}% خصم`;
    else if (type === 'fixed') return `${amount} خصم`;
    return amount;
  }

  getFormattedDiscountEn(offer: any): string {
    const amount = offer?.discount_amount || '';
    const type = (offer?.discount_type || '').toLowerCase().trim();
    if (!amount) return '';
    if (type === 'percentage') return `${amount.toString().replace('%', '').trim()}% Discount`;
    else if (type === 'fixed') return `${amount} Discount`;
    return amount;
  }

  getDiscountAmount(offer: any, lang: 'en' | 'ar'): string {
    const type = (offer?.discount_type || '').toLowerCase().trim();
    const amount = lang === 'ar' ? (offer?.discount_amount_ar || offer?.discount_amount) : offer?.discount_amount;
    let normalized = String(amount || '').replace('%', '').trim();
    if (type === 'other' || type === 'others') {
      normalized = normalized.replace(/\\bdiscount\\b/gi, '').replace(/\\s{2,}/g, ' ').trim();
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
