import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { TableLazyLoadEvent } from 'primeng/table';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { AppBottomSheet } from '../../../../shared/Components/app-bottom-sheet/app-bottom-sheet';
import { RequestCenterService } from '../../services/request-center.service';
import { RequestCenterApiService } from '../../services/request-center-api.service';
import {
  COMPLETED_STATUSES,
  INCOMPLETE_STATUSES,
  RequestRow,
  RequestStats,
  RequestStatus,
} from '../../models/request.model';
import { ApiRequestStatus } from '../../models/request-api.model';
import { toRequestRow } from '../../models/request.mapper';
import { createCountUp } from '../../../../shared/animation/count-up';

type TabKey = 'all' | 'completed' | 'incomplete';

@Component({
  selector: 'app-request-center-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules, TranslatePipe, ConfirmationPopUp, AppBottomSheet],
  templateUrl: './request-center-list.html',
  styleUrl: './request-center-list.scss',
})
export class RequestCenterList {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly requestCenterService = inject(RequestCenterService);
  private readonly api = inject(RequestCenterApiService);

  showMobileFilters = signal(false);

  // KPI cards are fed by GET /cmsVendor/requests/metrics; the cards skeleton while it loads.
  readonly stats = signal<RequestStats>({ pendingOffer: 0, pendingStore: 0, pendingProfile: 0, rejected: 0 });
  readonly statsLoading = signal(true);

  readonly tabCounts = this.requestCenterService.tabCounts;
  readonly rows = this.requestCenterService.getRows();

  // ---- Count-up stats (shared/animation/count-up.ts) -----------------------
  private readonly countUp = createCountUp();
  readonly animatedCount = this.countUp.animatedCount;
  private readonly animateTo = this.countUp.animateTo;

  private revealStats(): void {
    const s = this.stats();
    this.animateTo('pendingOffer', s.pendingOffer);
    this.animateTo('pendingStore', s.pendingStore);
    this.animateTo('pendingProfile', s.pendingProfile);
    this.animateTo('rejected', s.rejected);
  }

  // The table skeletons while the list request is in flight.
  readonly tableLoading = signal(true);

  // ---- Pagination / Sorting / Filtering state ------------------------------
  readonly activeTab = signal<TabKey>('incomplete');
  readonly statusFilter = signal<RequestStatus | null>(null);
  readonly sortDropdown = signal<'newest' | 'oldest'>('newest');
  readonly sortBy = signal<'requestId' | 'entityType' | 'requestType' | 'title' | 'status' | 'updatedOn'>('updatedOn');
  readonly sortOrder = signal<'asc' | 'desc'>('desc');
  readonly first = signal(0);
  readonly pageSize = signal(10);
  readonly totalRecords = signal(0);

  constructor() {
    this.loadMetrics();
    this.loadTabCounts();
    this.loadRequests();
  }

  /**
   * Fetch the KPI counts. The cards skeleton while this is in flight (statsLoading), then the
   * numbers count up once the data lands.
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
   * Fetch tab totals from the server for all 3 tabs so the counts stay accurate.
   */
  private loadTabCounts(): void {
    forkJoin({
      incomplete: this.api.list({ pageSize: 1, status: INCOMPLETE_STATUSES }),
      completed: this.api.list({ pageSize: 1, status: COMPLETED_STATUSES }),
      all: this.api.list({ pageSize: 1 }),
    }).subscribe({
      next: ({ incomplete, completed, all }) => {
        this.requestCenterService.setTabCounts({
          incomplete: incomplete.total,
          completed: completed.total,
          all: all.total,
        });
      },
      error: (err) => console.error('Failed to load tab counts', err),
    });
  }

  /**
   * Fetch paginated requests from GET /api/v1/cmsVendor/requests according to the active tab,
   * status filter, sort field, sort order, and page offset.
   */
  loadRequests(): void {
    this.tableLoading.set(true);

    const tab = this.activeTab();
    const filter = this.statusFilter();

    let statusQuery: ApiRequestStatus[] | ApiRequestStatus | undefined;
    if (filter) {
      statusQuery = filter;
    } else if (tab === 'incomplete') {
      statusQuery = INCOMPLETE_STATUSES;
    } else if (tab === 'completed') {
      statusQuery = COMPLETED_STATUSES;
    } else {
      statusQuery = undefined;
    }

    const page = Math.floor(this.first() / this.pageSize()) + 1;

    this.api
      .list({
        page,
        pageSize: this.pageSize(),
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder(),
        status: statusQuery,
      })
      .pipe(finalize(() => this.tableLoading.set(false)))
      .subscribe({
        next: (res) => {
          const mapped = res.data.map(toRequestRow);
          this.requestCenterService.setRows(mapped);
          this.totalRecords.set(res.total);

          // If no sub-filter is applied, synchronize active tab count
          if (!filter) {
            this.tabCounts.update((counts) => {
              if (tab === 'incomplete') return { ...counts, incomplete: res.total };
              if (tab === 'completed') return { ...counts, completed: res.total };
              if (tab === 'all') return { ...counts, all: res.total };
              return counts;
            });
          }
        },
        error: (err) => {
          console.error('Failed to load requests', err);
          this.requestCenterService.setRows([]);
          this.totalRecords.set(0);
        },
      });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.statusFilter.set(null);
    this.first.set(0);
    this.loadRequests();
  }

