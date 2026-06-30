import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Category {
  _id: { $oid: string } | string;
  /** Normalized id used by dropdowns (computed client-side). */
  id?: string;
  name: string;
  name_ar: string;
  icon: string;
  image?: string;
  order: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class GetCategoriesService {
  private readonly base_url = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getAllCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.base_url + '/category');
  }
}
