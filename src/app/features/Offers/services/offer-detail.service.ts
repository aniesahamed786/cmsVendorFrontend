import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { OffersResponse } from '../models/offerList';

@Injectable({
  providedIn: 'root',
})
export class OfferDetailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getOfferDetail(offerId: string) {
    return this.http.get<OffersResponse>(
      `${this.baseUrl}/cmsVendor/offer/${offerId}`
    );
  }
}
