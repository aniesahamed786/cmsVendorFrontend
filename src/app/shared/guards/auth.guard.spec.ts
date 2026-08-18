import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../../core/services/auth.service';
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
});
