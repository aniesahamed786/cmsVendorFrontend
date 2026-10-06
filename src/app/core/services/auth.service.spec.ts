import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, VendorAccountSession, decodeJwtPayload } from './auth.service';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: { navigate: ReturnType<typeof vi.fn>; url: string };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = { navigate: vi.fn(), url: '/dashboard' };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should decode JWT payload correctly', () => {
    const token = createMockJwt({ sub: 'user-123', vendorId: 'v-1', exp: 1999999999 });
    const payload = decodeJwtPayload(token);
    expect(payload).toBeTruthy();
    expect(payload?.sub).toBe('user-123');
    expect(payload?.vendorId).toBe('v-1');
  });

  it('should return true for isTokenExpired when no token exists', () => {
    expect(service.isTokenExpired()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should return true for isTokenExpired when token exp is in the past', () => {
    const expiredToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) - 60 });
    localStorage.setItem('accessToken', expiredToken);
    expect(service.isTokenExpired()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should return false for isTokenExpired when token exp is in the future', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('accessToken', validToken);
    expect(service.isTokenExpired()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should store session in localStorage on setSession', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    const account = {
      id: 'acc-1',
      vendorId: 'v-1',
      roleId: 'role-1',
      roleName: 'VENDOR_ADMIN',
      permissions: ['cms_profile:manage'],
      name: 'Vendor Owner',
      email: 'vendor@example.com',
      accountStatus: 'ACTIVE',
    };

    service.setSession(validToken, account);

    expect(service.getAccessToken()).toBe(validToken);
    expect(service.getVendorAccount()?.name).toBe('Vendor Owner');
    expect(service.getVendorId()).toBe('v-1');
  });

  it('should update cached preferences after they are saved', () => {
    service.setSession(createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 }), {
      id: 'acc-1',
      vendorId: 'v-1',
      roleId: 'role-1',
      roleName: 'VENDOR_ADMIN',
      permissions: ['cms_profile:manage'],
      name: 'Vendor Owner',
      email: 'vendor@example.com',
      accountStatus: 'ACTIVE',
      language: 'ENGLISH',
      theme: 'LIGHT',
    });

    service.updateVendorAccountPreferences('ARABIC', 'DARK');

    expect(service.getVendorAccount()).toEqual(
      expect.objectContaining({ language: 'ARABIC', theme: 'DARK' }),
    );
  });

  it('should remove session and navigate to /login on logout', () => {
    localStorage.setItem('accessToken', 'mock-token');
    localStorage.setItem('vendorAccount', JSON.stringify({ name: 'Vendor' }));

    service.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('vendorAccount')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should automatically logout when token expires via timer', () => {
    vi.useFakeTimers();
    try {
      const futureExp = Math.floor(Date.now() / 1000) + 2; // 2 seconds
      const validToken = createMockJwt({ sub: '123', exp: futureExp });
      const account = {
        id: 'acc-1',
        vendorId: 'v-1',
        roleId: 'role-1',
        roleName: 'VENDOR_ADMIN',
        permissions: ['cms_profile:manage'],
        name: 'Vendor Owner',
        email: 'vendor@example.com',
        accountStatus: 'ACTIVE',
      };

      service.setSession(validToken, account);
      expect(service.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(2100);

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { session: 'expired' },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('permissions', () => {
    const validToken = () => createMockJwt({ sub: 'a1', exp: Math.floor(Date.now() / 1000) + 3600 });

    function signIn(
      permissions: string[],
      roleName = 'VENDOR_ADMIN',
      locationIds?: string[],
    ): void {
      const account: VendorAccountSession = {
        id: 'a1',
        vendorId: 'v1',
        roleId: 'r1',
        roleName,
        permissions,
        name: 'Test User',
        email: 'test@vendor.com',
        accountStatus: 'ACTIVE',
        ...(locationIds ? { locationIds } : {}),
      };
      service.setSession(validToken(), account);
    }

    it('canView is true for a read grant', () => {
      signIn(['cms_offers:read']);
      expect(service.canView('offers')).toBe(true);
      expect(service.canManage('offers')).toBe(false);
    });

    it('manage implies view', () => {
      // VENDOR_STAFF ships cms_redemptions:manage with no :read — Redemptions must still open.
      signIn(['cms_redemptions:manage'], 'VENDOR_STAFF');
      expect(service.canView('redemptions')).toBe(true);
      expect(service.canRead('redemptions')).toBe(false);
      expect(service.canManage('redemptions')).toBe(true);
    });

    it('recognizes an explicit read grant separately from manage', () => {
      signIn(['cms_redemptions:read'], 'VENDOR_STAFF');
      expect(service.canRead('redemptions')).toBe(true);
      expect(service.canManage('redemptions')).toBe(false);
    });

    it('uses Request Center permissions for staff access', () => {
      signIn(['cms_request_center:read'], 'VENDOR_STAFF');
      expect(service.canViewRequestCenter()).toBe(true);

      signIn(['cms_request_center:manage'], 'VENDOR_STAFF');
      expect(service.canViewRequestCenter()).toBe(true);

      signIn(['cms_offers:read'], 'VENDOR_STAFF');
      expect(service.canViewRequestCenter()).toBe(false);
    });

    it('denies a resource with neither level', () => {
      signIn(['cms_offers:read']);
      expect(service.canView('vendor_staff')).toBe(false);
      expect(service.canManage('vendor_staff')).toBe(false);
    });

    it('denies everything with no session', () => {
      expect(service.canView('offers')).toBe(false);
      expect(service.canManage('offers')).toBe(false);
    });

    it('reports the role and humanizes it for display', () => {
      signIn([], 'VENDOR_STAFF');
      expect(service.isStaff()).toBe(true);
      expect(service.isAdmin()).toBe(false);
      expect(service.displayRole()).toBe('Vendor Staff');
    });

    it('branchScope is null for an admin', () => {
      signIn(['cms_locations:manage'], 'VENDOR_ADMIN', ['loc-1']);
      expect(service.branchScope()).toBeNull();
    });

    it('branchScope is the staff member\'s branches', () => {
      signIn(['cms_locations:manage'], 'VENDOR_STAFF', ['loc-1']);
      expect(service.branchScope()).toEqual(['loc-1']);
    });

    it('branchScope is an empty list when a staff branch is not known yet', () => {
      signIn(['cms_locations:manage'], 'VENDOR_STAFF');
      expect(service.branchScope()).toEqual([]);
    });

    it('flags a suspended account without locking out an unknown one', () => {
      signIn(['cms_offers:read']);
      expect(service.isSuspended()).toBe(false);

      service.setSession(validToken(), {
        ...(service.getVendorAccount() as VendorAccountSession),
        accountStatus: 'SUSPENDED',
      });
      expect(service.isSuspended()).toBe(true);

      service.logout();
      expect(service.isSuspended()).toBe(false);
    });

    it('rebuilds the session from the JWT when the stored account is gone', () => {
      const token = createMockJwt({
        sub: 'a1',
        vendorId: 'v1',
        roleName: 'VENDOR_STAFF',
        permissions: ['cms_analytics:read'],
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      localStorage.setItem('accessToken', token);
      localStorage.removeItem('vendorAccount');

      // The injected singleton read localStorage at construction, so build a fresh one.
      const fresh = TestBed.runInInjectionContext(() => new AuthService());
      expect(fresh.canView('analytics')).toBe(true);
      expect(fresh.isStaff()).toBe(true);
    });
  });
});
