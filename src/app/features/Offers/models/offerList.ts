export interface OfferApi {
    offerId: string;
    offerTitle: string;
    offerTitleAr: string;
    discount: string;
    discountType: 'percentage' | 'fixed';
    availability: string[];
    startDate: {
        $date: string;
    };
    endDate: {
        $date: string;
    };
    status: string;
    offerLogo: string;
    image: string
}

export interface OffersResponse {
    data: OfferApi[];
    total: number;
    page: number;
    pageSize: number;
}

// ---- GET /cmsVendor/offer/:offerId — matches CmsVendorOfferDetailsResponseDto on the backend ----

export interface OfferCategoryApi {
    categoryId: string;
    categoryName: string;
    categoryNameAr: string;
    categoryLogo: string;
}

export interface OfferHotelRoomRateApi {
    season: string;
    seasonAr: string;
    value: number;
}

export interface OfferHotelRoomApi {
    roomName: string;
    roomNameAr: string;
    rates: OfferHotelRoomRateApi[];
}

export interface OfferHotelDetailsApi {
    taxValue: string;
    taxValueAr: string;
    currency: string;
    hotelAmenities: string[];
    hotelAmenitiesAr: string[];
    roomDetails: OfferHotelRoomApi[];
}

export interface OfferDetailApi {
    offerId: string;
    offerTitle: string;
    offerTitleAr: string;
    discount: string;
    discountType: string;
    availability: string[];
    startDate: { $date: string };
    endDate: { $date: string };
    status: string;
    offerLogo: string;
    description: string;
    vendorName: string;
    vendorNameAr: string;
    vendorLogo: string;
    vendorId: string;
    categories: OfferCategoryApi[];
    tags: string[];
    redemptionInstructions: { instructions: string; instructionsAr: string };
    audience: string[];
    offerImages: { image: string; imageLandscape: string };
    contactDetails: { mobile: string[]; telephone: string[]; email: string[] };
    locationIds: string[];
    discountAmountAr: string;
    discountCode: string;
    discountUrl: string;
    website: string;
    isHighlightEnabled: boolean;
    highlightTitle: string;
    highlightTitleAr: string;
    highlightDescription: string;
    highlightDescriptionAr: string;
    highlightImage: string;
    highlightImageLandscape: string;
    hotelDetails: OfferHotelDetailsApi | null;
}