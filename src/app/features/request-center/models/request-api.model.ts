// HTTP contract for the request-cms-vendor endpoints. Mirrors the backend DTOs/schemas in
// OfferAppBackend/src/app/request. Kept separate from the UI models (request.model.ts) so the
// wire shape and the view-model can evolve independently.

export type ApiRequestEntityType = 'OFFER' | 'STORE' | 'HIGHLIGHT' | 'PROFILE';
export type ApiRequestType = 'CREATE' | 'UPDATE';
export type ApiRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECALLED'
  | 'CANCELLED';

/** GET /cmsVendor/requests/metrics — matches the RequestStats UI shape 1:1. */
export interface RequestMetricsResponse {
  pendingOffer: number;
  pendingStore: number;
  pendingProfile: number;
  rejected: number;
}

/** One row of GET /cmsVendor/requests (the summary projection). */
export interface RequestSummaryResponse {
  requestId: string;
  entityType: ApiRequestEntityType;
  requestType: ApiRequestType;
  title: string;
  status: ApiRequestStatus;
  updatedOn: string;
}

/** Paginated envelope returned by GET /cmsVendor/requests. */
export interface PaginatedRequestsResponse {
  data: RequestSummaryResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListRequestsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'requestId' | 'entityType' | 'requestType' | 'title' | 'status' | 'updatedOn';
  sortOrder?: 'asc' | 'desc';
}

/** POST /cmsVendor/requests body. */
export interface CreateRequestPayload {
  entityType: ApiRequestEntityType;
  /** Required for UPDATE requests, must be omitted/null for CREATE. */
  entityId?: string | null;
  requestType: ApiRequestType;
  title: string;
  requestData: Record<string, unknown>;
}

/** PUT /cmsVendor/requests/{id} body — every field optional. */
export type UpdateRequestPayload = Partial<CreateRequestPayload>;

/** Optional remarks accepted by submit/recall/cancel. */
export interface RequestRemarksPayload {
  remarks?: string;
}

export interface RequestAdminAction {
  action: string | null;
  reason: string | null;
  actionBy: string | null;
  actionOn: string | null;
}

/** The persisted request document returned by create/update/submit/recall/cancel. */
export interface RequestEntityResponse {
  requestId: string;
  entityType: ApiRequestEntityType;
  entityId: string | null;
  requestType: ApiRequestType;
  vendorId: string;
  title: string;
  status: ApiRequestStatus;
  requestData: Record<string, unknown>;
  adminAction: RequestAdminAction | null;
  createdBy: string;
  createdOn: string;
  updatedOn: string;
  submittedOn: string | null;
}

/** One row from GET /cmsVendor/requests/{id}/changes. */
export interface RequestChangeResponse {
  requestId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  displayOrder: number | null;
}
