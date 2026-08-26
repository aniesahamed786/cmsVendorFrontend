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
}