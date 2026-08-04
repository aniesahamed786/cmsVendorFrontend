import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { PrimeUIModules } from '../../../../core/prime.import';
import { HotelDetailsComponent } from '../hotel-details/hotel-details';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { environment } from '../../../../../environments/environment';

@Component({
    selector: 'app-offer-details',
    standalone: true,
    imports: [CommonModule, PrimeUIModules, DatePipe, HotelDetailsComponent, TranslatePipe],
    templateUrl: './offer-details.html',
    styleUrl: './offer-details.scss',
})
export class OfferDetails {
    private readonly i18n = inject(I18nService);
    readonly offerDetailIconBasePath = 'assets/svg/Offers/offer-details';
    offer = input.required<any>();
    locations = input<any[]>([]);
    loading = input<boolean>(false);
    /**
     * Field names an in-flight change request edits. Empty by default, so the offer details
     * page renders exactly as before; the Request Center passes a set to mark which sections
     * a request is changing.
     */
    editedFields = input<Set<string>>(new Set<string>());

    /** True when any of the given field names is being edited by the request being reviewed. */
    isEdited(...keys: string[]): boolean {
        const edited = this.editedFields();
        return edited.size > 0 && keys.some((key) => edited.has(key));
    }
    /** Placeholder cards rendered while loading; count only, values unused. */
    readonly skeletonCards = [0, 1, 2];
    offerMobileImageFailed = signal(false);
    offerDesktopImageFailed = signal(false);
    highlightMobileImageFailed = signal(false);
    highlightDesktopImageFailed = signal(false);
    failedCategoryIcons = signal<Record<string, true>>({});
    readonly backendUrl = environment.backendUrl;

    constructor() {
        effect(() => {
            this.offer();
            this.offerMobileImageFailed.set(false);
            this.offerDesktopImageFailed.set(false);
            this.highlightMobileImageFailed.set(false);
            this.highlightDesktopImageFailed.set(false);
            this.failedCategoryIcons.set({});
        });
    }

    isHotelOffer = computed(() => {
        return this.getCategories(this.offer()).some((category) => {
            const categoryName = category?.name?.trim().toLowerCase();
            return categoryName === 'hotels' || categoryName === 'hotel';
        });
    });

    getCategories(offer: any): any[] {
        console.log("Categories", offer)
        if (Array.isArray(offer?.categories)) {
            return offer.categories.filter((category: any) => category && typeof category === 'object');
        }

        if (offer?.category && typeof offer.category === 'object') {
            return [offer.category];
        }

        return [];
    }

    getCategoryLabel(category: any): string {
        const fallback = this.i18n.t('offerDetails.value.uncategorized');
        if (!category || typeof category !== 'object') return fallback;
        return category.name || category.name_ar || fallback;
    }

    getStartDate(offer: any): Date | null {
        const d = offer?.startDate?.$date || offer?.startDate;
        if (!d) return null;
        return new Date(d);
    }

    getEndDate(offer: any): Date | null {
        const d = offer?.expiryDate?.$date || offer?.expiryDate;
        if (!d) return null;
        return new Date(d);
    }

    getTags(offer: any): string[] {
        return Array.isArray(offer?.tags) ? offer.tags : [];
    }

