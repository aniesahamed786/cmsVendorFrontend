import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface BranchKPIs {
  totalLocations: number;
  activeLocations: number;
  totalRedemptions: number;
  pendingRequests: number;
}

export interface TopPerformer {
  id: string;
  name: string;
  redemptions: number;
}

export interface BranchRow {
  locationId: string;
  locationName: string;
  locationNameAr: string;
  city: string;
  cityAr: string;
  totalOffers: number;
  representativeName: string;
  representativeNameAr: string;
  latitude: string;
  longitude: string;
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class BranchesService {
  private http = inject(HttpClient);

  getKPIs(): Observable<BranchKPIs> {
    return this.http.get<BranchKPIs>('/api/v1/cmsVendor/location-stats');
  }

  getBranches(): Observable<BranchRow[]> {
    return this.http.get<BranchRow[]>('/api/v1/cmsVendor/locations');
  }
}

