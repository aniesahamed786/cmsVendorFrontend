import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {
  authGuard,
  guestGuard,
  managePermissionGuard,
  permissionGuard,
  vendorAdminGuard,
} from './auth.guard';
import { AuthService, VendorAccountSession } from '../../core/services/auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('AuthGuards', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('authGuard', () => {
    it('should allow navigation when authenticated with valid token', () => {
      const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
      localStorage.setItem('accessToken', validToken);

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );

      expect(result).toBe(true);
    });

    it('should redirect to login when unauthenticated or expired token', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('should allow navigation to login when unauthenticated', () => {
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );

      expect(result).toBe(true);
    });

    it('should redirect to /dashboard when already authenticated', () => {
      const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
      localStorage.setItem('accessToken', validToken);

      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/dashboard');
    });
  });

  describe('permissionGuard', () => {
    function signIn(permissions: string[], roleName = 'VENDOR_ADMIN'): void {
      const token = createMockJwt({ sub: 'a1', exp: Math.floor(Date.now() / 1000) + 3600 });
      const account: VendorAccountSession = {
        id: 'a1',
        vendorId: 'v1',
        roleId: 'r1',
        roleName,
        permissions,
        name: 'Test User',
        email: 'test@vendor.com',
        accountStatus: 'ACTIVE',
      };
      authService.setSession(token, account);
    }

    const run = (guard: ReturnType<typeof permissionGuard>) =>
      TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

    it('allows the route when the resource is readable', () => {
      signIn(['cms_offers:read']);
      expect(run(permissionGuard('offers'))).toBe(true);
    });

    it('allows the route on a manage-only grant', () => {
      signIn(['cms_redemptions:manage'], 'VENDOR_STAFF');
      expect(run(permissionGuard('redemptions'))).toBe(true);
    });

    it('redirects to /access-denied with the resource as the reason', () => {
      signIn(['cms_offers:read'], 'VENDOR_STAFF');

      const result = run(permissionGuard('vendor_staff'));

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/access-denied?reason=vendor_staff');
    });

    it('managePermissionGuard refuses a read-only grant', () => {
      signIn(['cms_offers:read']);

      expect(run(managePermissionGuard('offers')) instanceof UrlTree).toBe(true);
      expect(run(managePermissionGuard('offers')).toString()).toBe('/access-denied?reason=offers');
    });

    it('vendorAdminGuard keeps staff out of vendor-wide routes', () => {
      signIn(['cms_locations:manage'], 'VENDOR_STAFF');
      const staffResult = run(vendorAdminGuard as ReturnType<typeof permissionGuard>);
      expect(staffResult instanceof UrlTree).toBe(true);

      signIn(['cms_locations:manage'], 'VENDOR_ADMIN');
      expect(run(vendorAdminGuard as ReturnType<typeof permissionGuard>)).toBe(true);
    });

    it('authGuard sends a suspended account back to login', () => {
      signIn(['cms_offers:read']);
      authService.setSession(
        createMockJwt({ sub: 'a1', exp: Math.floor(Date.now() / 1000) + 3600 }),
        { ...(authService.getVendorAccount() as VendorAccountSession), accountStatus: 'SUSPENDED' },
      );

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(result instanceof UrlTree).toBe(true);
      expect((result as UrlTree).toString()).toBe('/login?account=inactive');
    });
  });
});
