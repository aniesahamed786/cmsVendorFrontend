import { Component, Signal, computed, signal } from '@angular/core';
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
import { Button } from '../../../../shared/Components/button/button';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules, Button, AppSearch, TranslatePipe],
  templateUrl: './offers.html',
  styleUrl: './offers.scss',
})
export class Offers {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  // ponytail: in-memory dummy data; swap for a service feed when the API exists
  private readonly offers: Offer[] = this.buildRows();

  // ===========================================================================
  // ARTIFICIAL LOADING — DELETE WHEN THE API IS WIRED
  // ---------------------------------------------------------------------------
  // `offers` above is a synchronous in-memory array, so there is no real load to
  // wait for. This timer fakes one purely so the skeleton state is reachable and
  // reviewable. When the real service lands:
  //   1. delete the `setTimeout` in the constructor below;
  //   2. flip `loading` to false in the service's `subscribe`, exactly as
  //      `branches-page.ts` does;
  //   3. delete this comment block.
  // Keep `loading`, `tableRows` and the skeleton markup — only the fake timer
  // and the initial `true` sourcing are throwaway.
  // ===========================================================================
  readonly loading = signal(true);
  private static readonly FAKE_LOAD_MS = 800; // DELETE WITH THE TIMER ABOVE

  constructor() {
    // DELETE WHEN THE API IS WIRED — see the block above. Keep the revealStats()
    // call; move it into the service's subscribe alongside `loading.set(false)`.
    setTimeout(() => {
      this.loading.set(false);
      this.revealStats();
    }, Offers.FAKE_LOAD_MS);
  }

  // ---- Count-up stats (number_animation.md) --------------------------------
  // One signal holds every animated value, keyed by stat name; one rAF loop per
  // key eases to the target. The cards skeleton while the data is absent, then
  // count up once it lands — the skeleton covers the fetch, the count-up covers
  // the arrival. They never run at the same time.
  private readonly animated = signal<Record<string, number>>({});

  /** Animated, formatted value for a stat key (starts at 0, animates to target). */
  animatedCount(key: string): string {
    return (this.animated()[key] ?? 0).toLocaleString('en-US');
  }

  /** Kick off every stat's count-up. Call this when the data lands. */
  private revealStats(): void {
    const s = this.stats();
    this.animateTo('active', s.active);
    this.animateTo('scheduled', s.scheduled);
    this.animateTo('expiringSoon', s.expiringSoon);
    this.animateTo('total', s.total);
  }

  /** easeOutCubic count-up from the current value to target. */
  private animateTo(key: string, target: number, duration = 900): void {
    // Accessibility: honour reduced motion by landing on the value directly.
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

  // p-select takes plain label strings, so these rebuild through t() instead of
  // the pipe. Values stay the English literals — they are the filter keys.
  private options<T>(entries: [key: string, value: T][]): Signal<{ label: string; value: T }[]> {
    return computed(() => {
      this.i18n.loadSeq();
      return entries.map(([key, value]) => ({ label: this.i18n.t(key), value }));
    });
  }

  readonly statusOptions = this.options<OfferStatus | null>([
    ['offers.filter.allStatuses', null],
    ['offers.value.active', 'Active'],
    ['offers.value.scheduled', 'Scheduled'],
    ['offers.value.expired', 'Expired'],
  ]);

  readonly discountTypeOptions = this.options<'Percentage' | 'Fixed Amount' | null>([
    ['offers.filter.allTypes', null],
    ['offers.value.percentage', 'Percentage'],
    ['offers.value.fixedAmount', 'Fixed Amount'],
  ]);

  readonly availabilityOptions = this.options<Availability | null>([
    ['offers.filter.allAvailability', null],
    ['offers.value.online', 'Online'],
    ['offers.value.inStore', 'In-Store'],
    ['offers.value.hybrid', 'Hybrid'],
  ]);

  readonly periodOptions = this.options<string>([
    ['offers.period.all', 'all'],
    ['offers.period.last7', '7'],
    ['offers.period.last30', '30'],
    ['offers.period.last90', '90'],
    ['offers.period.year', 'year'],
    ['offers.period.custom', 'custom'],
  ]);

  readonly status = signal<OfferStatus | null>(null);
  readonly branch = signal<string | null>(null);
  readonly availability = signal<Availability | null>(null);
  readonly discountType = signal<'Percentage' | 'Fixed Amount' | null>(null);
  readonly period = signal<string>('all');
  readonly customRange = signal<Date[] | null>(null);
  readonly sort = signal<string>('newest');
  readonly search = signal<string>('');

  activeOffer: Offer | null = null;

  readonly rowActions = computed(() => {
    this.i18n.loadSeq();
    return [
      { label: this.i18n.t('offers.action.viewOffer'), icon: 'pi pi-eye', command: () => { if (this.activeOffer) this.router.navigate([this.activeOffer.id], { relativeTo: this.route }); } },
      { label: this.i18n.t('offers.action.requestChanges'), icon: 'pi pi-arrows-v', command: () => { if (this.activeOffer) this.router.navigate(['edit', this.activeOffer.id], { relativeTo: this.route }); } },
      { label: this.i18n.t('offers.action.requestRenew'), icon: 'pi pi-refresh' },
      { label: this.i18n.t('offers.action.createTicket'), icon: 'pi pi-comment' },
      { label: this.i18n.t('offers.action.deactivate'), icon: 'pi pi-file-excel', styleClass: 'p-menuitem-danger' },
    ];
  });

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

  // While loading, feed the table 5 falsy rows. PrimeNG's TableBody renders
  // `rowData ? bodyTemplate : loadingBodyTemplate` per row, so each null draws
  // the loadingbody skeleton row while the header and table chrome stay real.
  readonly tableRows = computed(() =>
    this.loading() ? new Array(5).fill(null) : this.rows()
  );

  statusClass(status: OfferStatus): string {
    return `offers__status offers__status--${status.toLowerCase()}`;
  }

  /**
   * Table cells hold the English enum value. This maps it to a key so the pipe
   * translates it; an unmapped value falls through and renders as-is.
   */
  valueKey(value: string): string {
    return VALUE_KEYS[value] ?? value;
  }

  availabilityKey(availability: Availability): string {
    return availability === 'Hybrid' ? 'offers.value.hybridLong' : this.valueKey(availability);
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

const VALUE_KEYS: Record<string, string> = {
  Percentage: 'offers.value.percentage',
  'Fixed Amount': 'offers.value.fixedAmount',
  Online: 'offers.value.online',
  'In-Store': 'offers.value.inStore',
  Hybrid: 'offers.value.hybrid',
  Active: 'offers.value.active',
  Scheduled: 'offers.value.scheduled',
  Expired: 'offers.value.expired',
};

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
