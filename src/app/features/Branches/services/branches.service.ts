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
  region?: string;
  regionAr?: string;
  country?: string;
  countryAr?: string;
  totalOffers: number;
  representativeName: string;
  representativeNameAr: string;
  latitude: string | number;
  longitude: string | number;
  googleMapLink?: string;
  status?: string;
}

export interface BranchesResponse {
  vendorLogo: string;
  locations: BranchRow[];
}

@Injectable({
  providedIn: 'root',
})
export class BranchesService {
  private http = inject(HttpClient);

  getKPIs(): Observable<BranchKPIs> {
    return this.http.get<BranchKPIs>('/api/v1/cmsVendor/location-stats');
  }

  getBranches(): Observable<BranchesResponse> {
    return this.http.get<BranchesResponse>('/api/v1/cmsVendor/locations');
  }
}

