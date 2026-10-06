import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const body = req.body as Record<string, unknown> | null;
  const isPasswordChangeRequest =
    req.method === 'PATCH' &&
    req.url.includes('/profile-settings') &&
    !!body &&
    typeof body === 'object' &&
    'currentPassword' in body &&
    'newPassword' in body;

  // Skip login API and static assets
  if (req.url.includes('/cmsVendor/login') || req.url.includes('assets/')) {
    return next(req);
  }

  const token = authService.getAccessToken();

  // If token is already expired locally, trigger logout immediately and reject
  if (token && authService.isTokenExpired()) {
    authService.logout({ session: 'expired' });
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
      // This endpoint also uses 401 when currentPassword is wrong; that is field
      // validation, not an expired authenticated session.
      if (error.status === 401 && !isPasswordChangeRequest) {
        console.warn('HTTP 401 Unauthorized received. Logging out automatically.');
        authService.logout({ session: 'expired' });
      }

      // A 403 is refused *data*, not a refused page: pages you are allowed to open still call
      // endpoints the backend may narrow per account, and ejecting the whole app because one
      // widget's request failed hides a page the route guard correctly allowed. Page-level
      // access is permissionGuard's job — let the caller surface this one.
      if (error.status === 403) {
        console.warn('HTTP 403 Forbidden:', req.method, req.url);
      }
      return throwError(() => error);
    })
  );
};
