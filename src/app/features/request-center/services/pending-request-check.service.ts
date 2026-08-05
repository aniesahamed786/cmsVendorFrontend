import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, of } from 'rxjs';
import { RequestCenterApiService } from './request-center-api.service';

/**
 * Guards an "Edit" action against a change request that is already in flight.
 *
 * A vendor entity is read-only — every edit becomes a request, and the backend allows only
 * one open UPDATE request per entity (assertNoConflictingUpdateRequest, which answers with a
 * 409). Letting someone fill in a whole form only to have the save rejected is the worst
 * place to find that out, so the check happens on the way in instead.
 *
 * One instance per component: `provide` it on the page that uses it, so two pages never share
 * the `blockedBy` state.
 */
@Injectable()
export class PendingRequestCheck {
  private readonly api = inject(RequestCenterApiService);
  private readonly router = inject(Router);

  /** The requestId already holding this entity, once a check has found one. */
  readonly blockedBy = signal<string | null>(null);
  /** True while the check is in flight, so the Edit button can show it is working. */
  readonly checking = signal(false);

  /**
   * Runs the check, then either navigates to `editRoute` or raises `blockedBy` for the page
   * to surface.
   *
   * A failed check navigates anyway: the endpoint is an early warning, not an authority, and
   * the backend still rejects a genuine conflict with a 409 that the form already reports.
   * Blocking the vendor because a advisory call failed would be worse than the 409.
   */
  guardEdit(entityId: string | null | undefined, editRoute: unknown[]): void {
    if (!entityId || this.checking()) {
      if (!entityId) this.router.navigate(editRoute);
      return;
    }

    this.checking.set(true);
    this.api
      .checkActiveRequest(entityId)
      .pipe(
        map((response) => response?.requestId ?? null),
        catchError((err) => {
          console.error('Active-request check failed', err);
          return of(null);
        }),
        finalize(() => this.checking.set(false)),
      )
      .subscribe((requestId) => {
        if (requestId) {
          this.blockedBy.set(requestId);
          return;
        }
        this.router.navigate(editRoute);
      });
  }

  /** Open the request that is blocking the edit. */
  viewBlockingRequest(): void {
    const requestId = this.blockedBy();
    if (!requestId) return;
    this.dismiss();
    this.router.navigate(['/request-center', requestId]);
  }

  dismiss(): void {
    this.blockedBy.set(null);
  }
}
