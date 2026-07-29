import { HttpInterceptorFn } from '@angular/common/http';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {

  // Skip login API
  if (req.url.includes('/cmsVendor/login')) {
    return next(req);
  }

  const token = localStorage.getItem('accessToken');

  // If no token is available, send the request as-is
  if (!token) {
    return next(req);
  }

  // Clone the request and attach the Authorization header
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};