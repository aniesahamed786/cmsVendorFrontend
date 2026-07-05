import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';

type Availability = 'Online' | 'In-Store' | 'Hybrid';
type OfferStatus = 'Active' | 'Scheduled' | 'Expired';

interface Offer {
  id: string;
  title: string;
  discount: string;
  discountType: 'Percentage' | 'Fixed Amount';
  availability: Availability;
  branch: string;
  startDate: Date;
  expirationDate: Date;
  status: OfferStatus;
}

import { Router, ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules],
  templateUrl: './offers.html',
  styleUrl: './offers.scss',
})
export class Offers {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  // ponytail: in-memory dummy data; swap for a service feed when the API exists
  private readonly offers: Offer[] = this.buildRows();

  readonly statusOptions = [
    { label: 'All statuses', value: null },
    { label: 'Active', value: 'Active' },
    { label: 'Scheduled', value: 'Scheduled' },
    { label: 'Expired', value: 'Expired' },
  ];

  readonly branchOptions = [
    { label: 'All branches', value: null },
    { label: 'Main Branch', value: 'Main Branch' },
    { label: 'Downtown', value: 'Downtown' },
    { label: 'Mall', value: 'Mall' },
  ];

  readonly discountTypeOptions = [
    { label: 'All types', value: null },
    { label: 'Percentage', value: 'Percentage' },
    { label: 'Fixed Amount', value: 'Fixed Amount' },
  ];

  readonly availabilityOptions = [
    { label: 'All availability', value: null },
    { label: 'Online', value: 'Online' },
    { label: 'In-Store', value: 'In-Store' },
    { label: 'Hybrid', value: 'Hybrid' },
  ];

  readonly sortOptions = [
    { label: 'Date (Newest)', value: 'newest' },
    { label: 'Date (Oldest)', value: 'oldest' },
    { label: 'Title (A–Z)', value: 'title' },
  ];

  readonly periodOptions = [
    { label: 'All time', value: 'all' },
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'This year', value: 'year' },
    { label: 'Custom date', value: 'custom' },
  ];

  readonly status = signal<OfferStatus | null>(null);
  readonly branch = signal<string | null>(null);
  readonly availability = signal<Availability | null>(null);
  readonly discountType = signal<'Percentage' | 'Fixed Amount' | null>(null);
  readonly period = signal<string>('all');
  readonly customRange = signal<Date[] | null>(null);
  readonly sort = signal<string>('newest');
  readonly search = signal<string>('');

  activeOffer: Offer | null = null;

  readonly rowActions = [
    { label: 'View Offer', icon: 'pi pi-eye', command: () => { if (this.activeOffer) this.router.navigate([this.activeOffer.id], { relativeTo: this.route }); } },
    { label: 'Request Changes', icon: 'pi pi-arrows-v', command: () => { if (this.activeOffer) this.router.navigate(['edit', this.activeOffer.id], { relativeTo: this.route }); } },
    { label: 'Request to Renew', icon: 'pi pi-refresh' },
    { label: 'Create Ticket', icon: 'pi pi-comment' },
    { label: 'Deactivate Offer', icon: 'pi pi-file-excel', styleClass: 'p-menuitem-danger' }
  ];

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

  readonly stats = computed(() => {
    const all = this.offers;
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    return {
      active: all.filter((o) => o.status === 'Active').length,
      scheduled: all.filter((o) => o.status === 'Scheduled').length,
      expiringSoon: all.filter((o) => o.expirationDate >= now && o.expirationDate <= in30).length,
      total: all.length,
    };
  });

  readonly rows = computed(() => {
    const status = this.status();
    const branch = this.branch();
    const availability = this.availability();
    const discountType = this.discountType();
    const [from, to] = this.window();
    const search = this.search().trim().toLowerCase();

    const filtered = this.offers.filter((o) => {
      if (status && o.status !== status) return false;
      if (branch && o.branch !== branch) return false;
      if (availability && o.availability !== availability) return false;
      if (discountType && o.discountType !== discountType) return false;
      if (from && o.startDate < from) return false;
      if (to && o.startDate > to) return false;
      if (search && !o.title.toLowerCase().includes(search)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (this.sort()) {
        case 'oldest': return a.startDate.getTime() - b.startDate.getTime();
        case 'title': return a.title.localeCompare(b.title);
        default: return b.startDate.getTime() - a.startDate.getTime();
      }
    });
  });

  statusClass(status: OfferStatus): string {
    return `offers__status offers__status--${status.toLowerCase()}`;
  }

  availabilityLabel(availability: Availability): string {
    return availability === 'Hybrid' ? 'In-Store & Online' : availability;
  }

  availabilityIcon(availability: Availability): string {
    switch (availability) {
      case 'Online': return 'pi pi-globe';
      case 'In-Store': return 'pi pi-building';
      default: return 'pi pi-shopping-cart';
    }
  }

  private buildRows(): Offer[] {
    const seed: Omit<Offer, 'id' | 'startDate' | 'expirationDate'>[] = [
      { title: 'Summer Sale 2026', discount: '50% Off', discountType: 'Percentage', availability: 'Online', branch: 'Main Branch', status: 'Active' },
      { title: 'Black Friday Deal', discount: '$25 Fixed', discountType: 'Fixed Amount', availability: 'In-Store', branch: 'Downtown', status: 'Scheduled' },
      { title: 'Weekend Special', discount: '30% Off', discountType: 'Percentage', availability: 'Hybrid', branch: 'Mall', status: 'Active' },
      { title: 'Student Discount', discount: '15% Off', discountType: 'Percentage', availability: 'In-Store', branch: 'Downtown', status: 'Active' },
      { title: 'Holiday Bundle', discount: '$100 Tiered', discountType: 'Fixed Amount', availability: 'Online', branch: 'Mall', status: 'Scheduled' },
    ];
    return seed.map((o, i) => {
      const start = new Date(2026, i, 10 + i);
      const expiration = new Date(start);
      expiration.setMonth(expiration.getMonth() + 1);
      return { ...o, id: String(i + 1), startDate: start, expirationDate: expiration };
    });
  }
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
