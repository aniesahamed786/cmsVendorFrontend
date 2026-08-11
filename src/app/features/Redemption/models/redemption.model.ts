/**
 * Wire formats for the vendor redemption endpoints.
 * Field names mirror the backend payloads exactly — do not rename them here; map to
 * UI-friendly shapes in the component instead.
 */

/** `GET /getActiveStoreOffers` — offers the vendor may currently redeem against. */
export interface ActiveStoreOffer {
  offerId: string;
  offerTitle: string;
  offerTitleAr: string;
}

/** `GET /offer/{offerId}/locations` — branches where the given offer is redeemable. */
export interface OfferLocation {
  locationId: string;
  locationName: string;
  locationNameAr: string;
  city: string;
  cityAr: string;
  region: string;
  regionAr: string;
  country: string;
  countryAr: string;
}

/**
 * Only SINGLE is supported by the UI today. COLLECTIVE (and the bulk Excel upload
 * path) is planned but not yet built — the form always submits SINGLE.
 */
export type RedemptionTransactionType = 'SINGLE' | 'COLLECTIVE';

/**
 * `POST /recordRedemption` request body.
 *
 * Backend rules worth knowing: the offer must be in-store (offerMode may also include
 * digital), must belong to the authenticated vendor, and `transactionDate` must fall
 * inside the offer's startDate/expiryDate window — a 400 usually means one of those
 * three, so surface the API's own message rather than a generic failure.
 */
export interface RecordRedemptionPayload {
  membershipId: number;
  /** Optional — the key is omitted entirely when the field is left blank. */
  mobileNumber?: string;
  offerId: string;
  transactionType: RedemptionTransactionType;
  /** Invoice total including VAT. */
  totalAmountIncVat: number;
  /** ISO-8601 UTC, e.g. `2026-08-10T10:00:00.000Z`. */
  transactionDate: string;
  totalAmountPaid: number;
  currency: string;
  discountAmount: number;
  /** Optional — the key is omitted entirely when no branch is selected. */
  branchId?: string;
}

/** One row of `GET /getRedemptions`. */
export interface RedemptionRow {
  membershipId: number;
  offerTitle: string;
  offerTitleAr: string;
  totalAmountPaid: number;
  discountAmount: number;
  amountSaved: number;
  currency: string;
}

/** `GET /getRedemptions?page=&pageSize=` — server-side paged envelope. */
export interface RedemptionListResponse {
  data: RedemptionRow[];
  total: number;
  page: number;
  pageSize: number;
}
