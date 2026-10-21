import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../shared/i18n/i18n.service';

export interface LoginRequest {
  email: string;
  password: string;
}

/** The only two roles the vendor CMS issues. `roleName` decides data scope, never page access. */
export type VendorRoleName = 'VENDOR_ADMIN' | 'VENDOR_STAFF';

/**
 * A permission is `cms_<resource>:<level>`. `resource` is what the rest of the app passes
 * around (`offers`, `vendor_staff`, `messaging_center` …) — no prefix, no level.
 */
export type PermissionResource =
  | 'profile'
  | 'offers'
  | 'locations'
  | 'vendor_staff'
  | 'redemptions'
  | 'analytics'
  | 'messaging_center'
  | 'request_center';

export interface VendorAccountSession {
  id: string;
  vendorId: string;
  roleId: string;
  roleName: VendorRoleName | string;
  permissions: string[];
  name: string;
  email: string;
  accountStatus: string;
  /**
   * The branches a VENDOR_STAFF account is pinned to. The login response does not carry it
   * yet — see branchScope().
   */
  locationIds?: string[];
  /** Saved UI preferences (vendor_accounts.language / .theme). Absent on older tokens. */
  language?: 'ENGLISH' | 'ARABIC';
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  /** Set from the login response, refreshed by refreshOnboarding(). Absent = onboarded. */
  onboarding?: VendorOnboardingState;
}

/**
 * Where a vendor created from a landing-page registration is in its onboarding
 * (GET /cmsVendor/onboarding). Every other vendor is `stage: COMPLETED`.
 */
export type VendorOnboardingStage = 'CHANGE_PASSWORD' | 'COMPLETE_PROFILE' | 'PROFILE_UNDER_REVIEW' | 'COMPLETED';

export interface VendorOnboardingState {
  isNewVendor: boolean;
  stage: VendorOnboardingStage;
  passwordChangeRequired: boolean;
  profileApprovalRequired: boolean;
  /** The vendor's latest PROFILE request (its requestId), when it has raised one. */
  profileRequestId: string | null;
  profileRequestStatus: string | null;
  /** The admin's reason when the latest PROFILE request was returned or rejected. */
  profileReviewReason: string | null;
}

export interface LoginResponse {
  accessToken: string;
  vendorAccount: VendorAccountSession;
  onboarding?: VendorOnboardingState;
}

