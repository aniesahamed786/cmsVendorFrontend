import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, ObservableInput } from 'rxjs';
import { normalizeVendorResponse } from '../models/vendordetails';
import { VendorDetails } from '../models/vendordetails';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GetVendorById {
  private readonly base_url = environment.apiBaseUrl
  
  
  constructor(private http:HttpClient){

  }

   getVendorById(id:string): Observable<VendorDetails>{
      // Backend route: GET /cmsVendor/vendorProfile?vendorId=... . The CMS profile
      // DTO (vendorName / vendorNameAr / vendorLogo) is mapped onto the VendorDetails
      // shape the offer-form preview reads (name / name_ar / logo).
      return this.http
        .get<any>(this.base_url + `/vendorProfile`, { params: { vendorId: id } })
        .pipe(
          map((p: any) =>
            normalizeVendorResponse({
              ...p,
              _id: { $oid: p?.vendorId ?? id },
              name: p?.vendorName ?? '',
              name_ar: p?.vendorNameAr ?? '',
              description: p?.description ?? '',
              description_ar: p?.descriptionAr ?? '',
              logo: p?.vendorLogo ?? '',
            } as VendorDetails),
          ),
          catchError(handleApiError),
        );
    }
  
}

function handleApiError(err: any, caught: Observable<Object>): ObservableInput<any> {
  throw err;
}

