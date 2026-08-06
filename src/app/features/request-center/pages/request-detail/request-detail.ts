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
import { buildRequestView, RequestViewField, RequestViewSection } from '../../models/request-change.model';
import {
  buildEditedFieldSet,
  buildProposedEntity,
  toBranchView,
  toOfferDetailsView,
  toProfileRequestView,
} from '../../models/request-entity-view.mapper';
import { OfferDetails } from '../../../Offers/Components/offer-details/offer-details';
import { OfferHeroCard, OfferHeroVendor } from '../../../Offers/Components/offer-hero-card/offer-hero-card';
import { BranchesService } from '../../../Branches/services/branches.service';
import { VendorHeroCard } from '../../../Profile/components/vendor-hero-card/vendor-hero-card';
import { VendorProfileService } from '../../../Profile/pages/vendor-profile.service';
import { environment } from '../../../../../environments/environment';
import { RequestAdminAction, RequestDetailsResponse, RequestHistoryResponse } from '../../models/request-api.model';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/**
 * Location ids as stored on an offer, which vary by source: plain strings in a request
 * payload, `{ $oid }` wrappers straight off a Mongo document.
 */
function toIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const record = (entry ?? {}) as Record<string, unknown>;
      return String(record['$oid'] ?? record['id'] ?? record['_id'] ?? '');
    })
    .filter(Boolean);
}

/**
 * How each logged action renders. The audit trail speaks in verbs (`RETURNED`), the timeline
 * in outcomes ("Returned for Changes") — this is the one place that translation lives.
 */
const ACTION_META: Record<string, { titleKey: string; descriptionKey: string; tone?: 'danger' | 'muted' | 'warning' }> = {
  SUBMITTED: { titleKey: 'submitted.title', descriptionKey: 'submitted.description' },
  APPROVED: { titleKey: 'approved.title', descriptionKey: 'approved.description' },
  REJECTED: { titleKey: 'rejected.title', descriptionKey: 'rejected.description', tone: 'danger' },
  RETURNED: { titleKey: 'returned.title', descriptionKey: 'returned.description', tone: 'warning' },
  RECALLED: { titleKey: 'recalled.title', descriptionKey: 'recalled.description', tone: 'muted' },
  CANCELLED: { titleKey: 'cancelled.title', descriptionKey: 'cancelled.description', tone: 'muted' },
};

