import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import { OfferInsightRow, VendorAnalyticsService } from '../../services/analytics.service';
import { MOCK_VENDOR_PROFILE } from '../../../Profile/data/mock-vendor-profile';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { ThemeService } from '../../../../shared/services/theme.service';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, ChartModule, TranslatePipe],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage implements OnInit {
  locations: any[] = [];
  offers: any[] = [];
  requests: any[] = [];
  activeOffers = 0;

  sortField: 'type' | 'clicks' | 'views' | null = null;
  sortDirection: 1 | -1 = 1;
  readonly redemptionsByLocation = [
    { labelKey: 'analytics.location.riyadh', value: 42 },
    { labelKey: 'analytics.location.jeddah', value: 28 },
    { labelKey: 'analytics.location.dammam', value: 18 },
    { labelKey: 'analytics.location.other', value: 12 },
  ];

  // ===========================================================================
  // ARTIFICIAL LOADING — DELETE WHEN THE API IS WIRED
  // ---------------------------------------------------------------------------
  // This page reads mostly synchronous mock data (MOCK_VENDOR_PROFILE), so there
  // is no real load to wait for. This timer fakes one so the table/chart
  // skeletons are reachable and the KPI count-up has a beat to animate from 0.
  // When the real fetches land: delete the timer, flip `loading` to false in the
  // data subscribe, and call startCountUp() from there instead.
  // ===========================================================================
  readonly loading = signal(true);
  private static readonly FAKE_LOAD_MS = 800; // DELETE WITH THE TIMER BELOW

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

    return {
      labels: this.redemptionsByLocation.map((location) => this.i18n.t(location.labelKey)),
      datasets: [{
        label: this.i18n.t('analytics.location.totalRedemptions'),
        data: this.redemptionsByLocation.map((location) => location.value),
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

    // DELETE WHEN THE API IS WIRED — see the ARTIFICIAL LOADING block above.
    setTimeout(() => {
      this.loading.set(false);
      this.startCountUp();
    }, AnalyticsPage.FAKE_LOAD_MS);
  }

  // ---- Count-up KPI stats (number_animation.md) ----------------------------
  // Cards render at 0 and ease to their value once the fake load resolves — the
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
    return 0;
  }

  /* ─── Overview ─── */

  get locationCount(): number {
    return this.analytics.locationCount(this.locations);
  }

  get activeOfferCount(): number {
    if (!Array.isArray(this.offers) || this.offers.length === 0) return this.activeOffers || 0;
    return this.offers.filter((offer) =>
      offer?.isActive === true ||
      (offer?.isActive == null && String(offer?.status ?? '').toLowerCase() === 'active')
    ).length;
  }

  get totalOfferCount(): number {
    return Array.isArray(this.offers) ? this.offers.length : 0;
  }

  get inactiveOfferCount(): number {
    return this.offers.filter((offer) =>
      offer?.isActive === false || ['inactive', 'rejected'].includes(this.statusOf(offer))
    ).length;
  }

  get draftOfferCount(): number {
    return this.offers.filter((offer) => this.statusOf(offer) === 'draft').length;
  }

  get pendingRequestCount(): number {
    return this.requests.filter((request) =>
      !['completed', 'approved', 'rejected', 'closed'].includes(this.statusOf(request))
    ).length;
  }

  private statusOf(item: any): string {
    return String(item?.status ?? '').trim().toLowerCase();
  }

  get totalUniqueOfferClicks(): number {
    return 0;
  }

  /* ─── Offer Insights ─── */

  get offerInsightRows(): OfferInsightRow[] {
    const list = Array.isArray(this.offers) ? this.offers : [];
    const maxRows = list.length ? Math.min(list.length, 500) : 1;
    return this.analytics.offerInsightRows(list, this.sortField, this.sortDirection, maxRows);
  }

  get topOffers(): OfferInsightRow[] {
    return [...this.offerInsightRows]
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks)
      .slice(0, 3);
  }

  topOfferLabel(index: number): string {
    return `analytics.topOffers.rank${Math.min(index + 1, 3)}`;
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

  sortOffers(field: 'type' | 'clicks' | 'views') {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 1 ? -1 : 1;
      return;
    }
    this.sortField = field;
    this.sortDirection = 1;
  }

  getSortIcon(field: 'type' | 'clicks' | 'views'): string {
    return this.analytics.getSortIcon(field, this.sortField, this.sortDirection);
  }

  viewOfferDetails(offer: OfferInsightRow) {
    const id = offer?.id;
    if (!id) return;
    this.router.navigate(['/offers', id]);
  }

  /* ─── Location Insights ─── */

}
