import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class VendorProfileService {
  private readonly http = inject(HttpClient);

  getVendorProfile(vendorId: string): Observable<any> {
    return this.http.get(
      `http://localhost:8000/api/v1/cmsVendor/vendorProfile?vendorId=${vendorId}`
    );
  }
}