import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
    /** Saved UI preferences (vendor_accounts.language / .theme). Absent on older tokens. */
    language?: 'ENGLISH' | 'ARABIC';
    theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient);

  login(payload: LoginRequest): Observable<LoginResponse> {

    return this.http.post<LoginResponse>(
      `${environment.backendUrl}${environment.apiBaseUrl}/login`,
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

/**
 * Keep the stored account in step after the settings page saves new preferences, so a reload
 * doesn't fall back to the values captured at login.
 */
updateVendorAccountPreferences(
  language?: LoginResponse['vendorAccount']['language'],
  theme?: LoginResponse['vendorAccount']['theme'],
): void {
  const account = this.getVendorAccount();
  if (!account) return;

  localStorage.setItem(
    'vendorAccount',
    JSON.stringify({
      ...account,
      ...(language ? { language } : {}),
      ...(theme ? { theme } : {}),
    }),
  );
}

}