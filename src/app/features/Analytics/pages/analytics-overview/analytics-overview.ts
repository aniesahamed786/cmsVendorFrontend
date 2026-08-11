import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { PrimeUIModules } from '../../../../core/prime.import';
import {
  DayRedemption,
  HighlightOffer,
  LocationRedemption,
  MOCK_HIGHLIGHT_OFFERS,
  MOCK_OFFERS_OVERVIEW_BY_PERIOD,
  MOCK_OFFER_STATUS_STATS,
  MOCK_REDEMPTIONS_BY_DAY,
  MOCK_REDEMPTION_BY_LOCATION,
  OVERVIEW_PERIOD_OPTIONS,
  OffersOverviewStats,
  OverviewPeriod,
  StatusStatCard,
} from '../../data/mock-analytics-overview';

/**
 * AnalyticsOverviewPage
 *
 * Standalone "at a glance" analytics dashboard — offer status counts, redemption by
 * location, top-performing offer highlights, a period-filterable offers overview, and
 * a redemptions-by-day breakdown. Everything reads from static mock data
 * (`data/mock-analytics-overview.ts`); there is no backend call yet. Swap the mock
 * imports for a service once `GET /analytics/overview` (or similar) exists — the
 * template only depends on the shapes exported from the mock file, so wiring a real
 * service is a drop-in change.
 */
@Component({
  selector: 'app-analytics-overview',
  standalone: true,
  imports: [CommonModule, PrimeUIModules],
  templateUrl: './analytics-overview.html',
  styleUrl: './analytics-overview.scss',
})
export class AnalyticsOverviewPage implements OnInit {
  // ===========================================================================
  // ARTIFICIAL LOADING — DELETE WHEN THE API IS WIRED
  // ---------------------------------------------------------------------------
  // All data on this page is static mock data, so there's nothing to actually wait
  // on. This timer fakes a load so the skeletons are reachable and the KPI count-up
  // has a beat to animate from 0 (see the style skill's number_animation.md /
  // SKELETON.md). Delete the timer + `loading` signal once a real fetch lands and
  // drive `loading` from that request instead.
  // ===========================================================================
  readonly loading = signal(true);
  private static readonly FAKE_LOAD_MS = 800;

  readonly statusStats: StatusStatCard[] = MOCK_OFFER_STATUS_STATS;
  readonly locationRedemption: LocationRedemption[] = MOCK_REDEMPTION_BY_LOCATION;
  readonly highlightOffers: HighlightOffer[] = MOCK_HIGHLIGHT_OFFERS;
  readonly dayRedemption: DayRedemption[] = MOCK_REDEMPTIONS_BY_DAY;
  readonly periodOptions = OVERVIEW_PERIOD_OPTIONS;

  readonly period = signal<OverviewPeriod>('7d');
  readonly overviewStats = computed<OffersOverviewStats>(() => MOCK_OFFERS_OVERVIEW_BY_PERIOD[this.period()]);

  // Count-up KPI values (see style skill / number_animation.md), keyed by stat id.
  private readonly animated = signal<Record<string, number>>({});

  ngOnInit(): void {
    // DELETE WHEN THE API IS WIRED — see the ARTIFICIAL LOADING block above.
    setTimeout(() => {
      this.loading.set(false);
      this.startCountUp();
    }, AnalyticsOverviewPage.FAKE_LOAD_MS);
  }

  /* ─── Period switching ─── */

  selectPeriod(value: OverviewPeriod): void {
    if (this.period() === value) return;
    this.period.set(value);
    if (!this.loading()) this.animateOverviewStats();
  }

  /* ─── Count-up KPI stats ─── */

  animatedCount(key: string): string {
    return Math.round(this.animatedValue(key)).toLocaleString('en-US');
  }

  /** Raw (unrounded, mid-animation) value for a KPI key — used where the caller needs
   *  to run its own formatting (e.g. `formatCompact` for Cost Savings). */
  animatedValue(key: string): number {
    return this.animated()[key] ?? 0;
  }

  private startCountUp(): void {
    for (const card of this.statusStats) this.animateTo(card.id, card.value);
    this.animateOverviewStats();
  }

  private animateOverviewStats(): void {
    const stats = this.overviewStats();
    this.animateTo('totalOffers', stats.totalOffers);
    this.animateTo('totalRedemption', stats.totalRedemption);
    this.animateTo('costSavings', stats.costSavings);
    this.animateTo('successRate', stats.successRate);
  }

  /** easeOutCubic count-up from the current value to target. */
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
      this.animated.update((m) => ({ ...m, [key]: from + (target - from) * eased }));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ─── Formatting ─── */

  /** Compact display for Cost Savings, e.g. 47500 -> "47.5k", 1875000 -> "1.9M". */
  formatCompact(value: number): string {
    const rounded = Math.round(value);
    if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (rounded >= 1_000) return `${(rounded / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return rounded.toLocaleString('en-US');
  }

  /** `base` is the element's own BEM class (e.g. `analytics-overview__highlight-trend`);
   *  returns `${base}--up` / `${base}--down` to combine with the static class already on
   *  the element via `[class]` (Angular merges a `[class]` binding with a static `class`
   *  attribute rather than replacing it). */
  trendClass(value: number, base: string): string {
    return value < 0 ? `${base}--down` : `${base}--up`;
  }

  formatTrend(value: number): string {
    const sign = value > 0 ? '+' : '';
    // Trim trailing .0 (e.g. 5.4 stays, 12.0 -> 12).
    const num = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
    return `${sign}${num}%`;
  }

  /* ─── Bar charts (self-scaled, no numeric axis — matches the design) ─── */

  barHeight(count: number, rows: { count: number }[]): string {
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    if (max <= 0) return '0%';
    return `${Math.max((count / max) * 100, count > 0 ? 6 : 0)}%`;
  }
}
