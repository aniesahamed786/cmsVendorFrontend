import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent } from 'primeng/table';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { PrimeUIModules } from '../../core/prime.import';
import { AppSearch } from '../../shared/Components/app-search/app-search';
import { AppBottomSheet } from '../../shared/Components/app-bottom-sheet/app-bottom-sheet';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { ApiRequestEntityType } from '../request-center/models/request-api.model';
import { ActivityRow, toActivityPage } from './models/system-log.mapper';
import { SystemLogAction, SystemLogSortOrder } from './models/system-log.model';
import { SystemLogService } from './services/system-log.service';

@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, AppSearch, AppBottomSheet, TranslatePipe],
  templateUrl: './recent-activities.html',
  styleUrl: './recent-activities.scss',
})
export class RecentActivities implements OnInit {
  private readonly api = inject(SystemLogService);

  showMobileFilters = signal(false);

  readonly entityTypeOptions = [
    { label: 'All types', value: null },
    { label: 'Offer', value: 'OFFER' },
    { label: 'Store', value: 'STORE' },
    { label: 'Profile', value: 'PROFILE' },
  ];

  readonly actionOptions = [
    { label: 'All actions', value: null },
    { label: 'Submitted', value: 'SUBMITTED' },
    { label: 'Recalled', value: 'RECALLED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  readonly periodOptions = [
    { label: 'All time', value: 'all' },
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'This year', value: 'year' },
    { label: 'Custom date', value: 'custom' },
  ];

  readonly entityType = signal<ApiRequestEntityType | null>(null);
  readonly action = signal<SystemLogAction | null>(null);
  readonly period = signal<string>('all');
  readonly customRange = signal<Date[] | null>(null);
  readonly search = signal<string>('');
  readonly sortOrder = signal<SystemLogSortOrder>('desc');

  readonly rows = signal<ActivityRow[]>([]);
  readonly totalRecords = signal(0);
  readonly loading = signal(true);
  readonly pageSize = signal(10);
  readonly loadFailed = signal(false);

  /** While loading, feed the table falsy rows so PrimeNG renders the skeleton body. */
  readonly tableRows = computed(() =>
    this.loading() ? new Array(this.pageSize()).fill(null) : this.rows(),
  );

  private readonly searchInput = new Subject<string>();

  private readonly window = computed<[Date | null, Date | null]>(() => {
    const period = this.period();
    if (period === 'custom') {
      const [from, to] = this.customRange() ?? [];
      return [from ?? null, to ? endOfDay(to) : null];
    }
    if (period === 'all') return [null, null];
    const to = endOfDay(new Date());
    if (period === 'year') return [new Date(new Date().getFullYear(), 0, 1), to];
    const from = new Date();
    from.setDate(from.getDate() - Number(period));
    return [from, to];
  });

  ngOnInit(): void {
    this.searchInput
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((value) => {
        this.search.set(value);
        this.reload();
      });
    // ponytail: no initial load here — p-table [lazy] fires onLazyLoad on init
  }

  onEntityTypeChange(value: ApiRequestEntityType | null): void {
    this.entityType.set(value);
    this.reload();
  }

  onActionChange(value: SystemLogAction | null): void {
    this.action.set(value);
    this.reload();
  }

  onPeriodChange(value: string): void {
    this.period.set(value);
    if (value !== 'custom') this.reload();
  }

  onCustomRangeChange(value: Date[] | null): void {
    this.customRange.set(value);
    if (value?.[0] && value?.[1]) this.reload();
  }

  onSearchInput(value: string): void {
    this.searchInput.next(value);
  }

  clearFilters(): void {
    this.entityType.set(null);
    this.action.set(null);
    this.period.set('all');
    this.customRange.set(null);
    this.search.set('');
    this.reload();
  }

  readonly activeFilterChips = computed(() => {
    const chips: { key: string; label: string }[] = [];

    if (this.entityType()) {
      const opt = this.entityTypeOptions.find((o) => o.value === this.entityType());
      chips.push({
        key: 'entityType',
        label: `Type: ${opt?.label ?? this.entityType()}`,
      });
    }

    if (this.action()) {
      const opt = this.actionOptions.find((o) => o.value === this.action());
      chips.push({
        key: 'action',
        label: `Action: ${opt?.label ?? this.action()}`,
      });
    }

    if (this.period() !== 'all') {
      const opt = this.periodOptions.find((o) => o.value === this.period());
      chips.push({
        key: 'period',
        label: `Period: ${opt?.label ?? this.period()}`,
      });
    }

    return chips;
  });

  removeFilterChip(chip: { key: string; label: string }): void {
    if (chip.key === 'entityType') {
      this.entityType.set(null);
    } else if (chip.key === 'action') {
      this.action.set(null);
    } else if (chip.key === 'period') {
      this.period.set('all');
      this.customRange.set(null);
    }
    this.reload();
  }

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.entityType()) count++;
    if (this.action()) count++;
    if (this.period() !== 'all') count++;
    return count;
  });

  readonly hasActiveFilters = computed(() => this.activeFilterCount() > 0 || !!this.search().trim());

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    this.pageSize.set(rows);

    if (event.sortOrder) this.sortOrder.set(event.sortOrder === 1 ? 'asc' : 'desc');

    this.load(Math.floor((event.first ?? 0) / rows) + 1);
  }

  private reload(): void {
    this.load(1);
  }

  private load(page: number): void {
    const [from, to] = this.window();
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api
      .getSystemLogs({
        page,
        pageSize: this.pageSize(),
        sortOrder: this.sortOrder(),
        entityType: this.entityType() ?? undefined,
        action: this.action() ?? undefined,
        search: this.search() || undefined,
        from: from?.toISOString(),
        to: to?.toISOString(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const { rows, total } = toActivityPage(res);
          this.rows.set(rows);
          this.totalRecords.set(total);
        },
        error: (err: HttpErrorResponse) => {
          this.rows.set([]);
          this.totalRecords.set(0);
          this.loadFailed.set(true);
        },
      });
  }

  statusClass(status: string): string {
    return `recent-activities__status recent-activities__status--${status.toLowerCase()}`;
  }
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
