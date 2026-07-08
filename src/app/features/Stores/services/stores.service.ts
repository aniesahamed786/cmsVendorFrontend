import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface StoreKPIs {
  totalStores: number;
  activeStores: number;
  totalRedemptions: number;
  pendingRequests: number;
}

export interface TopPerformer {
  id: string;
  name: string;
  redemptions: number;
}

export interface StoreRow {
  id: string;
  name: string;
  totalOffers: number;
  location: string;
  manager: string;
  status?: string;
  region?: string;
  dateAdded?: Date;
  latitude?: number;
  longitude?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StoresService {
  getKPIs(): Observable<StoreKPIs> {
    return of({
      totalStores: 5,
      activeStores: 5,
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

  getStores(): Observable<StoreRow[]> {
    return of([
      { id: '1', name: 'East Branch', totalOffers: 12, location: 'Eastern Province', manager: 'Abdullah', status: 'Active', region: 'East', dateAdded: new Date('2023-10-01'), latitude: 26.2361, longitude: 50.0326 },
      { id: '2', name: 'West Branch', totalOffers: 8, location: 'Western Province', manager: 'Al Saud', status: 'Active', region: 'West', dateAdded: new Date('2023-09-15'), latitude: 21.4858, longitude: 39.1925 },
      { id: '3', name: 'South Branch', totalOffers: 20, location: 'Southern Province', manager: 'Abd Al Aziz', status: 'Active', region: 'South', dateAdded: new Date('2023-11-20'), latitude: 18.2164, longitude: 42.5053 },
      { id: '4', name: 'North Branch', totalOffers: 10, location: 'Northern Province', manager: 'Mohamed Rashed', status: 'Active', region: 'North', dateAdded: new Date('2023-08-05'), latitude: 27.5114, longitude: 41.7208 },
      { id: '5', name: 'Dhahran Branch', totalOffers: 22, location: 'Dhahran', manager: 'Othman Al Amiri', status: 'Active', region: 'East', dateAdded: new Date('2024-01-10'), latitude: 26.3, longitude: 50.1 },
      { id: '6', name: 'Riyadh Branch', totalOffers: 18, location: 'Riyadh', manager: 'Mustafa Al Ansari', status: 'Active', region: 'Central', dateAdded: new Date('2023-12-01'), latitude: 24.7136, longitude: 46.6753 },
      { id: '7', name: 'Khobar Branch', totalOffers: 10, location: 'Khobar', manager: 'Hasan Ibrahim', status: 'Active', region: 'East', dateAdded: new Date('2024-02-15'), latitude: 26.2172, longitude: 50.1971 },
      { id: '8', name: 'Taif Branch', totalOffers: 11, location: 'Taif', manager: 'Al Saad', status: 'Active', region: 'West', dateAdded: new Date('2024-03-22'), latitude: 21.2653, longitude: 40.4022 }
    ]).pipe(delay(600));
  }
}
