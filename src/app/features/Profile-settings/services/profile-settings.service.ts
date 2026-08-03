import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type VendorAccountLanguage = 'ENGLISH' | 'ARABIC';
export type VendorAccountTheme = 'LIGHT' | 'DARK' | 'SYSTEM';

/**
 * PATCH /cmsVendor/profile-settings body. Every field is optional — send only what changed.
 * `currentPassword` is required by the backend whenever `newPassword` is present.
 */
export interface UpdateProfileSettingsPayload {
  language?: VendorAccountLanguage;
  theme?: VendorAccountTheme;
  currentPassword?: string;
  newPassword?: string;
}

export interface ProfileSettingsResponse {
  id: string;
  vendorId: string;
  name: string;
  email: string;
  language: VendorAccountLanguage;
  theme: VendorAccountTheme;
}

@Injectable({ providedIn: 'root' })
export class ProfileSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  /**
   * Update the signed-in account's own settings. The account is resolved from the JWT, so no
   * id is sent — the backend can only ever update the caller's own vendor_accounts row.
   */
  updateSettings(payload: UpdateProfileSettingsPayload): Observable<ProfileSettingsResponse> {
    return this.http.patch<ProfileSettingsResponse>(`${this.baseUrl}/profile-settings`, payload);
  }
}
