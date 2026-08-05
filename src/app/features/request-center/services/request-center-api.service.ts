import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateRequestPayload,
  ListRequestsQuery,
  PaginatedRequestsResponse,
  RequestChangeResponse,
  RequestDetailsResponse,
  RequestEntityResponse,
  RequestHistoryResponse,
  RequestMetricsResponse,
  RequestRemarksPayload,
  UpdateRequestPayload,
} from '../models/request-api.model';

/** Top-level request fields, sent as their own form parts rather than inside `requestData`. */
const SCALAR_FIELDS = ['entityType', 'entityId', 'requestType', 'title', 'actionType'] as const;

/**
 * Serializes a request payload as `multipart/form-data`.
 *
 * The scalar fields go in as plain parts and `requestData` as a JSON string, since multipart
 * has no notion of nested objects. Any `File` inside `requestData` is lifted out into a part
 * of its own, named after the field it came from (`image`, `logo`, …) — a File cannot be
 * JSON-serialized, and inlining one would write `{}` over the stored value.
 *
 * The `Content-Type` header is deliberately not set: the browser has to add it itself so the
 * multipart boundary matches the body it generated.
 */
function toRequestFormData(payload: Partial<CreateRequestPayload>): FormData {
  const form = new FormData();

  for (const field of SCALAR_FIELDS) {
    const value = payload[field];
    // `entityId` is omitted rather than blanked on CREATE requests — the backend rejects a
    // present-but-empty value.
    if (value === undefined || value === null || value === '') continue;
    form.append(field, String(value));
  }

  const requestData: Record<string, unknown> = { ...(payload.requestData ?? {}) };
  for (const [key, value] of Object.entries(requestData)) {
    if (!(value instanceof File)) continue;
    form.append(key, value, value.name);
    delete requestData[key];
  }

  form.append('requestData', JSON.stringify(requestData));
  return form;
}

/**
 * HTTP client for the request-cms-vendor workflow endpoints
 * (OfferAppBackend/src/app/request/controller/request-cms-vendor.controller.ts). The vendor
 * JWT is attached by httpInterceptor; vendorId/createdBy are derived server-side from that
 * token, so they are never sent from here.
 */
@Injectable({ providedIn: 'root' })
export class RequestCenterApiService {
  private readonly http = inject(HttpClient);
  // apiBaseUrl already ends in `/cmsVendor` — appending it again produced
  // `/api/v1/cmsVendor/cmsVendor/requests`, which 404s.
  private readonly baseUrl = `${environment.backendUrl}${environment.apiBaseUrl}/requests`;

  /** GET /cmsVendor/requests/metrics — KPI card counts for the authenticated vendor. */
  getMetrics(): Observable<RequestMetricsResponse> {
    return this.http.get<RequestMetricsResponse>(`${this.baseUrl}/metrics`);
  }

  /** GET /cmsVendor/requests — paginated, vendor-scoped list for the Request-Center table. */
  list(query: ListRequestsQuery = {}): Observable<PaginatedRequestsResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params = params.set(key, String(value));
    }
    return this.http.get<PaginatedRequestsResponse>(this.baseUrl, { params });
  }

  /**
   * GET /cmsVendor/requests/{id} — the request plus the live entity and the field diff.
   * Backs the detail page, which needs no other call (and works on a deep link).
   */
  getDetails(requestId: string): Observable<RequestDetailsResponse> {
    return this.http.get<RequestDetailsResponse>(`${this.baseUrl}/${requestId}`);
  }

  /** POST /cmsVendor/requests — create a DRAFT request. */
  create(payload: CreateRequestPayload): Observable<RequestEntityResponse> {
    return this.http.post<RequestEntityResponse>(this.baseUrl, toRequestFormData(payload));
  }

  /** PUT /cmsVendor/requests/{id} — update a DRAFT or SUBMITTED request. */
  update(requestId: string, payload: UpdateRequestPayload): Observable<RequestEntityResponse> {
    return this.http.put<RequestEntityResponse>(
      `${this.baseUrl}/${requestId}`,
      toRequestFormData(payload),
    );
  }

  /** POST /cmsVendor/requests/{id}/submit — transition DRAFT → SUBMITTED. */
  submit(requestId: string, payload: RequestRemarksPayload = {}): Observable<RequestEntityResponse> {
    return this.http.post<RequestEntityResponse>(`${this.baseUrl}/${requestId}/submit`, payload);
  }

  /** POST /cmsVendor/requests/{id}/recall — transition SUBMITTED → RECALLED. */
  recall(requestId: string, payload: RequestRemarksPayload = {}): Observable<RequestEntityResponse> {
    return this.http.post<RequestEntityResponse>(`${this.baseUrl}/${requestId}/recall`, payload);
  }

  /** POST /cmsVendor/requests/{id}/cancel — transition RETURNED → CANCELLED. */
  cancel(requestId: string, payload: RequestRemarksPayload = {}): Observable<RequestEntityResponse> {
    return this.http.post<RequestEntityResponse>(`${this.baseUrl}/${requestId}/cancel`, payload);
  }

  /**
   * GET /cmsVendor/checkRequest/{entityId} — `{ requestId }` when an in-flight UPDATE request
   * already targets this entity, `{}` otherwise. Note the path is mounted at bare
   * `/cmsVendor`, not under `/requests`.
   */
  checkActiveRequest(entityId: string): Observable<{ requestId?: string }> {
    return this.http.get<{ requestId?: string }>(
      `${environment.backendUrl}${environment.apiBaseUrl}/checkRequest/${entityId}`,
    );
  }

  /**
   * GET /cmsVendor/requests/getHistory/{id} — the chronological RequestLog audit trail
   * (submit / approve / reject / return / recall / cancel), oldest first.
   */
  getHistory(requestId: string): Observable<RequestHistoryResponse[]> {
    return this.http.get<RequestHistoryResponse[]>(`${this.baseUrl}/getHistory/${requestId}`);
  }

  /** GET /cmsVendor/requests/{id}/changes — field-level diff for an UPDATE request. */
  getChanges(requestId: string): Observable<RequestChangeResponse[]> {
    return this.http.get<RequestChangeResponse[]>(`${this.baseUrl}/${requestId}/changes`);
  }
}
