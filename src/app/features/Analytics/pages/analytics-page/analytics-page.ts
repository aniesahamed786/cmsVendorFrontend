import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  AnalyticsOffersSummary,
  AnalyticsOverview,
  AnalyticsRedemptionsByDay,
  AnalyticsRedemptionsByLocation,
  AnalyticsTopOffer,
  OfferInsightRow,
  VendorAnalyticsService,
} from '../../services/analytics.service';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { ThemeService } from '../../../../shared/services/theme.service';
import { createCountUp } from '../../../../shared/animation/count-up';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, ChartModule, TableModule, TranslatePipe, AppSearch],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage implements OnInit {
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly offersSummary = signal<AnalyticsOffersSummary | null>(null);
  readonly redemptionsByLocation = signal<AnalyticsRedemptionsByLocation[]>([]);
  readonly redemptionsByDay = signal<AnalyticsRedemptionsByDay[]>([]);
  readonly dayLoading = signal(false);
  readonly insightRows = signal<OfferInsightRow[]>([]);
  readonly insightTotal = signal(0);
  readonly insightLoading = signal(false);
  readonly redemptionChartMode = signal<'location' | 'day'>('location');

  readonly loading = signal(true);

  private readonly analytics = inject(VendorAnalyticsService);
  private readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

  // Count-up KPI values (shared/animation/count-up.ts), keyed by stat id.
  // Declared after `i18n` — field initializers run in order.
  private readonly countUp = createCountUp(this.i18n.numberLocale);
  readonly animatedCount = this.countUp.animatedCount;
  private readonly animateTo = this.countUp.animateTo;

  readonly redemptionChartData = computed<ChartData<'bar'>>(() => {
    this.i18n.loadSeq();
    const dark = this.theme.isDarkMode();
    const accent = this.theme.accentTheme();
    const palette = dark ? accent.darkPalette : accent.palette;
    const dayFormatter = new Intl.DateTimeFormat(this.i18n.locale(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const rows = this.redemptionChartMode() === 'day'
      ? this.redemptionsByDay().map((row) => ({
          label: dayFormatter.format(new Date(`${row.day}T00:00:00Z`)),
          value: row.redemptionsCount,
        }))
      : this.redemptionsByLocation().map((row) => ({
          label: (this.i18n.lang() === 'ar' ? row.branchName_ar || row.city_ar : row.branchName || row.city) || '-',
          value: row.redemptionsCount,
        }));

    return {
      labels: rows.map((row) => row.label),
      datasets: [{
        label: this.i18n.t('analytics.location.totalRedemptions'),
        data: rows.map((row) => row.value),
        backgroundColor: palette[600],
        hoverBackgroundColor: palette[500],
        borderRadius: 2,
        maxBarThickness: 56,
        categoryPercentage: 0.65,
        barPercentage: 0.75,
      }],
    };
  });

  readonly redemptionChartOptions = computed<ChartOptions<'bar'>>(() => {
    const dark = this.theme.isDarkMode();
    const accent = this.theme.accentTheme();
    const surfaces = dark ? accent.darkBackground : accent.background;
    this.i18n.loadSeq();

    return {
      responsive: true,
      maintainAspectRatio: false,
      locale: this.i18n.numberLocale,
      animation: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? false
        : {
            duration: 1000,
            easing: 'easeOutQuart',
          },
      animations: {
        y: {
          duration: 1000,
          easing: 'easeOutCubic',
        },
      },
      layout: { padding: { top: 10 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: this.i18n.isRtl(),
          backgroundColor: surfaces.surface,
          titleColor: surfaces.text,
          bodyColor: surfaces.text,
          borderColor: surfaces.border,
          borderWidth: 1,
          displayColors: false,
        },
      },
      scales: {
        x: {
          reverse: this.i18n.isRtl(),
          border: { display: false },
          grid: { display: false },
          ticks: { color: surfaces.muted, font: { family: 'var(--font-family)', size: 13 } },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: surfaces.border },
          ticks: { color: surfaces.muted, precision: 0 },
        },
      },
    };
  });

  constructor(private router: Router) {}

  ngOnInit(): void {
    forkJoin({
      overview: this.analytics.getOverview().pipe(catchError((error) => {
        console.error('Failed to load analytics overview', error);
        return of(null);
      })),
      offersSummary: this.analytics.getOffersSummary().pipe(catchError((error) => {
        console.error('Failed to load analytics offers summary', error);
        return of(null);
      })),
      redemptionsByLocation: this.analytics.getRedemptionsByLocation().pipe(catchError((error) => {
        console.error('Failed to load redemptions by location', error);
        return of([]);
      })),
    })
      .pipe(finalize(() => {
        this.loading.set(false);
        this.startCountUp();
      }))
      .subscribe(({ overview, offersSummary, redemptionsByLocation }) => {
        this.overview.set(overview);
        this.offersSummary.set(offersSummary);
        this.redemptionsByLocation.set(redemptionsByLocation);
      });
  }

  showRedemptionsByDay(): void {
    this.redemptionChartMode.set('day');
    if (this.dayLoading()) return;

    this.dayLoading.set(true);
    this.analytics.getRedemptionsByDays()
      .pipe(finalize(() => this.dayLoading.set(false)))
      .subscribe({
        next: (rows) => this.redemptionsByDay.set(rows),
        error: (error) => console.error('Failed to load redemptions by day', error),
      });
  }

  // ---- Count-up KPI stats (shared/animation/count-up.ts) -------------------
  // Cards render at 0 and ease to their value once the overview load resolves — the
  // sanctioned loading affordance for plain stat cards. The data-shaped cards
  // below skeleton instead; never both on one card.

  private startCountUp(): void {
    const ov = this.overview();
    const sum = this.offersSummary();

    this.animateTo('activeOffers', ov?.activeOffersCount ?? 0);
    this.animateTo('inactiveOffers', ov?.inactiveOffersCount ?? 0);
    this.animateTo('draftOffers', ov?.draftOffersCount ?? 0);
    this.animateTo('pendingRequests', ov?.pendingRequestsCount ?? 0);

    const totalOffers = sum?.totalOffers ?? (ov ? (ov.activeOffersCount + ov.inactiveOffersCount + ov.draftOffersCount) : 0);
    this.animateTo('totalOffers', totalOffers);
    this.animateTo('totalOfferViews', sum?.totalViews ?? 0);
    this.animateTo('totalRedemptions', this.redemptionTotal);
    this.animateTo('locations', this.locationCount);

    this.animateTo('top_favorites', ov?.mostFavouritedOffer?.count ?? 0);
    this.animateTo('top_views', ov?.mostViewedOffer?.count ?? 0);
    this.animateTo('top_shares', ov?.mostSharedOffer?.count ?? 0);
  }

  get totalOfferViewEvents(): number {
    return this.offersSummary()?.totalViews ?? 0;
  }

  /* ─── Overview ─── */

  get locationCount(): number {
    return this.offersSummary()?.totalLocations ?? 0;
  }

  get activeOfferCount(): number {
    return this.overview()?.activeOffersCount ?? 0;
  }

  get totalOfferCount(): number {
    const sum = this.offersSummary();
    if (sum?.totalOffers != null) return sum.totalOffers;
    const overview = this.overview();
    if (overview) return overview.activeOffersCount + overview.inactiveOffersCount + overview.draftOffersCount;
    return 0;
  }

  get inactiveOfferCount(): number {
    return this.overview()?.inactiveOffersCount ?? 0;
  }

  get draftOfferCount(): number {
    return this.overview()?.draftOffersCount ?? 0;
  }

  get pendingRequestCount(): number {
    return this.overview()?.pendingRequestsCount ?? 0;
  }

  get redemptionTotal(): number {
    const count = this.offersSummary()?.totalRedemptions;
    if (count != null) return count;
    return this.redemptionsByLocation().reduce((total, location) => total + location.redemptionsCount, 0);
  }

  /* ─── Offer Insights ─── */

  /** Server-paginated offer insights; p-table fires this on init and on every page/sort change. */
  loadOfferInsights(event: TableLazyLoadEvent): void {
    const rows = event.rows || 10;
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    const sortBy = typeof event.sortField === 'string' ? event.sortField : undefined;
    // p-table's global filter carries the search box value and already resets to page 1.
    const search = typeof event.globalFilter === 'string' ? event.globalFilter : undefined;

    this.insightLoading.set(true);
    this.insightRows.set([]); // skeleton rows only — don't leave the previous page on screen
    this.analytics.getOfferInsights(page, rows, sortBy, event.sortOrder === -1 ? 'desc' : 'asc', search)
      .pipe(finalize(() => this.insightLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.insightRows.set((response.data ?? []).map((row) => this.analytics.toOfferInsightRow(row)));
          this.insightTotal.set(response.total ?? 0);
        },
        error: (error) => console.error('Failed to load offer insights', error),
      });
  }

  /** One card per metric: most favorited, most viewed, most shared. */
  get topOfferCards(): Array<{
    offer: OfferInsightRow;
    icon: string;
    labelKey: string;
    metricKey: string;
    metricId: string;
    value: number;
  }> {
    const overview = this.overview();
    return [
      this.topOfferCard(overview?.mostFavouritedOffer, 'pi pi-heart', 'analytics.topOffers.mostFavorited', 'analytics.common.favorites', 'top_favorites'),
      this.topOfferCard(overview?.mostViewedOffer, 'pi pi-eye', 'analytics.topOffers.mostViewed', 'analytics.common.views', 'top_views'),
      this.topOfferCard(overview?.mostSharedOffer, 'pi pi-share-alt', 'analytics.topOffers.mostShared', 'analytics.common.shares', 'top_shares'),
    ];
  }

  private topOfferCard(
    topOffer: AnalyticsTopOffer | null | undefined,
    icon: string,
    labelKey: string,
    metricKey: string,
    metricId: string,
  ): {
    offer: OfferInsightRow;
    icon: string;
    labelKey: string;
    metricKey: string;
    metricId: string;
    value: number;
  } {
    return {
      offer: {
        id: topOffer?.offerId ?? '',
        title: (this.i18n.lang() === 'ar' ? topOffer?.offerTitleAr : topOffer?.offerTitle) || (topOffer?.offerId ? '-' : '—'),
        discount: '0',
        type: '-',
        shares: 0,
        redemptions: 0,
        views: 0,
        favorites: 0,
      },
      icon,
      labelKey,
      metricKey,
      metricId,
      value: topOffer?.count ?? 0,
    };
  }

  offerTypeLabel(type: string): string {
    const key = type === 'Digital'
      ? 'digital'
      : type === 'In-Store'
        ? 'inStore'
        : type === 'In-Store & Digital'
          ? 'both'
          : null;
    return key ? this.i18n.t(`analytics.offerTypes.${key}`) : type;
  }

  viewOfferDetails(offer: OfferInsightRow) {
    const id = offer?.id;
    if (!id) return;
    this.router.navigate(['/offers', id]);
  }
}
