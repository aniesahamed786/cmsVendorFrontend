import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { httpInterceptor } from './http-interceptor';
import { AuthService } from '../../core/services/auth.service';

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('httpInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let routerSpy: { navigate: ReturnType<typeof vi.fn>; url: string };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = { navigate: vi.fn(), url: '/dashboard' };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([httpInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should pass request through without auth header for login endpoint', () => {
    httpClient.post('/cmsVendor/login', {}).subscribe();

    const req = httpMock.expectOne('/cmsVendor/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should attach Bearer token if valid token exists', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('accessToken', validToken);

    httpClient.get('/cmsVendor/requests').subscribe();

    const req = httpMock.expectOne('/cmsVendor/requests');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${validToken}`);
    req.flush({});
  });

  it('should logout and redirect to login when receiving a 401 response', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('accessToken', validToken);

    let errorResponse: any;
    httpClient.get('/cmsVendor/requests').subscribe({
      next: () => {},
      error: (err) => {
        errorResponse = err;
      },
    });

    const req = httpMock.expectOne('/cmsVendor/requests');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(errorResponse).toBeTruthy();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
