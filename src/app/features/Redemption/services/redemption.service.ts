import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ActiveStoreOffer,
  BulkUploadResponse,
  OfferLocation,
  RecordRedemptionPayload,
  RedemptionListResponse,
} from '../models/redemption.model';

@Injectable({ providedIn: 'root' })
export class RedemptionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getActiveStoreOffers(): Observable<ActiveStoreOffer[]> {
    return this.http.get<ActiveStoreOffer[]>(`${this.baseUrl}/getActiveStoreOffers`);
  }

  getOfferLocations(offerId: string): Observable<OfferLocation[]> {
    return this.http.get<OfferLocation[]>(`${this.baseUrl}/offer/${offerId}/locations`);
  }

  recordRedemption(payload: RecordRedemptionPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/recordRedemption`, payload);
  }

  uploadBulkRedemptions(payloads: RecordRedemptionPayload[]): Observable<BulkUploadResponse> {
    return this.http.post<BulkUploadResponse>(`${this.baseUrl}/uploadBulkRedemptions`, payloads);
  }

  getRedemptions(page: number, pageSize: number): Observable<RedemptionListResponse> {
    return this.http.get<RedemptionListResponse>(`${this.baseUrl}/getRedemptions`, {
      params: { page, pageSize },
    });
  }
}
