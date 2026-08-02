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

  /** Route the "View <Type>" button to the section the request belongs to. */
  readonly relatedListRoute = computed(() => {
    switch (this.row()?.type) {
      case 'Store':
        return '/branches';
      case 'Profile':
        return '/profile';
      default:
        return '/offers';
    }
  });

  readonly relatedListLabelKey = computed(() => {
    switch (this.row()?.type) {
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
  readonly canRecall = computed(() => this.row()?.status === 'SUBMITTED');
  readonly canCancel = computed(() => this.row()?.status === 'RETURNED');

  readonly timeline = computed<RequestTimelineStep[]>(() => {
    this.i18n.loadSeq();
    const row = this.row();
    return row ? this.buildTimeline(row.status, row.timestamp) : [];
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
    return this.row()?.id ?? '';
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
        next: () => {
          this.requestCenterService.recall(this.rowKey);
          this.showRecallConfirm = false;
        },
        error: (err) => {
          console.error('Recall request failed', err);
          this.requestCenterService.recall(this.rowKey);
          this.showRecallConfirm = false;
        },
      });
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
