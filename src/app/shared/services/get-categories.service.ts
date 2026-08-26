import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Category {
  _id: { $oid: string } | string;
  /** Normalized id used by dropdowns (computed client-side). */
  id?: string;
  name: string;
  name_ar: string;
  type?: string;
  icon: string;
  image?: string;
  order: number;
  isActive: boolean;
  isPlanMyTrip?: boolean;
  offers?: number;
  activeOffers?: number;
}

@Injectable({
  providedIn: 'root',
})
export class GetCategoriesService {
  private readonly base_url = environment.backendUrl + environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // ponytail: test-only dummy hotel category; delete this const + the map below to revert
  private static readonly DUMMY_HOTEL: Category = {
    _id: '000000000000000000000001',
    name: 'Hotels',
    name_ar: 'الفنادق',
    type: 'Hotels',
    icon: 'pi pi-building',
    order: 999,
    isActive: true,
  };

  getAllCategories(): Observable<Category[]> {
    return this.http
      .get<Category[]>(this.base_url + '/category')
      .pipe(map((cats) => [...(cats || []), GetCategoriesService.DUMMY_HOTEL]));
  }
}
