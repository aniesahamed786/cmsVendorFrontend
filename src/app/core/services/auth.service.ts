import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;

  vendorAccount: {
    id: string;
    vendorId: string;
    roleId: string;
    name: string;
    email: string;
    accountStatus: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient);

  login(payload: LoginRequest): Observable<LoginResponse> {

    return this.http.post<LoginResponse>(
      '/api/v1/cmsVendor/login',
      payload
    );

  }
  getVendorAccount(): LoginResponse['vendorAccount'] | null {
  const vendor = localStorage.getItem('vendorAccount');

  return vendor ? JSON.parse(vendor) : null;
}

getVendorId(): string | null {
  return this.getVendorAccount()?.vendorId ?? null;
}

getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

}