    getTargetAudience(offer: any): string[] {
        const raw = offer?.targetAudience;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v: string) => v.length > 0);
    }

    hasAudience(offer: any): boolean {
        return this.getTargetAudience(offer).length > 0;
    }

    formatAudienceLabel(value: string): string {
        const v = String(value || '').trim();
        if (!v) return '';
        if (v.toLowerCase() === 'employees') return this.i18n.t('offerDetails.value.regularEmployees');
        return v;
    }

    getCategoryIcon(offer: any): string {
        return this.getCategories(offer)[0]?.icon || offer?.category?.icon || '';
    }

    isPrimeIcon(icon: string | null | undefined): boolean {
        return typeof icon === 'string' && icon.trim().startsWith('pi ');
    }

    isSvgIcon(icon: string | null | undefined): boolean {
        return typeof icon === 'string' && icon.trim().toLowerCase().includes('.svg');
    }

    hasCategoryIconError(icon: string | null | undefined): boolean {
        if (typeof icon !== 'string') return false;
        const normalized = icon.trim();
        return !!normalized && !!this.failedCategoryIcons()[normalized];
    }

    markCategoryIconError(icon: string | null | undefined): void {
        if (typeof icon !== 'string') return;
        const normalized = icon.trim();
        if (!normalized) return;

        this.failedCategoryIcons.update((current) => ({
            ...current,
            [normalized]: true,
        }));
    }

    getDiscountTypeLabel(offer: any, lang: 'en' | 'ar'): string {
        const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
        const isOthers = type === 'other' || type === 'others';
        
        if (type === 'percentage') {
            return lang === 'en' ? 'Percentage:' : 'النسبة:';
        }
        
        if (isOthers) {
            return lang === 'en' ? 'Amount:' : 'المبلغ:';
        }
        
        return lang === 'en' ? 'Discount Amount:' : 'مبلغ الخصم:';
    }

    getDiscountAmount(offer: any, lang: 'en' | 'ar'): string {
        const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
        const amount = lang === 'ar' 
            ? (offer?.discount_amount_ar || offer?.Discount_amount_ar || offer?.discountValueAr || offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '')
            : (offer?.discount_amount || offer?.Discount_amount || offer?.discountValue || '');
        let normalized = String(amount || '').replace('%', '').trim();

        if (type === 'other' || type === 'others') {
            normalized = normalized.replace(/\bdiscount\b/gi, '').replace(/\s{2,}/g, ' ').trim();
        }

        return normalized;
    }

    isPercentageDiscount(offer: any): boolean {
        const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
        return type === 'percentage';
    }

    isOtherDiscount(offer: any): boolean {
        const type = (offer?.discount_type || offer?.discountType || '').toLowerCase().trim();
        return type === 'other' || type === 'others';
    }

    getDiscountLabel(offer: any): string {
        if (this.isPercentageDiscount(offer)) {
            return `${this.getDiscountAmount(offer, 'en')}%`;
        }
        return this.getDiscountAmount(offer, 'en') ? `${this.getDiscountAmount(offer, 'en')} Off` : this.i18n.t('offerDetails.value.na');
    }

    getInstructions(offer: any): string {
        return offer?.howToAvail || offer?.howToAvail_ar || 'No instructions';
    }

    formatOfferMode(offer: any): string {
        const mode = (offer?.offerMode || 'in store').toLowerCase();
        if (mode === 'online') return this.i18n.t('offerDetails.mode.digital');
        if (mode === 'both') return this.i18n.t('offerDetails.mode.hybrid');
        return this.i18n.t('offerDetails.mode.inStore');
    }

    getHighlightTitle(offer: any): string {
        return offer?.highlight_title || this.i18n.t('offerDetails.value.na');
    }

    getHighlightTitleAr(offer: any): string {
        return offer?.highlight_title_ar || '';
    }

    getHighlightDescription(offer: any): string {
        return offer?.highlight_description || this.i18n.t('offerDetails.value.na');
    }

    getHighlightDescriptionAr(offer: any): string {
        return offer?.highlight_description_ar || '';
    }

    getOfferMobileImage(offer: any): string | null {
        if (this.offerMobileImageFailed()) return null;
        // const img = offer?.image || offer?.coverImage || offer?.offer_image || offer?.offerImage || offer?.thumbnail;
        // if (typeof img === 'string' && img.trim()) return img;
        // if (img?.url && typeof img.url === 'string') return img.url;
        // if (Array.isArray(img) && img.length > 0) {
            //     const first = img[0];
            //     if (typeof first === 'string') return first;
            //     if (first?.url) return first.url;
            // }
            // return null;
        const img = offer?.offerImages?.image || '';
        return this.backendUrl + img.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
    }

    getOfferDesktopImage(offer: any): string | null {
        if (this.offerDesktopImageFailed()) return null;
        // const img = offer?.image_landscape || offer?.coverImageLandscape || offer?.image || offer?.coverImage || offer?.offer_image || offer?.offerImage || offer?.thumbnail;
        // if (typeof img === 'string' && img.trim()) return img;
        // if (img?.url && typeof img.url === 'string') return img.url;
        // if (Array.isArray(img) && img.length > 0) {
        //     const first = img[0];
        //     if (typeof first === 'string') return first;
        //     if (first?.url) return first.url;
        // }
        // return null;
        const img = offer?.offerImages?.imageLandscape || '';
        return this.backendUrl + img.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
    }

    getHighlightMobileImage(offer: any): string | null {
        if (this.highlightMobileImageFailed()) return null;
        const img = offer?.highlight_image;
        if (typeof img === 'string' && img.trim()) return img;
        if (img?.url && typeof img.url === 'string') return img.url;
        return null;
    }

    getHighlightDesktopImage(offer: any): string | null {
        if (this.highlightDesktopImageFailed()) return null;
        const img = offer?.highlight_image_landscape || offer?.highlight_image;
        if (typeof img === 'string' && img.trim()) return img;
        if (img?.url && typeof img.url === 'string') return img.url;
        return null;
    }

    markOfferMobileImageError(): void {
        this.offerMobileImageFailed.set(true);
    }

    markOfferDesktopImageError(): void {
        this.offerDesktopImageFailed.set(true);
    }

    markHighlightMobileImageError(): void {
        this.highlightMobileImageFailed.set(true);
    }

    markHighlightDesktopImageError(): void {
        this.highlightDesktopImageFailed.set(true);
    }

    getLocationTitle(loc: any): string {
        return loc?.branch_name || loc?.name || loc?.title || this.i18n.t('offerDetails.value.unknownLocation');
    }

    getLocationSubtitle(loc: any): string {
        return [
            loc?.city,
            loc?.region,
            loc?.country,
            loc?.address,
        ]
            .filter((value) => typeof value === 'string' && value.trim())
            .join(', ');
    }

    formatContactValue(value: string | string[] | null | undefined): string {
        if (Array.isArray(value)) {
            const formatted = value
                .map((item) => String(item ?? '').trim())
                .filter(Boolean)
                .join(', ');
            return formatted || this.i18n.t('offerDetails.value.na');
        }

        if (typeof value === 'string') {
            return value.trim() || this.i18n.t('offerDetails.value.na');
        }

        return value ? String(value) : this.i18n.t('offerDetails.value.na');
    }

    hasContactInformation(offer: any): boolean {
        return this.hasMeaningfulContactValue(offer?.mobile) ||
            this.hasMeaningfulContactValue(offer?.telephone) ||
            this.hasMeaningfulContactValue(offer?.email);
    }

    private hasMeaningfulContactValue(value: string | string[] | null | undefined): boolean {
        if (Array.isArray(value)) {
            return value.some((item) => String(item ?? '').trim().length > 0);
        }

        if (typeof value === 'string') {
            return value.trim().length > 0;
        }

        return value != null && String(value).trim().length > 0;
    }

    getOfferDetailIconPath(iconName: string): string {
        return `${this.offerDetailIconBasePath}/${iconName}`;
    }

    getCategoryIconImage(icon:string){
        return this.backendUrl + icon.replace('/api/v1/media/', '/api/v1/cmsVendor/media/')
    }
}
