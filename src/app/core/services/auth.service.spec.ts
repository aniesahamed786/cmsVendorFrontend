import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, decodeJwtPayload } from './auth.service';

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
      name: 'Vendor Owner',
      email: 'vendor@example.com',
      accountStatus: 'ACTIVE',
    };

    service.setSession(validToken, account);

    expect(service.getAccessToken()).toBe(validToken);
    expect(service.getVendorAccount()?.name).toBe('Vendor Owner');
    expect(service.getVendorId()).toBe('v-1');
  });

  it('should remove session and navigate to /login on logout', () => {
    localStorage.setItem('accessToken', 'mock-token');
    localStorage.setItem('vendorAccount', JSON.stringify({ name: 'Vendor' }));

    service.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('vendorAccount')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should automatically logout when token expires via timer', fakeAsync(() => {
    const futureExp = Math.floor(Date.now() / 1000) + 2; // 2 seconds
    const validToken = createMockJwt({ sub: '123', exp: futureExp });
    const account = {
      id: 'acc-1',
      vendorId: 'v-1',
      roleId: 'role-1',
      name: 'Vendor Owner',
      email: 'vendor@example.com',
      accountStatus: 'ACTIVE',
    };

    service.setSession(validToken, account);
    expect(service.isAuthenticated()).toBe(true);

    tick(2100);

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  }));
});
