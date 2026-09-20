import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DashboardStats {
  totalRedemptions: number;
  activeOffers: number;
  pendingRequests: number;
  expiringSoonOffers: number;
}

// ponytail: only the fields the dashboard card renders; widen when another view needs the rest
export interface TopPerformingOfferApi {
  offer?: {
    offerId?: string;
    offerTitle?: string;
    offerTitleAr?: string;
    availability?: string[];
    offerLogo?: string;
  } | null;
  redemptions?: { total?: number } | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${this.baseUrl}/dashboard-stats`
    );
  }

  getTopPerformingOffer(): Observable<TopPerformingOfferApi | null> {
    return this.http.get<TopPerformingOfferApi | null>(
      `${this.baseUrl}/top-performing-offer`
    );
  }
}