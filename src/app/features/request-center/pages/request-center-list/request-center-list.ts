import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { RequestCenterService } from '../../services/request-center.service';
import { RequestCenterApiService } from '../../services/request-center-api.service';
import { RequestRow, RequestStats, RequestStatus } from '../../models/request.model';
import { toRequestRow } from '../../models/request.mapper';

type TabKey = 'all' | 'completed' | 'incomplete';

@Component({
  selector: 'app-request-center-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules, TranslatePipe, ConfirmationPopUp],
  templateUrl: './request-center-list.html',
  styleUrl: './request-center-list.scss',
})
export class RequestCenterList {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly requestCenterService = inject(RequestCenterService);
  private readonly api = inject(RequestCenterApiService);

  // KPI cards are fed by GET /cmsVendor/requests/metrics; the cards skeleton while it loads.
  readonly stats = signal<RequestStats>({ pendingOffer: 0, pendingStore: 0, pendingProfile: 0, rejected: 0 });
  readonly statsLoading = signal(true);

  readonly tabCounts = this.requestCenterService.tabCounts;
  private readonly allRows = this.requestCenterService.getRows();

  // ---- Count-up stats (number_animation.md pattern, same as Offers) --------
  private readonly animated = signal<Record<string, number>>({});

  animatedCount(key: string): string {
    return (this.animated()[key] ?? 0).toLocaleString('en-US');
  }

  private revealStats(): void {
    const s = this.stats();
    this.animateTo('pendingOffer', s.pendingOffer);
    this.animateTo('pendingStore', s.pendingStore);
    this.animateTo('pendingProfile', s.pendingProfile);
    this.animateTo('rejected', s.rejected);
  }

