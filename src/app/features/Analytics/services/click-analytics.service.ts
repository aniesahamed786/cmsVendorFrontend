import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface VendorClickAnalyticsSlice {
  totalClickEvents: number;
  uniqueUsersWhoClicked: number;
}

export interface VendorClickPerOffer {
  offerId: string;
  totalClickEvents: number;
  uniqueUsersWhoClicked: number;
}

export interface VendorClickAnalyticsResponse {
  vendorId: string;
  vendor: VendorClickAnalyticsSlice;
  offersAggregate: VendorClickAnalyticsSlice;
  perOffer: VendorClickPerOffer[];
}

@Injectable({ providedIn: 'root' })
export class VendorClickAnalyticsService {
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getVendorAnalytics(vendorId: string): Observable<VendorClickAnalyticsResponse> {
    const params = new HttpParams().set('vendorId', vendorId);
    return this.http.get<VendorClickAnalyticsResponse>(`${this.baseUrl}/user-clicks/stats/vendor-analytics`, {
      params,
    });
  }
}