  onStatusFilterChange(val: RequestStatus | null): void {
    this.statusFilter.set(val);
    this.first.set(0);
    this.loadRequests();
  }

  onSortByChange(val: 'newest' | 'oldest'): void {
    this.sortDropdown.set(val);
    this.sortBy.set('updatedOn');
    this.sortOrder.set(val === 'newest' ? 'desc' : 'asc');
    this.first.set(0);
    this.loadRequests();
  }

  private options<T>(entries: [key: string, value: T][]) {
    return computed(() => {
      this.i18n.loadSeq();
      return entries.map(([key, value]) => ({ label: this.i18n.t(key), value }));
    });
  }

  readonly statusOptions = computed(() => {
    this.i18n.loadSeq();
    const tab = this.activeTab();
    const entries: [key: string, value: RequestStatus | null][] = [
      ['requestCenter.filter.allStatuses', null],
    ];

    if (tab === 'incomplete') {
      entries.push(
        ['requestCenter.value.draft', 'DRAFT'],
        ['requestCenter.value.submitted', 'SUBMITTED'],
        ['requestCenter.value.returned', 'RETURNED'],
      );
    } else if (tab === 'completed') {
      entries.push(
        ['requestCenter.value.approved', 'APPROVED'],
        ['requestCenter.value.rejected', 'REJECTED'],
        ['requestCenter.value.recalled', 'RECALLED'],
        ['requestCenter.value.cancelled', 'CANCELLED'],
      );
    } else {
      entries.push(
        ['requestCenter.value.draft', 'DRAFT'],
        ['requestCenter.value.submitted', 'SUBMITTED'],
        ['requestCenter.value.returned', 'RETURNED'],
        ['requestCenter.value.approved', 'APPROVED'],
        ['requestCenter.value.rejected', 'REJECTED'],
        ['requestCenter.value.recalled', 'RECALLED'],
        ['requestCenter.value.cancelled', 'CANCELLED'],
      );
    }

    return entries.map(([key, value]) => ({ label: this.i18n.t(key), value }));
  });

  readonly sortOptions = this.options<'newest' | 'oldest'>([
    ['requestCenter.sort.newest', 'newest'],
    ['requestCenter.sort.oldest', 'oldest'],
  ]);

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.statusFilter()) count++;
    if (this.sortDropdown() !== 'newest') count++;
    return count;
  });

  readonly activeFilterChips = computed(() => {
    this.i18n.loadSeq();
    const chips: { key: string; label: string }[] = [];

    if (this.statusFilter()) {
      const opt = this.statusOptions().find((o) => o.value === this.statusFilter());
      chips.push({
        key: 'status',
        label: `${this.i18n.t('requestCenter.filter.status')}: ${opt?.label ?? this.statusFilter()}`,
      });
    }

    return chips;
  });

  removeFilterChip(chip: { key: string; label: string }): void {
    if (chip.key === 'status') {
      this.onStatusFilterChange(null);
    }
  }

  clearFilters(): void {
    this.statusFilter.set(null);
    this.sortDropdown.set('newest');
    this.sortBy.set('updatedOn');
    this.sortOrder.set('desc');
    this.first.set(0);
    this.loadRequests();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    const first = event.first ?? 0;
    this.pageSize.set(rows);
    this.first.set(first);

    if (event.sortField) {
      const sortFieldKey = Array.isArray(event.sortField) ? event.sortField[0] : event.sortField;
      const fieldMap: Record<string, 'requestId' | 'entityType' | 'requestType' | 'title' | 'status' | 'updatedOn'> = {
        requestId: 'requestId',
        entityType: 'entityType',
        requestType: 'requestType',
        actionType: 'requestType',
        title: 'title',
        targetEntity: 'title',
        status: 'status',
        updatedOn: 'updatedOn',
        date: 'updatedOn',
      };
      this.sortBy.set(fieldMap[sortFieldKey] ?? 'updatedOn');
      this.sortOrder.set(event.sortOrder === 1 ? 'asc' : 'desc');
    }

    this.loadRequests();
  }

  onMobilePageChange(event: { first?: number; rows?: number }): void {
    this.first.set(event.first ?? 0);
    this.pageSize.set(event.rows ?? 10);
    this.loadRequests();
  }

  /** While loading, feed the desktop table 5 falsy rows so PrimeNG renders the skeleton body. */
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
        next: () => this.afterMutation('recall'),
        error: (err) => {
          console.error('Recall request failed', err);
          this.afterMutation('recall');
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
        next: () => this.afterMutation('delete'),
        error: (err) => {
          console.error('Cancel request failed', err);
          this.afterMutation('delete');
        },
      });
  }

  /** Apply the local list change and close the matching dialog once its call settles. */
  private afterMutation(kind: 'recall' | 'delete'): void {
    if (kind === 'recall') {
      this.recallTarget.set(null);
    } else {
      this.deleteTarget.set(null);
    }
    this.loadRequests();
    this.loadTabCounts();
    this.loadMetrics();
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