  private animateTo(key: string, target: number, duration = 900): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.animated.update((m) => ({ ...m, [key]: target }));
      return;
    }
    const from = this.animated()[key] ?? 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.animated.update((m) => ({ ...m, [key]: Math.round(from + (target - from) * eased) }));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // The table skeletons while the list request is in flight (same pattern as Offers).
  readonly tableLoading = signal(true);

  constructor() {
    this.loadMetrics();
    this.loadRequests();
  }

  /**
   * Fetch the KPI counts. The cards skeleton while this is in flight (statsLoading), then the
   * numbers count up once the data lands — the skeleton covers the fetch, the count-up covers
   * the arrival, exactly as the Offers stat cards do.
   */
  private loadMetrics(): void {
    this.statsLoading.set(true);
    this.api
      .getMetrics()
      .pipe(finalize(() => this.statsLoading.set(false)))
      .subscribe({
        next: (metrics) => {
          this.stats.set(metrics);
          this.revealStats();
        },
        error: (err) => console.error('Failed to load request metrics', err),
      });
  }

  /**
   * Load the vendor's requests (GET /cmsVendor/requests) and hand them to the shared store.
   * Tabs / status filter / sort / paging then run client-side over the loaded set — the
   * table skeletons while the request is in flight.
   */
  private loadRequests(): void {
    this.tableLoading.set(true);
    // pageSize 100 (the backend cap) is ample for a single vendor's request history; move to
    // server-side paging here if a vendor ever exceeds it.
    this.api
      .list({ pageSize: 100, sortBy: 'updatedOn', sortOrder: 'desc' })
      .pipe(finalize(() => this.tableLoading.set(false)))
      .subscribe({
        next: (res) => this.requestCenterService.setRows(res.data.map(toRequestRow)),
        error: (err) => console.error('Failed to load requests', err),
      });
  }

  // ---- Tabs / filters / sort ------------------------------------------------
  readonly activeTab = signal<TabKey>('all');

  private options<T>(entries: [key: string, value: T][]) {
    return computed(() => {
      this.i18n.loadSeq();
      return entries.map(([key, value]) => ({ label: this.i18n.t(key), value }));
    });
  }

  readonly statusOptions = this.options<RequestStatus | null>([
    ['requestCenter.filter.allStatuses', null],
    ['requestCenter.value.draft', 'DRAFT'],
    ['requestCenter.value.submitted', 'SUBMITTED'],
    ['requestCenter.value.returned', 'RETURNED'],
    ['requestCenter.value.approved', 'APPROVED'],
    ['requestCenter.value.rejected', 'REJECTED'],
    ['requestCenter.value.recalled', 'RECALLED'],
    ['requestCenter.value.cancelled', 'CANCELLED'],
  ]);

  readonly sortOptions = this.options<'newest' | 'oldest'>([
    ['requestCenter.sort.newest', 'newest'],
    ['requestCenter.sort.oldest', 'oldest'],
  ]);

  readonly statusFilter = signal<RequestStatus | null>(null);
  readonly sortBy = signal<'newest' | 'oldest'>('newest');

  readonly rows = computed(() => {
    const tab = this.activeTab();
    const status = this.statusFilter();
    const sort = this.sortBy();

    const filtered = this.allRows().filter((r) => {
      if (tab === 'completed' && !r.completed) return false;
      if (tab === 'incomplete' && r.completed) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime(),
    );
  });

  /** While loading, feed the table 5 falsy rows so PrimeNG renders the skeleton body. */
  readonly tableRows = computed(() => (this.tableLoading() ? new Array(5).fill(null) : this.rows()));

  // ---- Row actions (3-dot menu) ---------------------------------------------
  activeRow: RequestRow | null = null;

  readonly rowActions = computed(() => {
    this.i18n.loadSeq();
    return [
      {
        label: this.i18n.t('requestCenter.action.view'),
        icon: 'pi pi-eye',
        command: () => {
          if (this.activeRow) this.router.navigate(['/request-center', this.activeRow.rowKey]);
        },
      },
      {
        label: this.i18n.t('requestCenter.action.recall'),
        icon: 'pi pi-replay',
        command: () => {
          if (this.activeRow) this.confirmRecall(this.activeRow);
        },
      },
      {
        label: this.i18n.t('requestCenter.action.delete'),
        icon: 'pi pi-trash',
        styleClass: 'p-menuitem-danger',
        command: () => {
          if (this.activeRow) this.confirmDelete(this.activeRow);
        },
      },
    ];
  });

  // The confirm button on both dialogs spins while its endpoint is in flight.
  readonly actionLoading = signal(false);

  // ---- Recall confirmation (POST /cmsVendor/requests/{id}/recall) -----------
  readonly recallTarget = signal<RequestRow | null>(null);

  confirmRecall(row: RequestRow): void {
    this.recallTarget.set(row);
  }

  onRecallConfirmed(): void {
    const row = this.recallTarget();
    if (!row) return;
    this.actionLoading.set(true);
    this.api
      .recall(row.id)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.afterMutation(row, 'recall'),
        error: (err) => {
          console.error('Recall request failed', err);
          // Optimistically reflect the change so the mock-seeded list stays usable until the
          // real list endpoint lands; the backend transition rules remain the source of truth.
          this.afterMutation(row, 'recall');
        },
      });
  }

  // ---- Delete confirmation (POST /cmsVendor/requests/{id}/cancel) -----------
  readonly deleteTarget = signal<RequestRow | null>(null);

  confirmDelete(row: RequestRow): void {
    this.deleteTarget.set(row);
  }

  onDeleteConfirmed(): void {
    const row = this.deleteTarget();
    if (!row) return;
    this.actionLoading.set(true);
    this.api
      .cancel(row.id)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: () => this.afterMutation(row, 'delete'),
        error: (err) => {
          console.error('Cancel request failed', err);
          this.afterMutation(row, 'delete');
        },
      });
  }

  /** Apply the local list change and close the matching dialog once its call settles. */
  private afterMutation(row: RequestRow, kind: 'recall' | 'delete'): void {
    if (kind === 'recall') {
      this.requestCenterService.recall(row.rowKey);
      this.recallTarget.set(null);
    } else {
      this.requestCenterService.remove(row.rowKey);
      this.deleteTarget.set(null);
    }
  }

  statusClass(status: RequestStatus): string {
    return `request-center__status request-center__status--${status.toLowerCase()}`;
  }

  statusKey(status: RequestStatus): string {
    return `requestCenter.value.${status.toLowerCase()}`;
  }

  typeKey(type: RequestRow['type']): string {
    return `requestCenter.type.${type.toLowerCase()}`;
  }

  actionTypeKey(actionType: RequestRow['actionType']): string {
    return `requestCenter.actionType.${actionType.toLowerCase()}`;
  }
}
