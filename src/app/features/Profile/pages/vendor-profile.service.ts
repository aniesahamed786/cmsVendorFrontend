import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VendorProfileApi } from '../models/vendor-profile-request.mapper';

@Injectable({
  providedIn: 'root',
})
export class VendorProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  /**
   * GET /cmsVendor/vendorProfile — backs the profile view and the edit form.
   *
   * No vendorId: the backend resolves it from the vendor-account JWT, the same way every
   * other cmsVendor endpoint does. Passing one would only invite a mismatch between the token
   * and the query.
   */
  getVendorProfile(): Observable<VendorProfileApi> {
    return this.http.get<VendorProfileApi>(`${this.baseUrl}/vendorProfile`);
  }
}
