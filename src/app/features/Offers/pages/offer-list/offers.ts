import { Component, Signal, computed, signal } from '@angular/core';
import { openRowMenu } from '../../../../shared/utils/row-menu';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TableLazyLoadEvent } from 'primeng/table';
import { OnInit } from '@angular/core';

type Availability = 'Digital' | 'In-Store' | 'Hybrid';
type OfferStatus = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

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
  offerLogo: string;
}

import { Router, ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
import { Button } from '../../../../shared/Components/button/button';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';
import { AppBottomSheet } from '../../../../shared/Components/app-bottom-sheet/app-bottom-sheet';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { OfferListService } from '../../services/offer-list.service';
import { OfferApi } from '../../models/offerList';
import { environment } from '../../../../../environments/environment';
import { createCountUp } from '../../../../shared/animation/count-up';

import { OffersService, OfferStats } from '../../services/offers.service';
import { finalize } from 'rxjs';
import { MenuItem, MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/** Renew pop-up choices: a month count added to the base date, or 'custom' for the date picker. */
type RenewPeriod = 12 | 6 | 3 | 'custom';

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules, Button, AppSearch, AppBottomSheet, TranslatePipe, OfferTile, ConfirmationPopUp],
  templateUrl: './offers.html',
  styleUrl: './offers.scss',
})
export class Offers implements OnInit {
  readonly auth = inject(AuthService);
  /** Closes any other row's menu first — see shared/utils/row-menu.ts. */
  readonly openRowMenu = openRowMenu;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly offersService = inject(OffersService);
  private readonly offerListService = inject(OfferListService);
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly messageService = inject(MessageService);

  readonly showMobileFilters = signal(false);

  readonly offerStats = signal<OfferStats>({
    totalOffers: 0,
    activeOffers: 0,
    scheduledOffers: 0,
    expiringSoonOffers: 0,
  });
  readonly statsLoading = signal(true);
  private readonly offers = signal<Offer[]>([]);
  readonly backendUrl = environment.backendUrl;

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(10);
  readonly first = signal(0);
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // ponytail: no initial loadOffers() — p-table [lazy] fires onLazyLoad on init.
    this.loadOfferStats();
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    this.pageSize.set(rows);
    this.first.set(event.first ?? 0);

    // PrimeNG field names are mapped to API sort fields in loadOffers().
    this.sortField.set((event.sortField as keyof Offer) ?? null);
    this.sortOrder.set(event.sortOrder === -1 ? -1 : 1);

