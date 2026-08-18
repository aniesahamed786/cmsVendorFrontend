import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
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

export interface JwtPayload {
  sub?: string;
  vendorId?: string;
  type?: string;
  name?: string;
  roleName?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initExpirationTimer();
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.backendUrl}${environment.apiBaseUrl}/login`,
      payload
    );
  }

  setSession(accessToken: string, vendorAccount: LoginResponse['vendorAccount']): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('vendorAccount', JSON.stringify(vendorAccount));
    }
    this.initExpirationTimer();
  }

  getVendorAccount(): LoginResponse['vendorAccount'] | null {
    if (typeof localStorage === 'undefined') return null;
    const vendor = localStorage.getItem('vendorAccount');
    return vendor ? JSON.parse(vendor) : null;
  }

  getVendorId(): string | null {
    return this.getVendorAccount()?.vendorId ?? null;
  }

  getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  getAccessTokenPayload(): JwtPayload | null {
    const token = this.getAccessToken();
    return token ? decodeJwtPayload(token) : null;
  }

  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const payload = decodeJwtPayload(token);
    if (!payload || payload.exp === undefined) return true;
    return Date.now() >= payload.exp * 1000;
  }

  isAuthenticated(): boolean {
    return !this.isTokenExpired();
  }

  logout(): void {
    this.clearTimer();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('vendorAccount');
    }
    const currentUrl = this.router.url;
    if (!currentUrl.includes('/login')) {
      void this.router.navigate(['/login']);
    }
  }

  private clearTimer(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private initExpirationTimer(): void {
    this.clearTimer();
    const token = this.getAccessToken();
    if (!token) return;

    const payload = decodeJwtPayload(token);
    if (!payload || payload.exp === undefined) {
      this.logout();
      return;
    }

    const remainingMs = payload.exp * 1000 - Date.now();
    if (remainingMs <= 0) {
      this.logout();
      return;
    }

    // Cap at max 32-bit signed int timeout (~24.8 days)
    const timeoutMs = Math.min(remainingMs, 2147483647);
    this.expirationTimer = setTimeout(() => {
      console.warn('Vendor session token expired. Logging out automatically.');
      this.logout();
    }, timeoutMs);
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

    if (typeof localStorage !== 'undefined') {
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
}