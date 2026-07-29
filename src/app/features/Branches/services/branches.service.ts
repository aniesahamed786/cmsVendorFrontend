import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay,map } from 'rxjs/operators';

export interface BranchKPIs {
  totalBranches: number;
  activeBranches: number;
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
    return of({
      totalBranches: 5,
      activeBranches: 5,
      totalRedemptions: 2847,
      pendingRequests: 3
    }).pipe(delay(500));
  }

  getTopPerformers(): Observable<TopPerformer[]> {
    return of([
      { id: '1', name: 'East Branch', redemptions: 20500 },
      { id: '2', name: 'West Branch', redemptions: 15800 },
      { id: '3', name: 'South Branch', redemptions: 10500 },
      { id: '4', name: 'North Branch', redemptions: 7500 }
    ]).pipe(delay(500));
  }

  private http = inject(HttpClient);

getBranches(): Observable<BranchRow[]> {
  return this.http.get<BranchRow[]>(
    '/api/v1/cmsVendor/locations'
  );
}
}
