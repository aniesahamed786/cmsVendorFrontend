import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { httpInterceptor } from './http-interceptor';
import { AuthService } from '../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { I18nService } from '../i18n/i18n.service';

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
  let messageService: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = { navigate: vi.fn(), url: '/dashboard' };
    messageService = { add: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([httpInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: MessageService, useValue: messageService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
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

  it('shows a global toast when the server cannot be reached', () => {
    httpClient.get('/cmsVendor/requests').subscribe({ error: () => {} });

    httpMock.expectOne('/cmsVendor/requests').error(new ProgressEvent('error'));

    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'common.serverUnavailableSummary',
        detail: 'common.serverUnavailableDetail',
      }),
    );
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
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { session: 'expired' },
    });
  });

  it('should pass an incorrect-current-password 401 to the form without logging out', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('accessToken', validToken);

    let errorResponse: any;
    httpClient
      .patch('/cmsVendor/profile-settings', {
        currentPassword: 'wrong-password',
        newPassword: 'New-password1!',
      })
      .subscribe({
        next: () => {},
        error: (err) => {
          errorResponse = err;
        },
      });

    httpMock
      .expectOne('/cmsVendor/profile-settings')
      .flush(
        { message: 'Current password is incorrect' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(errorResponse?.status).toBe(401);
    expect(localStorage.getItem('accessToken')).toBe(validToken);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should let a 403 through to the caller without logging out or navigating', () => {
    const validToken = createMockJwt({ sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('accessToken', validToken);

    let errorResponse: any;
    httpClient.get('/cmsVendor/accounts').subscribe({
      next: () => {},
      error: (err) => {
        errorResponse = err;
      },
    });

    httpMock
      .expectOne('/cmsVendor/accounts')
      .flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    // A refused endpoint must not eject the user from a page the route guard allowed.
    expect(errorResponse?.status).toBe(403);
    expect(localStorage.getItem('accessToken')).toBe(validToken);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
