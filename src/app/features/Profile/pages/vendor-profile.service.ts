import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VendorProfileApi } from '../models/vendor-profile-request.mapper';

@Injectable({
  providedIn: 'root',
})
export class VendorProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  /** GET /cmsVendor/vendorProfile?vendorId= — backs the profile view and the edit form. */
  getVendorProfile(vendorId: string): Observable<VendorProfileApi> {
    return this.http.get<VendorProfileApi>(`${this.baseUrl}/vendorProfile`, {
      params: new HttpParams().set('vendorId', vendorId),
    });
  }
}
