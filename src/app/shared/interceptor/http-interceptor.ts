import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip login API and static assets
  if (req.url.includes('/cmsVendor/login') || req.url.includes('assets/')) {
    return next(req);
  }

  const token = authService.getAccessToken();

  // If token is already expired locally, trigger logout immediately and reject
  if (token && authService.isTokenExpired()) {
    authService.logout();
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized - Token expired' }));
  }

  let outgoing = req;
  if (token) {
    outgoing = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('HTTP 401 Unauthorized received. Logging out automatically.');
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};