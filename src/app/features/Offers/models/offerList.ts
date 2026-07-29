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