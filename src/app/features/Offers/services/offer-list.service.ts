import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { OffersResponse } from '../models/offerList';

@Injectable({
  providedIn: 'root',
})
export class OfferListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getOffers(page: number = 1, pageSize: number = 10) {
    return this.http.get<OffersResponse>(
      `${this.baseUrl}/offers`,
      {
        params: {
          page,
          pageSize
        }
      }
    );
  }
}
