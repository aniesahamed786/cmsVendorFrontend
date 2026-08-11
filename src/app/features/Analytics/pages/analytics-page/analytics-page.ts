import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
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
import { MOCK_VENDOR_PROFILE } from '../../../Profile/data/mock-vendor-profile';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { ThemeService } from '../../../../shared/services/theme.service';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, ChartModule, TableModule, TranslatePipe],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage implements OnInit {
  locations: any[] = [];
  offers: any[] = [];
  requests: any[] = [];
  activeOffers = 0;
  readonly overview = signal<AnalyticsOverview | null>(null);
  readonly offersSummary = signal<AnalyticsOffersSummary | null>(null);
  readonly redemptionsByLocation = signal<AnalyticsRedemptionsByLocation[]>([]);
  readonly redemptionsByDay = signal<AnalyticsRedemptionsByDay[]>([]);
  readonly dayLoading = signal(false);
  readonly redemptionChartMode = signal<'location' | 'day'>('location');

  readonly loading = signal(true);

  // Count-up KPI values (number_animation.md), keyed by stat id.
  private readonly animated = signal<Record<string, number>>({});

  private readonly analytics = inject(VendorAnalyticsService);
  private readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

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
        : { duration: 450 },
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
    this.locations = MOCK_VENDOR_PROFILE.locations || [];
    this.offers = MOCK_VENDOR_PROFILE.offers || [];
    this.requests = MOCK_VENDOR_PROFILE.requests || [];
    this.activeOffers = this.offers.filter(o => o.status === 'Active').length;

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

  // ---- Count-up KPI stats (number_animation.md) ----------------------------
  // Cards render at 0 and ease to their value once the overview load resolves — the
  // sanctioned loading affordance for plain stat cards. The data-shaped cards
  // below skeleton instead; never both on one card.

  /** Animated, formatted value for a KPI key (0 until startCountUp fires). */
  animatedCount(key: string): string {
    return (this.animated()[key] ?? 0).toLocaleString(this.i18n.numberLocale);
  }

  private startCountUp(): void {
    this.animateTo('locations', this.locationCount);
    this.animateTo('activeOffers', this.activeOfferCount);
    this.animateTo('inactiveOffers', this.inactiveOfferCount);
    this.animateTo('draftOffers', this.draftOfferCount);
    this.animateTo('pendingRequests', this.pendingRequestCount);
    this.animateTo('totalOfferViews', this.totalOfferViewEvents);
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

  get totalOfferViewEvents(): number {
    return this.offersSummary()?.totalViews ?? 0;
  }

  /* ─── Overview ─── */

  get locationCount(): number {
    const count = this.offersSummary()?.totalLocations;
    if (count != null) return count;
    return this.analytics.locationCount(this.locations);
  }

  get activeOfferCount(): number {
    const count = this.overview()?.activeOffersCount;
    if (count != null) return count;
    if (!Array.isArray(this.offers) || this.offers.length === 0) return this.activeOffers || 0;
    return this.offers.filter((offer) =>
      offer?.isActive === true ||
      (offer?.isActive == null && String(offer?.status ?? '').toLowerCase() === 'active')
    ).length;
  }

  get totalOfferCount(): number {
    const count = this.offersSummary()?.totalOffers;
    if (count != null) return count;
    const overview = this.overview();
    if (overview) return overview.activeOffersCount + overview.inactiveOffersCount + overview.draftOffersCount;
    return Array.isArray(this.offers) ? this.offers.length : 0;
  }

  get inactiveOfferCount(): number {
    const count = this.overview()?.inactiveOffersCount;
    if (count != null) return count;
    return this.offers.filter((offer) =>
      offer?.isActive === false || ['inactive', 'rejected'].includes(this.statusOf(offer))
    ).length;
  }

  get draftOfferCount(): number {
    const count = this.overview()?.draftOffersCount;
    if (count != null) return count;
    return this.offers.filter((offer) => this.statusOf(offer) === 'draft').length;
  }

  get pendingRequestCount(): number {
    const count = this.overview()?.pendingRequestsCount;
    if (count != null) return count;
    return this.requests.filter((request) =>
      !['completed', 'approved', 'rejected', 'closed'].includes(this.statusOf(request))
    ).length;
  }

  private statusOf(item: any): string {
    return String(item?.status ?? '').trim().toLowerCase();
  }

  get redemptionTotal(): number {
    const count = this.offersSummary()?.totalRedemptions;
    if (count != null) return count;
    return this.redemptionsByLocation().reduce((total, location) => total + location.redemptionsCount, 0);
  }

  /* ─── Offer Insights ─── */

  get offerInsightRows(): OfferInsightRow[] {
    const list = Array.isArray(this.offers) ? this.offers : [];
    const maxRows = list.length ? Math.min(list.length, 500) : 1;
    return this.analytics.offerInsightRows(list, null, 1, maxRows);
  }

  get insightTableRows(): Array<OfferInsightRow | null> {
    return this.loading() ? [null, null, null] : this.offerInsightRows;
  }

  /** One card per metric: most favorited, most viewed, most shared. */
  get topOfferCards(): Array<{ offer: OfferInsightRow; icon: string; labelKey: string; metricKey: string; value: number }> {
    const overview = this.overview();
    if (overview) {
      return [
        this.topOfferCard(overview.mostFavouritedOffer, 'pi pi-heart', 'analytics.topOffers.mostFavorited', 'analytics.common.favorites'),
        this.topOfferCard(overview.mostViewedOffer, 'pi pi-eye', 'analytics.topOffers.mostViewed', 'analytics.common.views'),
        this.topOfferCard(overview.mostSharedOffer, 'pi pi-share-alt', 'analytics.topOffers.mostShared', 'analytics.common.shares'),
      ];
    }

    const rows = this.offerInsightRows;
    const metrics = [
      { metric: 'favorites', icon: 'pi pi-heart', labelKey: 'analytics.topOffers.mostFavorited', metricKey: 'analytics.common.favorites' },
      { metric: 'views', icon: 'pi pi-eye', labelKey: 'analytics.topOffers.mostViewed', metricKey: 'analytics.common.views' },
      { metric: 'shares', icon: 'pi pi-share-alt', labelKey: 'analytics.topOffers.mostShared', metricKey: 'analytics.common.shares' },
    ] as const;

    return metrics.map(({ metric, ...rest }) => {
      const offer = [...rows].sort((a, b) => b[metric] - a[metric])[0];
      return { offer, value: offer[metric], ...rest };
    });
  }

  private topOfferCard(
    topOffer: AnalyticsTopOffer,
    icon: string,
    labelKey: string,
    metricKey: string,
  ): { offer: OfferInsightRow; icon: string; labelKey: string; metricKey: string; value: number } {
    return {
      offer: {
        id: topOffer.offerId,
        title: (this.i18n.lang() === 'ar' ? topOffer.offerTitleAr : topOffer.offerTitle) || '-',
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
      value: topOffer.count,
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

  /* ─── Location Insights ─── */

}
