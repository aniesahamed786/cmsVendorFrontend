import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AddVendorLocationRequest {
  id?: string;
  branch_name: string;
  branch_name_ar: string;
  country: string;
  country_ar?: string;
  region: string;
  region_ar?: string;
  city: string;
  city_ar?: string;
  link: string;
  latitude: number | null;
  longitude: number | null;
  geohash: string;
  address: string;
  branchRepresentativeName: string;
  branchPhoneNumber: string;
}

@Injectable({
  providedIn: 'root',
})
export class AddNewVendorLocationService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  addLocation(vendorId: string, body: AddVendorLocationRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/vendor/${vendorId}/location`, body);
  }

  updateLocation(vendorId: string, locationId: string, body: AddVendorLocationRequest): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/vendor/${vendorId}/location/${locationId}`, body);
  }

  deleteLocation(vendorId: string, locationId: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/vendor/${vendorId}/location/${locationId}`);
  }
}

