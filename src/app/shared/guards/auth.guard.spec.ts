import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {
  authGuard,
  firstLoginGuard,
  guestGuard,
  passwordChangedGuard,
  managePermissionGuard,
  permissionGuard,
  vendorAdminGuard,
} from './auth.guard';
import { AuthService, VendorAccountSession, VendorOnboardingStage } from '../../core/services/auth.service';
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

    it('allows Request Center for staff with its read or manage permission', () => {
      signIn(['cms_request_center:read'], 'VENDOR_STAFF');
      expect(run(permissionGuard('request_center'))).toBe(true);

      signIn(['cms_request_center:manage'], 'VENDOR_STAFF');
      expect(run(permissionGuard('request_center'))).toBe(true);
    });

    it('denies Request Center when its permission is missing, regardless of role', () => {
      signIn(['cms_offers:read'], 'VENDOR_STAFF');
      const staffResult = run(permissionGuard('request_center'));
      expect(staffResult instanceof UrlTree).toBe(true);
      expect(staffResult.toString()).toBe('/access-denied?reason=request_center');

      signIn([], 'VENDOR_ADMIN');
      expect(run(permissionGuard('request_center')).toString()).toBe(
        '/access-denied?reason=request_center',
      );
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

  describe('first-login guards', () => {
    function signIn(stage: VendorOnboardingStage): void {
      const token = createMockJwt({ sub: 'a1', exp: Math.floor(Date.now() / 1000) + 3600 });
      authService.setSession(token, {
        id: 'a1', vendorId: 'v1', roleId: 'r1', roleName: 'VENDOR_ADMIN', permissions: [],
        name: 'Test User', email: 'test@vendor.com', accountStatus: 'ACTIVE',
        onboarding: {
          isNewVendor: stage !== 'COMPLETED', stage, passwordChangeRequired: stage === 'CHANGE_PASSWORD',
          profileApprovalRequired: stage !== 'COMPLETED', profileRequestId: null,
          profileRequestStatus: null, profileReviewReason: null,
        },
      });
    }

    const run = (guard: typeof firstLoginGuard) =>
      TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

    it('keeps a vendor on a handed-out password out of the app shell', () => {
      signIn('CHANGE_PASSWORD');
      expect((run(passwordChangedGuard) as UrlTree).toString()).toBe('/first-login');
    });

    it('lets everyone else into the app shell', () => {
      signIn('COMPLETE_PROFILE');
      expect(run(passwordChangedGuard)).toBe(true);
    });

    it('opens /first-login while the sign-in password is held', () => {
      signIn('CHANGE_PASSWORD');
      authService.holdLoginPassword('Vendor@123');
      expect(run(firstLoginGuard)).toBe(true);
    });

    it('sends the vendor back to sign in when the password is gone (reload)', () => {
      signIn('CHANGE_PASSWORD');
      expect((run(firstLoginGuard) as UrlTree).toString()).toBe('/login?password=required');
    });

    it('closes /first-login once the password is changed', () => {
      signIn('COMPLETE_PROFILE');
      authService.holdLoginPassword('Vendor@123');
      expect((run(firstLoginGuard) as UrlTree).toString()).toBe('/dashboard');
    });
  });
});
