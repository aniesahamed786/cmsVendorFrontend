import { OfferDetailApi } from './offerList';

/**
 * Adapts GET /cmsVendor/offer/:offerId's response into the raw-offer-document shape that
 * `OfferForm.mapOfferToForm()` expects (it was written against the admin-side raw `Offer`
 * document — snake_case Arabic variants, `offerMode` as a single string, nested `hotel_details`,
 * etc.). Keeping this transform here, next to the API model, means `OfferForm` never needs to
 * know which endpoint/DTO shape fed it — it only ever sees the one shape it already understands.
 */
export function toEditableOfferData(api: OfferDetailApi): Record<string, unknown> {
  return {
    _id: api.offerId,
    vendorId: api.vendorId,

    title: api.offerTitle,
    title_ar: api.offerTitleAr,
    description: api.description,
    description_ar: api.description,

    discount_amount: api.discount,
    discount_amount_ar: api.discountAmountAr,
    discountCode: api.discountCode,
    discountType: api.discountType,

    startDate: api.startDate,
    expiryDate: api.endDate,

    categoryIds: (api.categories ?? []).map((c) => c.categoryId),
    tags: api.tags ?? [],
    targetAudience: api.audience ?? [],

    howToAvail: api.redemptionInstructions?.instructions ?? '',
    howToAvail_ar: api.redemptionInstructions?.instructionsAr ?? '',

    discount_url: api.discountUrl,
    website: api.website,

    offerMode: toSingleOfferMode(api.availability),

    mobile: api.contactDetails?.mobile ?? [],
    telephone: api.contactDetails?.telephone ?? [],
    email: api.contactDetails?.email ?? [],

    image: api.offerImages?.image ?? null,
    image_landscape: api.offerImages?.imageLandscape ?? null,

    locationIds: api.locationIds ?? [],

    isHighlightEnabled: api.isHighlightEnabled,
    highlight_title: api.highlightTitle,
    highlight_title_ar: api.highlightTitleAr,
    highlight_description: api.highlightDescription,
    highlight_description_ar: api.highlightDescriptionAr,
    highlight_image: api.highlightImage || null,
    highlight_image_landscape: api.highlightImageLandscape || null,

    hotel_details: api.hotelDetails
      ? {
          taxValue: api.hotelDetails.taxValue,
          taxValue_ar: api.hotelDetails.taxValueAr,
          currency: api.hotelDetails.currency,
          hotelAmenitites: api.hotelDetails.hotelAmenities,
          hotelAmenitites_ar: api.hotelDetails.hotelAmenitiesAr,
          roomDetails: api.hotelDetails.roomDetails,
        }
      : null,
  };
}

/** availability (multi-value) -> offerMode (single string), same rule the offer details view uses. */
function toSingleOfferMode(availability: string[] | undefined): 'in store' | 'online' | 'both' {
  if (!availability || availability.length === 0) return 'in store';
  if (availability.length > 1) return 'both';
  return availability[0] === 'online' ? 'online' : 'in store';
}
