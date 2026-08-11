import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ActiveStoreOffer,
  OfferLocation,
  RecordRedemptionPayload,
  RedemptionListResponse,
} from '../models/redemption.model';

/**
 * Vendor redemption API.
 *
 * The vendor is identified by the bearer token (attached by `httpInterceptor`), so none
 * of these calls take a vendorId — the backend scopes every response to the authenticated
 * vendor.
 */
@Injectable({ providedIn: 'root' })
export class RedemptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  /** Active in-store offers this vendor can redeem against (feeds the Offer select). */
  getActiveStoreOffers(): Observable<ActiveStoreOffer[]> {
    return this.http.get<ActiveStoreOffer[]>(`${this.baseUrl}/getActiveStoreOffers`);
  }

  /**
   * Branches where a given offer is redeemable. Offers are not available at every
   * branch, so the Branch select is populated per selected offer rather than once.
   */
  getOfferLocations(offerId: string): Observable<OfferLocation[]> {
    return this.http.get<OfferLocation[]>(`${this.baseUrl}/offer/${offerId}/locations`);
  }

  /** Record a redemption for a member against one offer. */
  recordRedemption(payload: RecordRedemptionPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/recordRedemption`, payload);
  }

  /** Paged redemption history. `page` is 1-based. */
  getRedemptions(page: number, pageSize: number): Observable<RedemptionListResponse> {
    return this.http.get<RedemptionListResponse>(`${this.baseUrl}/getRedemptions`, {
      params: { page, pageSize },
    });
  }
}
