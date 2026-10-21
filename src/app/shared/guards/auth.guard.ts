import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService, PermissionResource } from '../../core/services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    authService.logout();
    return router.createUrlTree(['/login']);
  }

  // Authenticated but suspended: the token is valid, the account isn't. Don't open the shell.
  if (authService.isSuspended()) {
    authService.logout({ account: 'inactive' });
    return router.createUrlTree(['/login'], { queryParams: { account: 'inactive' } });
  }

  return true;
};

export const authChildGuard: CanActivateChildFn = (route, state) => authGuard(route, state);

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && !authService.isSuspended()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

/**
 * Gate a route on `cms_<resource>:read` or `:manage`. One factory for every top-level page —
 * the page itself never re-checks.
 */
export const permissionGuard =
  (resource: PermissionResource): CanActivateFn =>
  () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.canView(resource)) {
      return true;
    }

    return router.createUrlTree(['/access-denied'], { queryParams: { reason: resource } });
  };

/**
 * Gate a *sub*-route that writes (create / edit) on `cms_<resource>:manage`, so a read-only
 * user who types the URL lands on access-denied instead of a form that can't submit.
 */
export const managePermissionGuard =
  (resource: PermissionResource): CanActivateFn =>
  () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.canManage(resource)) {
      return true;
    }

    return router.createUrlTree(['/access-denied'], { queryParams: { reason: resource } });
  };

/**
 * Vendor-wide actions a branch-scoped account must not reach even when the permission says
 * manage — creating a *new* branch is the one case today.
 */
export const vendorAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isStaff()) {
    return true;
  }

  return router.createUrlTree(['/access-denied'], { queryParams: { reason: 'locations' } });
};

/** A vendor still on its handed-out password replaces it before the app shell opens. */
export const passwordChangedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.onboardingStage() === 'CHANGE_PASSWORD' ? router.createUrlTree(['/first-login']) : true;
};

/**
 * /first-login is only for that step. Without the sign-in password in memory (the page was
 * reloaded) the change cannot be made, so the vendor signs in again.
 */
export const firstLoginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.onboardingStage() !== 'CHANGE_PASSWORD') {
    return router.createUrlTree(['/dashboard']);
  }
  if (!authService.heldLoginPassword()) {
    authService.logout({ password: 'required' });
    return router.createUrlTree(['/login'], { queryParams: { password: 'required' } });
  }
  return true;
};
