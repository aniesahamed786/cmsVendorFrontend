import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OfferStats {
  totalOffers: number;
  activeOffers: number;
  scheduledOffers: number;
  expiringSoonOffers: number;
}

@Injectable({
  providedIn: 'root'
})
export class OffersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getOfferStats(): Observable<OfferStats> {
    return this.http.get<OfferStats>(
      `${this.baseUrl}/offer-stats`
    );
  }
}