import { CommonModule, Location } from '@angular/common';
import { Component, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';
import { OfferDetails } from '../../Components/offer-details/offer-details';
import { PreviewOfferDetails } from '../../Components/preview-offer-details/preview-offer-details';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { OfferDetailService } from '../../services/offer-detail.service';
import { environment } from '../../../../../environments/environment';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { OfferHeroCard, OfferHeroVendor } from '../../Components/offer-hero-card/offer-hero-card';
import { PendingRequestCheck } from '../../../request-center/services/pending-request-check.service';
import { BranchesService } from '../../../Branches/services/branches.service';

type RedemptionTab = 'in-store' | 'online';

@Component({
  selector: 'app-offer-details-page',
  imports: [PrimeUIModules, CommonModule, PreviewOfferDetails, OfferDetails, Button, TranslatePipe, ConfirmationPopUp, OfferHeroCard],
  templateUrl: './offer-details.html',
  styleUrl: './offer-details.scss',
  // Component-scoped so this page's "already pending" state is its own.
  providers: [PendingRequestCheck],
})
export class OfferDetailsPage {
  private readonly i18n = inject(I18nService);
  private readonly offerDetailService = inject(OfferDetailService);
  private readonly branchesService = inject(BranchesService);
  readonly pendingRequest = inject(PendingRequestCheck);
  readonly offerDetailIconBasePath = 'assets/svg/Offers/offer-details';

  /**
   * Seeds from the app language on every switch; the preview's own toggle
   * overrides it until the next switch.
   */
  readonly previewLanguage = linkedSignal<'en' | 'ar'>(() => this.i18n.lang());

  // Mock data for Vendor project
  // OfferBasicData = signal<any>({
  //   title: 'Summer Sale 2026',
  //   title_ar: 'تخفيضات الصيف 2026',
  //   description: 'Enjoy a limited-time discount across all participating branches this summer.',
  //   description_ar: 'استمتع بخصم لفترة محدودة في جميع الفروع المشاركة هذا الصيف.',
  //   startDate: new Date(2026, 0, 10).toISOString(),
  //   expiryDate: { $date: new Date(2026, 1, 10).toISOString() },
  //   category: { name: 'Retail', icon: 'pi pi-shopping-bag' },
  //   tags: ['Summer', 'Limited', 'Popular'],
  //   targetAudience: ['employees', 'Families'],
  //   discount_type: 'percentage',
  //   discount_amount: '50',
  //   discount_amount_ar: '٥٠',
  //   offerMode: 'both',
  //   howToAvail: 'Present your QR code or Aramco ID at the branch.',
  //   howToAvail_ar: 'اعرض رمز الاستجابة السريعة الخاص بك أو بطاقة هوية أرامكو في المتجر.',
  //   mobile: '+966 50 123 4567',
  //   telephone: '+966 11 234 5678',
  //   email: 'offers@vendor.com',
  //   highlight_title: 'Best Seller',
  //   highlight_title_ar: 'الأكثر مبيعاً',
  //   highlight_description: 'Most redeemed offer of the season.',
  //   highlight_description_ar: 'العرض الأكثر استرداداً لهذا الموسم.',
  //   status: 'Active'
  // });

  OfferBasicData = signal<any>({});
  vendor = signal<any>({});
  readonly backendUrl = environment.backendUrl;
  offerLocations = signal<any[]>([]);

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

    if(this.offerId()){
      this.loadOfferDetail()
    }
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

  /**
   * Editing an offer raises an UPDATE request, and only one may be open per offer. Check for
   * an existing one before opening the form, so the vendor is told up front rather than after
   * filling it in and hitting a 409 on save.
   */
  navigateToEditOffer() {
    const offerID = this.offerId();
    if (!offerID) return;
    this.pendingRequest.guardEdit(offerID, ['/offers/edit', offerID]);
  }

  /** Message for the "already pending" dialog, naming the request that is holding the offer. */
  pendingRequestMessage(): string {
    return this.i18n.t('requestCenter.pending.message', {
      requestId: this.pendingRequest.blockedBy() ?? '',
    });
  }

  raiseTicket() {
    // Mock implementation for raising ticket
    console.log('Navigate to messaging center to raise ticket');
  }

  /** Vendor identity for the hero banner — the offer detail response carries it inline. */
  heroVendor(): OfferHeroVendor {
    const offer = this.OfferBasicData();
    return {
      name: offer?.vendorName ?? '',
      nameAr: offer?.vendorNameAr ?? '',
      logo: offer?.vendorLogo ?? '',
    };
  }

  getVendorNameAr(offer: any): string {
    return this.OfferBasicData()?.vendorNameAr || offer?.vendorNameAr || '';
  }

  getOfferTitleAr(offer: any): string {
    return offer?.title_ar || '';
  }

  getVendorName(offer: any): string {
    return this.OfferBasicData()?.vendorName || offer?.vendorName || 'Unknown vendor';
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

  private loadOfferDetail() {
    this.isLoading.set(true);
    this.offerDetailService
      .getOfferDetail(this.offerId())
      .subscribe({
        next: (res: any) => {
          console.log("Offer Detail", res)
          const av = (res.availability || []).map((a: string) => a.toLowerCase());
          const hasOnline = av.includes('online') || av.includes('digital');
          const hasInStore = av.includes('in-store') || av.includes('instore');
          let offerMode = 'in store';
          if (hasOnline && hasInStore) {
            offerMode = 'both';
          } else if (hasOnline) {
            offerMode = 'online';
          }

          this.OfferBasicData.set({
            title: res.offerTitle,
            title_ar: res.offerTitleAr || res.offerTitle,
            description: res.description ?? '',
            description_ar: res.descriptionAr ?? res.description ?? '',
            startDate: res.startDate?.$date ?? res.startDate,
            expiryDate: res.endDate?.$date ?? res.endDate,
            category: res.categories?.length
              ? {
                name: res.categories[0].categoryName,
                name_ar: res.categories[0].categoryNameAr,
                icon: res.categories[0].categoryLogo
              }
              : null,
            categories: (res.categories || []).map((c: any) => ({
              id: c.categoryId ?? c._id ?? c.id,
              name: c.categoryName ?? c.name,
              name_ar: c.categoryNameAr ?? c.name_ar,
              icon: c.categoryLogo ?? c.icon,
              categoryId: c.categoryId,
              categoryName: c.categoryName,
              categoryNameAr: c.categoryNameAr,
              categoryLogo: c.categoryLogo
            })),
            tags: res.tags ?? [],
            targetAudience: res.audience ?? [],
            discount_type: res.discountType,
            discount_amount: res.discount,
            discount_amount_ar: res.discountAmountAr || res.discount,
            discountCode: res.discountCode ?? '',
            discount_url: res.discountUrl ?? '',
            website: res.website ?? '',
            offerMode,
            howToAvail:
              res.redemptionInstructions?.instructions ?? '',
            howToAvail_ar:
              res.redemptionInstructions?.instructionsAr ?? '',
            mobile:
              res.contactDetails?.mobile?.join(', ') ?? '',
            telephone:
              res.contactDetails?.telephone?.join(', ') ?? '',
            email:
              res.contactDetails?.email?.join(', ') ?? '',
            isHighlightEnabled: res.isHighlightEnabled ?? false,
            highlight_title: res.highlightTitle ?? '',
            highlight_title_ar: res.highlightTitleAr ?? '',
            highlight_description: res.highlightDescription ?? '',
            highlight_description_ar: res.highlightDescriptionAr ?? '',
            highlight_image: res.highlightImage ?? '',
            highlight_image_landscape: res.highlightImageLandscape ?? '',
            status: res.status,
            offerLogo: res.offerLogo,
            offerImages: res.offerImages,
            locationIds: res.locationIds ?? [],
            hotelDetails: res.hotelDetails ?? null,
            vendorName: res.vendorName,
            vendorNameAr: res.vendorNameAr,
            vendorLogo: res.vendorLogo
          });

          this.vendor.set({
            name: res.vendorName,
            name_ar: res.vendorNameAr,
            logo: res.vendorLogo
          });

          const locationIds: string[] = Array.isArray(res.locationIds) ? res.locationIds : [];
          if (Array.isArray(res.locations) && res.locations.length > 0 && typeof res.locations[0] === 'object') {
            this.offerLocations.set(res.locations);
          } else if (locationIds.length > 0) {
            this.branchesService.getBranches().subscribe({
              next: (branches) => {
                const idSet = new Set(locationIds.map((id) => String(id)));
                const matched = (branches ?? [])
                  .filter((b) => idSet.has(String(b.locationId)))
                  .map((b) => ({
                    id: b.locationId,
                    _id: b.locationId,
                    locationId: b.locationId,
                    branch_name: b.locationName,
                    branch_name_ar: b.locationNameAr,
                    locationName: b.locationName,
                    locationNameAr: b.locationNameAr,
                    city: b.city,
                    cityAr: b.cityAr,
                  }));
                this.offerLocations.set(matched);
              },
              error: (err) => {
                console.error('Failed to load branches for offer locations', err);
                this.offerLocations.set([]);
              }
            });
          } else {
            this.offerLocations.set([]);
          }

          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
  }
}
