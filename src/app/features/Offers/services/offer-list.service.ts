import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { OffersQuery, OffersResponse } from '../models/offerList';

@Injectable({
  providedIn: 'root',
})
export class OfferListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getOffers(query: OffersQuery = {}) {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== '')
    ) as Record<string, string | number>;
    return this.http.get<OffersResponse>(
      `${this.baseUrl}/offers`,
      { params }
    );
  }
}
