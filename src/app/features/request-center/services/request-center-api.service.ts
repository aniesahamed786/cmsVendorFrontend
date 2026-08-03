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
  RequestMetricsResponse,
  RequestRemarksPayload,
  UpdateRequestPayload,
} from '../models/request-api.model';

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
    return this.http.post<RequestEntityResponse>(this.baseUrl, payload);
  }

  /** PUT /cmsVendor/requests/{id} — update a DRAFT or SUBMITTED request. */
  update(requestId: string, payload: UpdateRequestPayload): Observable<RequestEntityResponse> {
    return this.http.put<RequestEntityResponse>(`${this.baseUrl}/${requestId}`, payload);
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

  /** GET /cmsVendor/requests/{id}/changes — field-level diff for an UPDATE request. */
  getChanges(requestId: string): Observable<RequestChangeResponse[]> {
    return this.http.get<RequestChangeResponse[]>(`${this.baseUrl}/${requestId}/changes`);
  }
}