export interface JwtPayload {
  sub?: string;
  vendorId?: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  locationIds?: string[];
  type?: string;
  name?: string;
  email?: string;
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

/** `VENDOR_ADMIN` → `Vendor Admin`. Used for the header/sidenav role line. */
export function humanizeRoleName(roleName: string | undefined | null): string {
  if (!roleName) return '';
  return roleName
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The password typed at sign-in, kept only while the account must replace it: the change
   * needs it as `currentPassword` and the first-login form does not ask for it again. Memory
   * only, never stored — a reload drops it and the vendor signs in again.
   */
  private loginPassword: string | null = null;

  /** Reactive session — templates and computed menus read this, not localStorage. */
  private readonly sessionState = signal<VendorAccountSession | null>(null);
  readonly session = this.sessionState.asReadonly();

  readonly permissions = computed(() => this.sessionState()?.permissions ?? []);
  readonly roleName = computed(() => this.sessionState()?.roleName ?? '');
  readonly displayName = computed(() => this.sessionState()?.name ?? '');
  /** Translated role name, humanized (`VENDOR_ADMIN` → "Vendor Admin") when there's no key. */
  readonly displayRole = computed(() => {
    this.i18n.lang();
    this.i18n.loadSeq();
    const role = this.sessionState()?.roleName;
    if (!role) return '';
    const text = this.i18n.t(`roles.${role}`);
    return text === `roles.${role}` ? humanizeRoleName(role) : text;
  });
  /**
   * A suspended account is authenticated but must not reach the app shell. Only a *known*
   * non-ACTIVE status blocks: if the stored session is gone we don't know the status, and the
   * backend is the real gate — locking out a valid token on a guess is worse.
   */
  readonly isSuspended = computed(() => {
    const status = this.sessionState()?.accountStatus;
    return !!status && status !== 'ACTIVE';
  });
  readonly onboarding = computed(() => this.sessionState()?.onboarding ?? null);
  readonly onboardingStage = computed<VendorOnboardingStage>(() => this.onboarding()?.stage ?? 'COMPLETED');
  /** Not onboarded yet — the main layout covers most pages until it is. */
  readonly isOnboarding = computed(() => this.onboardingStage() !== 'COMPLETED');
  /** The first two steps run as a focused flow: no sidenav, one task on screen. */
  readonly isOnboardingSetup = computed(
    () => this.onboardingStage() === 'CHANGE_PASSWORD' || this.onboardingStage() === 'COMPLETE_PROFILE',
  );

  constructor() {
    this.sessionState.set(this.restoreSession());
    this.initExpirationTimer();
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${environment.backendUrl}${environment.apiBaseUrl}/login`,
      payload
    );
  }

  setSession(accessToken: string, vendorAccount: VendorAccountSession): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('vendorAccount', JSON.stringify(vendorAccount));
    }
    this.sessionState.set(vendorAccount);
    this.initExpirationTimer();
  }

  /**
   * Swap in the token a password change returns. The backend ends every session on that change,
   * so the token sent with the request is dead from then on.
   */
  replaceAccessToken(accessToken: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
    }
    this.initExpirationTimer();
  }

  /**
   * Rehydrate on app start. The stored account is the richer source; if it is gone but the
   * token still decodes, rebuild what the JWT carries so a cleared key doesn't look like a
   * logout.
   */
  private restoreSession(): VendorAccountSession | null {
    if (typeof localStorage === 'undefined') return null;

    const stored = localStorage.getItem('vendorAccount');
    if (stored) {
      try {
        return JSON.parse(stored) as VendorAccountSession;
      } catch {
        // fall through to the token
      }
    }

    const payload = this.getAccessTokenPayload();
    if (!payload || this.isTokenExpired()) return null;

    return {
      id: payload.sub ?? '',
      vendorId: payload.vendorId ?? '',
      roleId: payload.roleId ?? '',
      roleName: payload.roleName ?? '',
      permissions: payload.permissions ?? [],
      name: payload.name ?? '',
      email: payload.email ?? '',
      accountStatus: 'ACTIVE',
      locationIds: payload.locationIds,
    };
  }

  getVendorAccount(): VendorAccountSession | null {
    return this.sessionState();
  }

  getVendorId(): string | null {
    return this.sessionState()?.vendorId ?? null;
  }

  getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  getAccessTokenPayload(): JwtPayload | null {
    const token = this.getAccessToken();
    return token ? decodeJwtPayload(token) : null;
  }

  // ---------------------------------------------------------------------------
  // Permissions. The only place in the app that reads `permissions` or `roleName`.
  // ---------------------------------------------------------------------------

  /** Can open the page at all. `manage` implies `read` — staff hold manage-only grants. */
  canView(resource: PermissionResource | string): boolean {
    return this.canRead(resource) || this.hasPermission(resource, 'manage');
  }

  /** Has the explicit read grant (used when read and manage unlock different page sections). */
  canRead(resource: PermissionResource | string): boolean {
    return this.hasPermission(resource, 'read');
  }

  /** Can create / edit / delete. */
  canManage(resource: PermissionResource | string): boolean {
    return this.hasPermission(resource, 'manage');
  }

  private hasPermission(resource: string, level: 'read' | 'manage'): boolean {
    return this.permissions().includes(`cms_${resource}:${level}`);
  }

  isStaff(): boolean {
    return this.roleName() === 'VENDOR_STAFF';
  }

  isAdmin(): boolean {
    return this.roleName() === 'VENDOR_ADMIN';
  }

  /** Request Center follows the same read/manage permission model as other CMS resources. */
  canViewRequestCenter(): boolean {
    return this.canView('request_center');
  }

  /**
   * The branches a staff member is limited to, or `null` for an admin (= all branches).
   *
   * ponytail: the login response carries no branch id, so this is empty for staff until the
   * backend adds `locationIds` to the login payload or the JWT — pending a backend decision.
   * Callers must treat `[]` as "scoped, but the ids aren't known here" and lean on the
   * backend's own token scoping; only `null` means "unscoped, show every branch".
   * Returns an array because the account model stores `locationIds` (plural) everywhere.
   */
  branchScope(): string[] | null {
    if (!this.isStaff()) return null;
    return this.sessionState()?.locationIds ?? [];
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

  logout(queryParams?: Record<string, string>): void {
    this.clearTimer();
    this.loginPassword = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('vendorAccount');
    }
    this.sessionState.set(null);
    const currentUrl = this.router.url;
    if (!currentUrl.includes('/login')) {
      void (queryParams
        ? this.router.navigate(['/login'], { queryParams })
        : this.router.navigate(['/login']));
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
      this.logout({ session: 'expired' });
      return;
    }

    // Cap at max 32-bit signed int timeout (~24.8 days)
    const timeoutMs = Math.min(remainingMs, 2147483647);
    this.expirationTimer = setTimeout(() => {
      console.warn('Vendor session token expired. Logging out automatically.');
      this.logout({ session: 'expired' });
    }, timeoutMs);
  }

  /**
   * Keep the stored account in step after the settings page saves new preferences, so a reload
   * doesn't fall back to the values captured at login.
   */
  updateVendorAccountPreferences(
    language?: VendorAccountSession['language'],
    theme?: VendorAccountSession['theme'],
  ): void {
    this.patchSession({
      ...(language ? { language } : {}),
      ...(theme ? { theme } : {}),
    });
  }

  /**
   * Re-read the onboarding stage after a step that may move it (password change, PROFILE submit,
   * admin approval) without a re-login. COMPLETED never goes back, so it stops calling then.
   * Fires on its own; subscribe only to act once the new stage is in.
   */
  refreshOnboarding(): Observable<unknown> {
    if (!this.isOnboarding()) return of(null);
    const request = this.http
      .get<VendorOnboardingState>(`${environment.backendUrl}${environment.apiBaseUrl}/onboarding`)
      .pipe(
        tap((onboarding) => this.patchSession({ onboarding })),
        catchError(() => of(null)),
        shareReplay(1),
      );
    request.subscribe();
    return request;
  }

  holdLoginPassword(password: string | null): void {
    this.loginPassword = password;
  }

  heldLoginPassword(): string | null {
    return this.loginPassword;
  }

  private patchSession(changes: Partial<VendorAccountSession>): void {
    const account = this.getVendorAccount();
    if (!account) return;

    const next: VendorAccountSession = { ...account, ...changes };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vendorAccount', JSON.stringify(next));
    }
    this.sessionState.set(next);
  }
}
