import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  latitude:string;
  longitude:string;
  status:string;
}

@Injectable({
  providedIn: 'root'
})
export class BranchesService {
  getKPIs(): Observable<BranchKPIs> {
    return this.http.get<BranchKPIs>('/api/v1/cmsVendor/location-stats');
  }

getTopPerformers(): Observable<TopPerformer[]> {
  return this.getBranches().pipe(
    map((branches) =>
      branches.map((branch) => ({
        id: branch.locationId,
        name: branch.locationName,
        redemptions: 0, // TODO: Replace when backend provides this field
      }))
    )
  );
}

  private http = inject(HttpClient);

getBranches(): Observable<BranchRow[]> {
  return this.http.get<BranchRow[]>(
    '/api/v1/cmsVendor/locations'
  );
}
}