/** `VENDOR_ADMIN` → `Vendor Admin`. Roles are stored as enum-ish constants, not labels. */
function prettyRole(role: string | null | undefined): string {
  if (!role) return '';
  return role
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PrimeUIModules, TranslatePipe, BackButton, Button, ConfirmationPopUp, OfferDetails, OfferHeroCard, VendorHeroCard],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.scss',
})
export class RequestDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly requestCenterService = inject(RequestCenterService);
  private readonly api = inject(RequestCenterApiService);
  private readonly branchesService = inject(BranchesService);
  private readonly vendorProfileService = inject(VendorProfileService);

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

  // ---- Audit trail (GET /cmsVendor/requests/getHistory/{id}) -----------------
  /**
   * Every action taken on this request, oldest first. This is what drives the timeline: a
   * request can be returned, resubmitted and approved, and only the log holds all of it —
   * `adminAction` on the request document keeps just the most recent decision.
   */
  readonly history = signal<RequestHistoryResponse[]>([]);
  readonly historyLoading = signal(true);

  /** The entity rendered in full, with this request's edits applied and flagged. */
  readonly changeSections = computed<RequestViewSection[]>(() => buildRequestView(this.details()));

  // ---- Entity-shaped preview ------------------------------------------------
  // A request is reviewed by looking at the thing itself, so it renders in that entity's own
  // detail design: offers via <app-offer-details>, profiles via <app-vendor-preview>, stores
  // as a branch card. The generic field list stays as the fallback for anything else.
  private readonly proposedEntity = computed(() => buildProposedEntity(this.details()));

  readonly entityType = computed(() => this.details()?.entityType ?? null);
  readonly offerView = computed(() => toOfferDetailsView(this.proposedEntity()));

  // ---- Offer hero banner ----------------------------------------------------
  /**
   * Vendor identity for the hero. A request payload only carries `vendorId`, so the name and
   * logo come from the caller's own profile — which is always the right vendor here, since a
   * vendor can only ever see their own requests.
   */
  readonly heroVendor = signal<OfferHeroVendor>({ name: '', nameAr: '', logo: '' });

  // ---- Offer locations ------------------------------------------------------
  // An offer payload stores `locationIds` only, so the branch names have to be resolved
  // against the vendor's own locations (GET /cmsVendor/locations) before they can be shown.
  readonly vendorLocations = signal<Record<string, unknown>[]>([]);

  /** The vendor's branches this offer is available at, in the order the payload lists them. */
  readonly offerLocations = computed(() => {
    const ids = toIdList(this.proposedEntity()['locationIds']);
    if (ids.length === 0) return [];

    const byId = new Map(
      this.vendorLocations().map((location) => [String(location['id']), location] as const),
    );
    return ids
      .map((id) => byId.get(id))
      .filter((location): location is Record<string, unknown> => !!location);
  });
  readonly profileView = computed(() => toProfileRequestView(this.proposedEntity()));
  readonly branchView = computed(() => toBranchView(this.proposedEntity()));

  /** Same media-path rewrite the vendor profile page uses. */
  imageUrl(path: string): string {
    if (!path) return '';
    return environment.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
  }

  /**
   * Field names this request edits. Fields stay in the entity's natural order and are simply
   * marked in place — no separate "what changed" list, which pulled edits out of context.
   */
  readonly editedFieldSet = computed(() => buildEditedFieldSet(this.details()));
  private readonly editedFields = this.editedFieldSet;

  isEdited(...keys: string[]): boolean {
    const edited = this.editedFields();
    return keys.some((key) => edited.has(key));
  }

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
    this.loadHistory();
  }

  /**
   * Keyed on the requestId alone, so it works on a deep link. A failure leaves the log empty
   * and the timeline falls back to the status-derived one — losing the audit trail should not
   * cost the vendor the whole sidebar.
   */
  private loadHistory(): void {
    if (!this.rowKey) {
      this.historyLoading.set(false);
      return;
    }

    this.historyLoading.set(true);
    this.api
      .getHistory(this.rowKey)
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (entries) => this.history.set(entries ?? []),
        error: (err) => {
          console.error('Failed to load request history', err);
          this.history.set([]);
        },
      });
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
        next: (details) => {
          this.details.set(details);
          // Only offers reference branches or render the vendor hero; every other entity
          // type would waste both calls.
          if (details?.entityType === 'OFFER') {
            this.loadVendorLocations();
            this.loadHeroVendor();
          }
        },
        error: (err) => {
          console.error('Failed to load request details', err);
          this.details.set(null);
          this.changesError.set(
            extractApiErrorMessage(err) ?? this.i18n.t('requestCenter.detail.changesFailed'),
          );
        },
      });
  }

  /**
   * The vendor's branches, mapped to the field names <app-offer-details> reads. Failing here
   * only costs the locations card — the rest of the request still renders — so it degrades to
   * an empty list rather than an error state.
   */
  /**
   * The vendor's own name and logo for the hero banner. Degrades to the placeholder logo and
   * "Unknown vendor" on failure — the request itself still renders.
   */
  private loadHeroVendor(): void {
    this.vendorProfileService.getVendorProfile().subscribe({
      next: (profile) =>
        this.heroVendor.set({
          name: profile?.vendorName ?? '',
          nameAr: profile?.vendorNameAr ?? '',
          logo: profile?.vendorLogo ?? '',
        }),
      error: (err) => console.error('Failed to load vendor for request hero', err),
    });
  }

  private loadVendorLocations(): void {
    this.branchesService.getBranches().subscribe({
      next: (rows) =>
        this.vendorLocations.set(
          (rows ?? []).map((row) => ({
            id: row?.locationId ?? '',
            branch_name: row?.locationName ?? '',
            branch_name_ar: row?.locationNameAr ?? '',
            city: row?.city ?? '',
          })),
        ),
      error: (err) => {
        console.error('Failed to load vendor locations', err);
        this.vendorLocations.set([]);
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

  // Mirrors the backend's ALLOWED_TRANSITIONS: recall only from SUBMITTED.
  readonly canRecall = computed(() => this.status() === 'SUBMITTED');
  // A RETURNED request offers Edit and Cancel only. There is no Resubmit button by design —
  // a returned request goes back for changes, so it is re-sent by editing it, not by pushing
  // the same content through again unchanged.
  readonly canCancel = computed(() => this.status() === 'RETURNED');

  /**
   * A request can be edited until an admin decision sticks — mirrors the backend's
   * EDITABLE_STATUSES. APPROVED / REJECTED / RECALLED / CANCELLED are final, so the button
   * is hidden rather than shown-and-rejected.
   */
  readonly canEdit = computed(() => {
    const status = this.status();
    return status === 'DRAFT' || status === 'SUBMITTED' || status === 'RETURNED';
  });

  goToEdit(): void {
    this.router.navigate(['/request-center', this.requestIdParam, 'edit']);
  }

  readonly timeline = computed<RequestTimelineStep[]>(() => {
    this.i18n.loadSeq();
    const status = this.status();
    if (!status) return [];

    // The audit trail is the real record — use it whenever there is one. The status-derived
    // timeline below stays as the fallback for a request with no logged action yet (a DRAFT
    // that was never submitted) or if the history call failed.
    const log = this.history();
    if (log.length) return this.buildTimelineFromHistory(log, status);

    const details = this.details();
    // submittedOn is the real submission stamp; fall back to the row's timestamp, then createdOn.
    const submittedAt = details?.submittedOn ?? this.row()?.timestamp ?? details?.createdOn ?? '';
    return this.buildTimeline(status, submittedAt, details?.adminAction ?? null);
  });

  /**
   * The logged actions in order, each its own step, followed by an "Under Review" step while
   * the request is still sitting with the admin.
   *
   * Every entry is rendered, not just the latest: a request that was returned, fixed and
   * approved should read as that whole story, which is the difference between this and the
   * three-step timeline it replaces.
   */
  private buildTimelineFromHistory(
    log: RequestHistoryResponse[],
    status: RequestStatus,
  ): RequestTimelineStep[] {
    const t = (key: string) => this.i18n.t(`requestCenter.detail.timeline.${key}`);

    const steps: RequestTimelineStep[] = [...log]
      .sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime())
      .map((entry, index) => {
        const meta = ACTION_META[String(entry.action ?? '').toUpperCase()];
        return {
          key: `${entry.action}-${index}`,
          title: meta ? t(meta.titleKey) : prettyRole(entry.action),
          description: meta ? t(meta.descriptionKey) : '',
          state: 'done' as const,
          tone: meta?.tone,
          date: this.formatTimestamp(entry.createdOn),
          // The admin's note is the vendor's only guidance on a rejection or return.
          reason: entry.remarks ?? undefined,
          actor: prettyRole(entry.performedRole),
        };
      });

    // Awaiting a decision — say so, rather than ending on "Submitted" with no sense of what
    // happens next.
    if (status === 'SUBMITTED') {
      steps.push({
        key: 'underReview',
        title: t('underReview.title'),
        state: 'active',
        badge: t('underReview.badge'),
        description: t('underReview.description'),
      });
    }

    return steps;
  }

  /** Timestamps arrive as ISO strings; the timeline is read by people. */
  private formatTimestamp(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString(this.i18n.lang() === 'ar' ? 'ar' : 'en', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  private buildTimeline(
    status: RequestStatus,
    submittedAt: string,
    adminAction: RequestAdminAction | null = null,
  ): RequestTimelineStep[] {
    const t = (key: string) => this.i18n.t(key);
    // The admin's reason is the whole point of a RETURNED/REJECTED decision — surface it.
    const reason = adminAction?.reason ?? undefined;
    const decidedOn = this.formatTimestamp(adminAction?.actionOn) || undefined;
    submittedAt = this.formatTimestamp(submittedAt);

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
      APPROVED: { key: 'final', title: t('requestCenter.detail.timeline.approved.title'), state: 'done', date: decidedOn, description: t('requestCenter.detail.timeline.approved.description') },
      REJECTED: { key: 'final', title: t('requestCenter.detail.timeline.rejected.title'), state: 'done', tone: 'danger', date: decidedOn, reason, description: t('requestCenter.detail.timeline.rejected.description') },
      RECALLED: { key: 'final', title: t('requestCenter.detail.timeline.recalled.title'), state: 'done', tone: 'muted', date: decidedOn, description: t('requestCenter.detail.timeline.recalled.description') },
      CANCELLED: { key: 'final', title: t('requestCenter.detail.timeline.cancelled.title'), state: 'done', tone: 'muted', date: decidedOn, description: t('requestCenter.detail.timeline.cancelled.description') },
      // RETURNED is not "still under review" — the admin has acted and handed it back, so it
      // gets its own resolved step carrying the reason the vendor must address.
      RETURNED: { key: 'final', title: t('requestCenter.detail.timeline.returned.title'), state: 'done', tone: 'warning', date: decidedOn, reason, description: t('requestCenter.detail.timeline.returned.description') },
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

  markerModifier(step: RequestTimelineStep): 'done' | 'active' | 'upcoming' | 'danger' | 'muted' | 'warning' {
    if (step.state === 'done' && step.tone === 'danger') return 'danger';
    if (step.state === 'done' && step.tone === 'warning') return 'warning';
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
