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
      return this.http.get<VendorDetails>(this.base_url + `/vendor/${id}`).pipe(
        map(normalizeVendorResponse),
        catchError(handleApiError)
      );
    }
  
}

function handleApiError(err: any, caught: Observable<Object>): ObservableInput<any> {
  throw err;
}

