import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { OfferDetailApi } from '../models/offerList';

@Injectable({
  providedIn: 'root',
})
export class OfferDetailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  /** GET /cmsVendor/offer/:offerId — backs both the offer details view and the edit form. */
  getOfferDetail(offerId: string) {
    return this.http.get<OfferDetailApi>(
      `${this.baseUrl}/offer/${offerId}`
    );
  }
}
