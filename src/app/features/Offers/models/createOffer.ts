/** Offer Settings radios in CMS (maps to API `offerMode`). */
export type OfferFormMode = 'In-Store' | 'Digital' | 'In-Store & Digital';

/** API / backend `offerMode` values. */
export type OfferModePayload = 'in-store' | 'digital' | 'in-store, digital';

export function mapFormModeToOfferMode(mode: OfferFormMode | null | undefined): OfferModePayload {
    if (mode === 'Digital') return 'digital';
    if (mode === 'In-Store & Digital') return 'in-store, digital';
    return 'in-store';
}

export function mapOfferModeToFormMode(offerMode: string | null | undefined): OfferFormMode {
    // ponytail: tolerates the legacy 'in store' / 'online' / 'both' values too, drop once the backend is migrated.
    const m = String(offerMode ?? '').trim().toLowerCase();
    if (m === 'both') return 'In-Store & Digital';
    const digital = m.includes('digital') || m.includes('online');
    if (digital) return m.includes('store') ? 'In-Store & Digital' : 'Digital';
    return 'In-Store';
}

export interface OfferFormModel {
    vendorId: string;
    titleEn: string;
    titleAr: string;
    description: string;
    description_ar: string;
    discountEn: string;
    discountAr: string;
    expiryDate: string;
    categoryId: string;
    categoryIds?: string[];
    instructionsEn: string;
    instructionsAr: string;
    tags: string[];
    /** UI radio values: In-Store, Digital, In-Store & Digital */
    mode: OfferFormMode;
    targetAudience?: string[];
    isHighlightEnabled?: boolean;
    image_landscape?: string;
    highlight_image?: string;
    highlight_image_landscape?: string;
}

export interface CreateOfferPayload {
    vendorId: string;
    categoryId?: string;
    categoryIds?: string[];

    title: string;
    title_ar: string;
    description: string;
    description_ar: string;

    /** Target audience segment(s) this offer is intended for. */
    targetAudience?: string[];

    /** Short highlight title (English) */
    highlight_title?: string;
    /** Short highlight title (Arabic) */
    highlight_title_ar?: string;
    /** Highlight/teaser description (English) */
    highlight_description?: string;
    /** Highlight/teaser description (Arabic) */
    highlight_description_ar?: string;

    /** Legacy fields kept for backward compatibility but not used by new API */
    highlights?: string;
    highlights_ar?: string;
    howToAvail: string;
    howToAvail_ar?: string;

    discountType: "fixed" | "percentage" | "both";
    discount_amount?: string;
    discount_amount_ar?: string;
    discountCode?: string;
    discount_url?: string;
    /** Optional website link for in-store / in-store & digital offers. */
    website?: string;

    /** Where the offer can be used (in store, online, or both). Stored as offerMode. */
    offerMode: OfferModePayload;

    startDate: string; // ISO date
    expiryDate: string; // ISO date

    /** Selected vendor branch IDs assigned to this offer. */
    locationIds?: string[];

    isActive: boolean;
    isFeatured: boolean;
    isHighlightEnabled: boolean;
    isPartnerHotel: boolean;

    hotelStarRating?: boolean;
    hotelAmenitites?: string[];
    hotelAmenitites_ar?: string[];

    rooms?: number | null;
    roomDetails?: OfferRoomPayload[];

    currency?: string;
    currency_ar?: string | null;

    taxValue?: string;
    taxValue_ar?: string;

    email?: string[];
    mobile?: string[];
    telephone?: string[];
    contacts?: string[];

    enableMapSearch: boolean;

    searchKeywords?: string[];
    tags?: string[];

    createdByRole?: string;

    image?: File; // binary upload
    image_landscape?: File; // binary upload
    highlight_image?: File; // binary upload
    highlight_image_landscape?: File; // binary upload
}

export interface OfferRoomPayload {
    roomName: string;
    roomNameAr: string;
    rates: OfferRoomRatePayload[];
}

export interface OfferRoomRatePayload {
    season: string;
    seasonAr: string;
    value: string;
}

export interface OfferListItem {
    _id: MongoId;
    vendor: VendorInfo;
    category: CategoryInfo | null;

    title: string;
    title_ar: string;

    description: string;
    description_ar: string;

    targetAudience?: string[];

    highlights: string;
    highlights_ar: string;

    howToAvail: string;
    howToAvail_ar: string;

    discountType: "fixed" | "percentage" | "both";
    discount_amount?: string;
    discount_amount_ar?: string;
    Discount_amount?: string;
    Discount_amount_ar?: string;
    discountCode: string;
    discount_url: string;
    website?: string;

    /** Where the offer can be used. Backend returns offerMode. */
    offerMode?: string;

    startDate: MongoDate;
    expiryDate: MongoDate;

    image: string;
    image_landscape?: string;
    featuredImage: string;
    highlight_image?: string;

    isActive: boolean | string;
    status?: 'Active' | 'Scheduled' | 'Expired' | 'Inactive';
    isFeatured: boolean | string;
    isHighlightEnabled?: boolean;
    isPartnerHotel: boolean | string;

    hotelStarRating: boolean | string;
    hotelAmenitites: string[] | string;
    hotelAmenitites_ar?: string[] | string;

    rooms: number | string | null;

    currency: string;
    currency_ar: string | null;

    taxValue: string;
    taxValue_ar: string;

    email: string | string[];
    mobile: string | string[];
    telephone: string | string[];
    contacts: string | string[];

    enableMapSearch: boolean | string;

    searchKeywords: string[] | string;
    tags: string[] | string;

    createdByRole: string;

    createdAt: MongoDate;
    updatedAt: MongoDate;

    __v: number;
}

export interface MongoId {
    $oid: string;
}

export interface MongoDate {
    $date: string;
}

export interface VendorInfo {
    _id: MongoId;
    name: string;
    name_ar: string;
    logo?: string;
}

export interface VendorLocation {
    branchName: string | null;
    address: string | null;
    googleMapLink: string | null;
}

export interface CategoryInfo {
    _id: MongoId;
    icon: string;
    image: string;
    name: string;
    name_ar: string;
    order: string;
    createdAt: MongoDate;
    updatedAt: MongoDate;
}