    this.loadOffers(Math.floor((event.first ?? 0) / rows) + 1);
  }

  private loadOfferStats(): void {
    this.statsLoading.set(true);
    this.offersService
      .getOfferStats()
      .pipe(finalize(() => this.statsLoading.set(false)))
      .subscribe({
        next: (stats) => {
          this.offerStats.set(stats);
          this.revealStats();
        },
        error: (err) => {
          console.error('Failed to load offer stats', err);
        }
      });
  }
  // ---- Count-up stats (shared/animation/count-up.ts) ------------------------
  // The cards skeleton while the data is absent, then count up once it lands —
  // the skeleton covers the fetch, the count-up covers the arrival. They never
  // run at the same time.
  private readonly countUp = createCountUp();
  readonly animatedCount = this.countUp.animatedCount;
  private readonly animateTo = this.countUp.animateTo;

  /** Kick off every stat's count-up. Call this when the data lands. */
  private revealStats(): void {
    const s = this.offerStats();

    this.animateTo('active', s.activeOffers ?? 0);
    this.animateTo('scheduled', s.scheduledOffers ?? 0);
    this.animateTo('expiringSoon', s.expiringSoonOffers ?? 0);
    this.animateTo('total', s.totalOffers ?? 0);
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
    ['offers.value.inactive', 'Inactive'],
  ]);

  readonly discountTypeOptions = this.options<'Percentage' | 'Fixed Amount' | null>([
    ['offers.filter.allTypes', null],
    ['offers.value.percentage', 'Percentage'],
    ['offers.value.fixedAmount', 'Fixed Amount'],
  ]);

  readonly availabilityOptions = this.options<Availability | null>([
    ['offers.filter.allAvailability', null],
    ['offers.value.digital', 'Digital'],
    ['offers.value.inStore', 'In-Store'],
    ['offers.value.hybrid', 'Hybrid'],
  ]);

  readonly status = signal<OfferStatus | null>(null);
  readonly branch = signal<string | null>(null);
  readonly availability = signal<Availability | null>(null);
  readonly discountType = signal<'Percentage' | 'Fixed Amount' | null>(null);
  readonly sortField = signal<keyof Offer | null>(null);
  readonly sortOrder = signal<1 | -1>(1);
  readonly search = signal<string>('');

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.status()) count++;
    if (this.availability()) count++;
    if (this.discountType()) count++;
    return count;
  });

  readonly activeFilterChips = computed(() => {
    this.i18n.loadSeq();
    const chips: { key: string; label: string }[] = [];

    if (this.discountType()) {
      chips.push({
        key: 'discountType',
        label: `${this.i18n.t('offers.filter.discountType')}: ${this.discountType()}`
      });
    }

    if (this.status()) {
      chips.push({
        key: 'status',
        label: `${this.i18n.t('offers.filter.status')}: ${this.status()}`
      });
    }

    if (this.availability()) {
      chips.push({
        key: 'availability',
        label: `${this.i18n.t('offers.filter.availability')}: ${this.availability()}`
      });
    }

    return chips;
  });

  removeFilterChip(chip: { key: string; label: string }): void {
    if (chip.key === 'discountType') {
      this.discountType.set(null);
    } else if (chip.key === 'status') {
      this.status.set(null);
    } else if (chip.key === 'availability') {
      this.availability.set(null);
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.status.set(null);
    this.availability.set(null);
    this.discountType.set(null);
    this.applyFilters();
  }

  applyFilters(): void {
    this.first.set(0);
    this.loadOffers(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 300);
  }

  activeOffer: Offer | null = null;

  readonly rowActions = computed(() => {
    this.i18n.loadSeq();
    const items: MenuItem[] = [
      { label: this.i18n.t('offers.action.viewOffer'), icon: 'pi pi-eye', command: () => { if (this.activeOffer) this.router.navigate([this.activeOffer.id], { relativeTo: this.route }); } },
    ];
    // A read-only user gets the view row only — no edit, renew or deactivate.
    if (this.auth.canManage('offers')) {
      items.push(
        { label: this.i18n.t('offers.action.requestChanges'), icon: 'pi pi-pencil', command: () => { if (this.activeOffer) this.router.navigate(['edit', this.activeOffer.id], { relativeTo: this.route }); } },
        { label: this.i18n.t('offers.action.requestRenew'), icon: 'pi pi-sync', command: () => { if (this.activeOffer) this.openRenew(this.activeOffer); } },
        { label: this.i18n.t('offers.action.deactivate'), icon: 'pi pi-ban', styleClass: 'p-menuitem-danger' },
      );
    }
    return items;
  });

  // ---- Renew request --------------------------------------------------------
  // Renewing only moves the expiry date, so it raises the same OFFER/UPDATE request the edit
  // page does, with `expiryDate` as the whole diff.
  readonly renewTarget = signal<Offer | null>(null);
  readonly renewPeriod = signal<RenewPeriod>(12);
  readonly renewCustomDate = signal<Date | null>(null);
  readonly renewSaving = signal(false);
  readonly renewPeriods: { value: RenewPeriod; key: string }[] = [
    { value: 12, key: 'offers.renew.oneYear' },
    { value: 6, key: 'offers.renew.sixMonths' },
    { value: 3, key: 'offers.renew.threeMonths' },
    { value: 'custom', key: 'offers.renew.custom' },
  ];

  /** Extend from the current expiry, or from today when the offer has already expired. */
  readonly renewBase = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = this.renewTarget()?.expirationDate;
    return expiry && expiry > today ? expiry : today;
  });

  /** Earliest pickable custom date: the day after the base. */
  readonly renewMinDate = computed(() => {
    const d = new Date(this.renewBase());
    d.setDate(d.getDate() + 1);
    return d;
  });

  readonly renewNewExpiry = computed<Date | null>(() => {
    const period = this.renewPeriod();
    return period === 'custom' ? this.renewCustomDate() : addMonths(this.renewBase(), period);
  });

  openRenew(offer: Offer): void {
    this.renewTarget.set(offer);
    this.renewPeriod.set(12);
    // Pre-filled so picking "Custom" never leaves the confirm button doing nothing.
    this.renewCustomDate.set(this.renewMinDate());
  }

  submitRenew(): void {
    const offer = this.renewTarget();
    const expiryDate = this.renewNewExpiry();
    if (!offer || !expiryDate || this.renewSaving()) return;

    this.renewSaving.set(true);
    this.requestApi
      .create({
        entityType: 'OFFER',
        entityId: offer.id,
        requestType: 'UPDATE',
        title: offer.title,
        requestData: { expiryDate },
        actionType: 'SUBMIT',
      })
      .pipe(finalize(() => this.renewSaving.set(false)))
      .subscribe({
        next: () => {
          this.renewTarget.set(null);
          this.messageService.add({
            severity: 'success',
            summary: this.i18n.t('offerForm.toast.requestSubmittedSummary'),
            detail: this.i18n.t('offerForm.toast.requestSubmittedDetail'),
            life: 3000,
          });
        },
        // 409 = a request for this offer is already open; the backend message names it.
        error: (err: HttpErrorResponse) => {
          const isConflict = err?.status === 409;
          this.messageService.add({
            severity: isConflict ? 'warn' : 'error',
            summary: this.i18n.t(isConflict ? 'offerForm.toast.requestConflictSummary' : 'offerForm.toast.requestFailedSummary'),
            detail: extractApiErrorMessage(err) ?? this.i18n.t(isConflict ? 'offerForm.toast.requestConflictDetail' : 'offerForm.toast.requestFailedDetail'),
            life: isConflict ? 10000 : 5000,
            closable: true,
          });
        },
      });
  }

  // While loading, feed the table 5 falsy rows. PrimeNG's TableBody renders
  // `rowData ? bodyTemplate : loadingBodyTemplate` per row, so each null draws
  // the loadingbody skeleton row while the header and table chrome stay real.
  readonly tableRows = computed(() =>
    this.loading() ? new Array(this.pageSize()).fill(null) : this.offers()
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

  availabilityIcons(availability: Availability): string[] {
    switch (availability) {
      case 'Digital':
        return ['assets/svg/Offers/offer-details/online.svg'];
      case 'In-Store':
        return ['assets/svg/Offers/offer-details/in-store.svg'];
      case 'Hybrid':
        return [
          'assets/svg/Offers/offer-details/in-store.svg',
          'assets/svg/Offers/offer-details/online.svg',
        ];
      default:
        return [];
    }
  }

  // private buildRows(): Offer[] {
  //   const seed: Omit<Offer, 'id' | 'startDate' | 'expirationDate'>[] = [
  //     { title: 'Summer Sale 2026', discount: '50% Off', discountType: 'Percentage', availability: 'Digital', branch: 'Main Branch', status: 'Active' },
  //     { title: 'Black Friday Deal', discount: '$25 Fixed', discountType: 'Fixed Amount', availability: 'In-Store', branch: 'Downtown', status: 'Scheduled' },
  //     { title: 'Weekend Special', discount: '30% Off', discountType: 'Percentage', availability: 'Hybrid', branch: 'Mall', status: 'Active' },
  //     { title: 'Student Discount', discount: '15% Off', discountType: 'Percentage', availability: 'In-Store', branch: 'Downtown', status: 'Active' },
  //     { title: 'Holiday Bundle', discount: '$100 Tiered', discountType: 'Fixed Amount', availability: 'Digital', branch: 'Mall', status: 'Scheduled' },
  //   ];
  //   return seed.map((o, i) => {
  //     const start = new Date(2026, i, 10 + i);
  //     const expiration = new Date(start);
  //     expiration.setMonth(expiration.getMonth() + 1);
  //     return { ...o, id: String(i + 1), startDate: start, expirationDate: expiration };
  //   });
  // }

  private loadOffers(page: number) {
    const sortField = this.sortField();
    const sortBy = sortField === 'expirationDate' ? 'expiryDate' : sortField;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.offerListService
      .getOffers({
        page,
        pageSize: this.pageSize(),
        search: this.search().trim() || undefined,
        discountType: this.discountType() === 'Percentage' ? 'percentage' : this.discountType() ? 'fixed' : undefined,
        status: this.status() ?? undefined,
        availability: this.availability() === 'Digital' ? 'digital' : this.availability() === 'In-Store' ? 'in-store' : this.availability() ? 'hybrid' : undefined,
        sortBy: sortBy === 'title' || sortBy === 'discount' || sortBy === 'startDate' || sortBy === 'expiryDate' ? sortBy : undefined,
        sortOrder: this.sortOrder() === -1 ? 'desc' : 'asc',
      })
      .subscribe({
        next: (res) => {
          this.offers.set(res.data.map(this.mapOffer));
          this.totalRecords.set(res.total || res.data.length);
          this.loading.set(false);
        },
        error: () => {
          this.offers.set([]);
          this.totalRecords.set(0);
          this.loadFailed.set(true);
          this.loading.set(false);
        }
      });
  }

  private mapOffer = (offer: OfferApi): Offer => {
    const av = (offer.availability || []).map((a) => a.toLowerCase());
    const hasDigital = av.includes('online') || av.includes('digital');
    const hasInStore = av.includes('in-store') || av.includes('instore');

    let availability: Availability = 'In-Store';
    if (hasDigital && hasInStore) {
      availability = 'Hybrid';
    } else if (hasDigital) {
      availability = 'Digital';
    }

    return {
      id: offer.offerId,
      title: offer.offerTitle,
      discount:
        offer.discountType === 'percentage'
          ? (offer.discount ? `${offer.discount}%` : '')
          : (offer.discount ?? ''),
      discountType:
        offer.discountType === 'percentage'
          ? 'Percentage'
          : 'Fixed Amount',
      availability,
      startDate: offer.startDate?.$date ? new Date(offer.startDate.$date) : new Date(),
      expirationDate: offer.endDate?.$date ? new Date(offer.endDate.$date) : new Date(),
      status: (offer.status || 'Active') as OfferStatus,
      branch: '',
      offerLogo: offer.offerLogo
    };
  };

  getImageUrl(path: string): string {
    if (!path) return '';
    return this.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
  }
}

/** Adds months, clamping to the month's last day (Aug 31 + 6 → Feb 28, not Mar 3). */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

const VALUE_KEYS: Record<string, string> = {
  Percentage: 'offers.value.percentage',
  'Fixed Amount': 'offers.value.fixedAmount',
  Digital: 'offers.value.digital',
  'In-Store': 'offers.value.inStore',
  Hybrid: 'offers.value.hybrid',
  Active: 'offers.value.active',
  Scheduled: 'offers.value.scheduled',
  Expired: 'offers.value.expired',
  Inactive: 'offers.value.inactive',
};

