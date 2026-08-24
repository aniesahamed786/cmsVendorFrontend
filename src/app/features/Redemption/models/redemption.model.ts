
export interface ActiveStoreOffer {
  offerId: string;
  offerTitle: string;
  offerTitleAr: string;
}
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

export interface BulkUploadRowResult {
  index: number;
  success: boolean;
  error?: string;
}

export interface BulkUploadResponse {
  totalRows: number;
  insertedCount: number;
  failedCount: number;
  results: BulkUploadRowResult[];
}

export type RedemptionTransactionType = 'SINGLE' | 'COLLECTIVE';
interface RedemptionPayloadBase {
  offerId: string;
  totalAmountIncVat: number;
  totalAmountPaid: number;
  currency: string;
  discountAmount: number;
  branchId?: string;
  mobileNumber?: string;
}
export interface SingleRedemptionPayload extends RedemptionPayloadBase {
  transactionType: 'SINGLE';
  membershipId: number;
  transactionDate: string;
}

export interface CollectiveRedemptionPayload extends RedemptionPayloadBase {
  transactionType: 'COLLECTIVE';
  membershipId?: number;
  startDate: string;
  endDate: string;
}

export type RecordRedemptionPayload = SingleRedemptionPayload | CollectiveRedemptionPayload;

export interface RedemptionRow {
  membershipId: number;
  offerTitle: string;
  offerTitleAr: string;
  totalAmountPaid: number;
  discountAmount: number;
  amountSaved: number;
  currency: string;
}

export interface RedemptionListResponse {
  data: RedemptionRow[];
  total: number;
  page: number;
  pageSize: number;
}
