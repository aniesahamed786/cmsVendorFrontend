import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../core/prime.import';

interface RecentActivity {
  timestamp: string;
  date: Date;
  actionType: string;
  performedBy: string;
  targetEntity: string;
  referenceId: string;
  status: 'Created' | 'Edited' | 'Approved' | 'Rejected' | 'Published';
}

@Component({
  selector: 'app-recent-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules],
  templateUrl: './recent-activities.html',
  styleUrl: './recent-activities.scss',
})
export class RecentActivities {
  // ponytail: in-memory dummy data; swap for a service feed when the API exists
  private readonly activities: RecentActivity[] = this.buildRows();

  readonly statusOptions = [
    { label: 'All statuses', value: null },
    { label: 'Created', value: 'Created' },
    { label: 'Edited', value: 'Edited' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Published', value: 'Published' },
  ];

  readonly periodOptions = [
    { label: 'All time', value: 'all' },
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'This year', value: 'year' },
    { label: 'Custom date', value: 'custom' },
  ];

  readonly status = signal<RecentActivity['status'] | null>(null);
  readonly period = signal<string>('all');
  readonly customRange = signal<Date[] | null>(null);

  // resolve the active period to a [from, to] window
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

  readonly rows = computed(() => {
    const status = this.status();
    const [from, to] = this.window();
    return this.activities.filter((a) => {
      if (status && a.status !== status) return false;
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      return true;
    });
  });

  clearFilters(): void {
    this.status.set(null);
    this.period.set('all');
    this.customRange.set(null);
  }

  private buildRows(): RecentActivity[] {
    const seed: Omit<RecentActivity, 'date'>[] = [
      { timestamp: 'Sep. 15, 2026 | 8:32 am', actionType: 'Offer Created', performedBy: 'Vendor', targetEntity: 'Offer Creation', referenceId: 'Ref-2026-1009', status: 'Created' },
      { timestamp: 'Oct. 02, 2026 | 2:15 pm', actionType: 'Offer Edited', performedBy: 'Vendor', targetEntity: 'Marketing Campaign', referenceId: 'Ref-2026-1176', status: 'Edited' },
      { timestamp: 'Nov. 10, 2026 | 11:00 am', actionType: 'Offer Approved', performedBy: 'Admin', targetEntity: 'Pricing Team', referenceId: 'Ref-2026-1267', status: 'Approved' },
      { timestamp: 'Dec. 05, 2026 | 4:45 pm', actionType: 'Offer Rejected', performedBy: 'Admin', targetEntity: 'Customer Service', referenceId: 'Ref-2026-1289', status: 'Rejected' },
      { timestamp: 'Jan. 20, 2027 | 9:30 am', actionType: 'Offer Published', performedBy: 'Admin', targetEntity: 'IT Department', referenceId: 'Ref-2026-1321', status: 'Published' },
    ];
    // repeat the seed to give the paginator something to page through
    return Array.from({ length: 5 }, () => seed)
      .flat()
      .map((r) => ({ ...r, date: new Date(r.timestamp.split('|')[0].replace(/\./g, '')) }));
  }

  statusClass(status: RecentActivity['status']): string {
    return `recent-activities__status recent-activities__status--${status.toLowerCase()}`;
  }
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
