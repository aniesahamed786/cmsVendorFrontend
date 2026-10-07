import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../i18n/i18n.service';

const NETWORK_TOAST_COOLDOWN_MS = 5000;
let lastNetworkToastAt = 0;

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messages = inject(MessageService);
  const i18n = inject(I18nService);
  const body = req.body as Record<string, unknown> | null;
  const isPasswordChangeRequest =
    req.method === 'PATCH' &&
    req.url.includes('/profile-settings') &&
    !!body &&
    typeof body === 'object' &&
    'currentPassword' in body &&
    'newPassword' in body;

  const notifyNetworkFailure = (error: HttpErrorResponse): void => {
    if (error.status !== 0 || Date.now() - lastNetworkToastAt < NETWORK_TOAST_COOLDOWN_MS) return;
    lastNetworkToastAt = Date.now();
    messages.add({
      severity: 'error',
      summary: i18n.t('common.serverUnavailableSummary'),
      detail: i18n.t('common.serverUnavailableDetail'),
      life: 6000,
      closable: true,
    });
  };

  // Static translation/assets failures are handled by their own fallbacks.
  if (req.url.includes('assets/')) {
    return next(req);
  }

  // Login must not receive an old token, but connection failures still need the global toast.
  if (req.url.includes('/cmsVendor/login')) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        notifyNetworkFailure(error);
        return throwError(() => error);
      }),
    );
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
      notifyNetworkFailure(error);

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
