import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      '/api/v1/cmsVendor/dashboard-stats'
    );
  }
}