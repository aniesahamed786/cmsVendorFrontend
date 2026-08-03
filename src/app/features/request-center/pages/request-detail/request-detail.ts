import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { Button } from '../../../../shared/Components/button/button';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { RequestCenterService } from '../../services/request-center.service';
import { RequestCenterApiService } from '../../services/request-center-api.service';
import { RequestStatus, RequestTimelineStep } from '../../models/request.model';
import { buildRequestView, RequestViewSection } from '../../models/request-change.model';
import { RequestDetailsResponse } from '../../models/request-api.model';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PrimeUIModules, TranslatePipe, BackButton, Button, ConfirmationPopUp],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.scss',
})
export class RequestDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly requestCenterService = inject(RequestCenterService);
  private readonly api = inject(RequestCenterApiService);

  private readonly rowKey = this.route.snapshot.paramMap.get('id') ?? '';
  readonly row = this.requestCenterService.getRow(this.rowKey);

  /**
   * The requestId from the URL. The summary row lives only in the session store, so on a
   * deep link/refresh `row()` is null — but the changes below still load, since the changes
   * endpoint keys on this id alone.
   */
  readonly requestIdParam = this.rowKey;

  // ---- Request details (GET /cmsVendor/requests/{id}) -----------------------
  /** The request plus its live entity and diff — everything this page renders. */
  readonly details = signal<RequestDetailsResponse | null>(null);
  readonly changesLoading = signal(true);
  readonly changesError = signal<string | null>(null);

  /** The entity rendered in full, with this request's edits applied and flagged. */
  readonly changeSections = computed<RequestViewSection[]>(() => buildRequestView(this.details()));

  /** True once loading finished and there is nothing to render. */
  readonly hasNoChanges = computed(
    () => !this.changesLoading() && !this.changesError() && this.changeSections().length === 0,
  );

  /**
   * Status comes from the API when available, falling back to the list row. This is what lets
   * the page work on a deep link, where the session store is empty.
   */
  readonly status = computed<RequestStatus | null>(
    () => (this.details()?.status as RequestStatus | undefined) ?? this.row()?.status ?? null,
  );

  readonly requestTitle = computed(() => this.details()?.title ?? this.row()?.targetEntity ?? '');

  constructor() {
    this.loadDetails();
  }

  private loadDetails(): void {
    // The route param is the requestId every workflow endpoint keys on.
    if (!this.rowKey) {
      this.changesLoading.set(false);
      return;
    }

    this.changesLoading.set(true);
    this.changesError.set(null);
    this.api
      .getDetails(this.rowKey)
      .pipe(finalize(() => this.changesLoading.set(false)))
      .subscribe({
        next: (details) => this.details.set(details),
        error: (err) => {
          console.error('Failed to load request details', err);
          this.details.set(null);
          this.changesError.set(
            extractApiErrorMessage(err) ?? this.i18n.t('requestCenter.detail.changesFailed'),
          );
        },
      });
  }

  /** Route the "View <Type>" button to the section the request belongs to. */
  /** Prefer the API's entityType; the list row's `type` is the session-store fallback. */
  private readonly entityKind = computed(() => {
    const entityType = this.details()?.entityType;
    if (entityType === 'STORE') return 'Store';
    if (entityType === 'PROFILE') return 'Profile';
    if (entityType === 'OFFER') return 'Offer';
    return this.row()?.type;
  });

  readonly relatedListRoute = computed(() => {
    switch (this.entityKind()) {
      case 'Store':
        return '/branches';
      case 'Profile':
        return '/profile';
      default:
        return '/offers';
    }
  });

  readonly relatedListLabelKey = computed(() => {
    switch (this.entityKind()) {
      case 'Store':
        return 'requestCenter.detail.viewStores';
      case 'Profile':
        return 'requestCenter.detail.viewProfile';
      default:
        return 'requestCenter.detail.viewOffers';
    }
  });

  // A SUBMITTED request can be recalled; a RETURNED one can be cancelled (mirrors the
  // backend transition rules — see request.service.ts ALLOWED_TRANSITIONS).
  readonly canRecall = computed(() => this.status() === 'SUBMITTED');
  readonly canCancel = computed(() => this.status() === 'RETURNED');

  readonly timeline = computed<RequestTimelineStep[]>(() => {
    this.i18n.loadSeq();
    const status = this.status();
    if (!status) return [];
    // submittedOn is the real submission stamp; fall back to the row's timestamp, then createdOn.
    const details = this.details();
    const submittedAt = details?.submittedOn ?? this.row()?.timestamp ?? details?.createdOn ?? '';
    return this.buildTimeline(status, submittedAt);
  });

  private buildTimeline(status: RequestStatus, submittedAt: string): RequestTimelineStep[] {
    const t = (key: string) => this.i18n.t(key);
    const submitted: RequestTimelineStep = {
      key: 'submitted',
      title: t('requestCenter.detail.timeline.submitted.title'),
      state: 'done',
      date: submittedAt,
      description: t('requestCenter.detail.timeline.submitted.description'),
    };
    const reviewed: RequestTimelineStep = {
      key: 'underReview',
      title: t('requestCenter.detail.timeline.underReview.title'),
      state: 'done',
      description: t('requestCenter.detail.timeline.underReview.description'),
    };

    // Terminal outcomes render a resolved third step; anything still in flight shows the
    // active "Under Review" + upcoming "Approved" steps.
    const finalStep: Partial<Record<RequestStatus, RequestTimelineStep>> = {
      APPROVED: { key: 'final', title: t('requestCenter.detail.timeline.approved.title'), state: 'done', description: t('requestCenter.detail.timeline.approved.description') },
      REJECTED: { key: 'final', title: t('requestCenter.detail.timeline.rejected.title'), state: 'done', tone: 'danger', description: t('requestCenter.detail.timeline.rejected.description') },
      RECALLED: { key: 'final', title: t('requestCenter.detail.timeline.recalled.title'), state: 'done', tone: 'muted', description: t('requestCenter.detail.timeline.recalled.description') },
      CANCELLED: { key: 'final', title: t('requestCenter.detail.timeline.cancelled.title'), state: 'done', tone: 'muted', description: t('requestCenter.detail.timeline.cancelled.description') },
    };

    if (finalStep[status]) {
      return [submitted, reviewed, finalStep[status]!];
    }

    // DRAFT / SUBMITTED / RETURNED — still in flight.
    return [
      submitted,
      {
        key: 'underReview',
        title: t('requestCenter.detail.timeline.underReview.title'),
        state: 'active',
        badge: t('requestCenter.detail.timeline.underReview.badge'),
        description: t('requestCenter.detail.timeline.underReview.description'),
      },
      {
        key: 'final',
        title: t('requestCenter.detail.timeline.approved.title'),
        state: 'upcoming',
        description: t('requestCenter.detail.timeline.approved.description'),
      },
    ];
  }

  markerModifier(step: RequestTimelineStep): 'done' | 'active' | 'upcoming' | 'danger' | 'muted' {
    if (step.state === 'done' && step.tone === 'danger') return 'danger';
    if (step.state === 'done' && step.tone === 'muted') return 'muted';
    return step.state;
  }

  goBack(): void {
    this.router.navigate(['/request-center']);
  }

  statusClass(status: RequestStatus): string {
    return `request-detail__status request-detail__status--${status.toLowerCase()}`;
  }

  statusKey(status: RequestStatus): string {
    return `requestCenter.value.${status.toLowerCase()}`;
  }

  /** The persisted requestId every workflow endpoint keys on. */
  private get requestId(): string {
    // The route param is itself the requestId, so recall/cancel work on a deep link too.
    return this.details()?.requestId ?? this.row()?.id ?? this.rowKey;
  }

  // The confirm button spins while its endpoint is in flight.
  readonly actionLoading = signal(false);

  // ---- Recall confirmation (POST /cmsVendor/requests/{id}/recall) -----------
  showRecallConfirm = false;

  confirmRecall(): void {
    this.showRecallConfirm = true;
  }

  onRecallConfirmed(): void {
    this.actionLoading.set(true);
    this.api
      .recall(this.requestId)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.afterRecall(),
        error: (err) => {
          console.error('Recall request failed', err);
          this.afterRecall();
        },
      });
  }

  /**
   * Reflect the recall locally. The list row only exists in the session store (empty after a
   * refresh), so the loaded details are updated too — otherwise a deep-linked page would keep
   * showing the Recall button after a successful recall.
   */
  private afterRecall(): void {
    this.requestCenterService.recall(this.rowKey);
    this.details.update((details) => (details ? { ...details, status: 'RECALLED' } : details));
    this.showRecallConfirm = false;
  }

  // ---- Cancel confirmation (POST /cmsVendor/requests/{id}/cancel) -----------
  showCancelConfirm = false;

  confirmCancel(): void {
    this.showCancelConfirm = true;
  }

  onCancelConfirmed(): void {
    this.actionLoading.set(true);
    this.api
      .cancel(this.requestId)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.afterCancel(),
        error: (err) => {
          console.error('Cancel request failed', err);
          this.afterCancel();
        },
      });
  }

  private afterCancel(): void {
    this.requestCenterService.remove(this.rowKey);
    this.showCancelConfirm = false;
    this.goBack();
  }
}
