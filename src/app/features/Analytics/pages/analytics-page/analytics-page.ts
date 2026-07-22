import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { VendorClickAnalyticsResponse, VendorClickAnalyticsService } from '../../services/click-analytics.service';
import { OfferInsightRow, VendorAnalyticsService } from '../../services/analytics.service';
import { MOCK_VENDOR_PROFILE } from '../../../Profile/data/mock-vendor-profile';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, FormsModule],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
})
export class AnalyticsPage implements OnInit, OnDestroy {
  vendorId: string | null = '1';
  locations: any[] = [];
  offers: any[] = [];
  activeOffers = 0;

  sortField: 'type' | 'clicks' | 'views' | null = null;
  sortDirection: 1 | -1 = 1;
  selectedCountry = signal<string>('all');

  readonly employeeTypes = ['Regular', 'Dependents', 'Retirees', 'Affiliates', 'SMPs'];

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
  private readonly clickAnalytics = inject(VendorClickAnalyticsService);

  /** Loaded from `GET /user-clicks/stats/vendor-analytics` (admin JWT). */
  private readonly vendorClickPayload = signal<VendorClickAnalyticsResponse | null>(null);
  private vendorClickSub: Subscription | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.locations = MOCK_VENDOR_PROFILE.locations || [];
    this.offers = MOCK_VENDOR_PROFILE.offers || [];
    this.activeOffers = this.offers.filter(o => o.status === 'Active').length;
    this.loadVendorClickAnalytics();

    // DELETE WHEN THE API IS WIRED — see the ARTIFICIAL LOADING block above.
    setTimeout(() => {
      this.loading.set(false);
      this.startCountUp();
    }, AnalyticsPage.FAKE_LOAD_MS);
  }

  ngOnDestroy(): void {
    this.vendorClickSub?.unsubscribe();
  }

  // ---- Count-up KPI stats (number_animation.md) ----------------------------
  // Cards render at 0 and ease to their value once the fake load resolves — the
  // sanctioned loading affordance for plain stat cards. The data-shaped cards
  // below skeleton instead; never both on one card.

  /** Animated, formatted value for a KPI key (0 until startCountUp fires). */
  animatedCount(key: string): string {
    return (this.animated()[key] ?? 0).toLocaleString('en-US');
  }

  private startCountUp(): void {
    this.animateTo('locations', this.locationCount);
    this.animateTo('activeOffers', this.activeOfferCount);
    this.animateTo('vendorViews', this.vendorViewEvents);
    this.animateTo('totalOfferViews', this.totalOfferViewEvents);
    this.animateTo('highlightViews', 0);
    this.animateTo('redemptions', 0);
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

  private loadVendorClickAnalytics(): void {
    this.vendorClickSub?.unsubscribe();
    this.vendorClickSub = null;

    const id = typeof this.vendorId === 'string' ? this.vendorId.trim() : '';
    if (!id) {
      this.vendorClickPayload.set(null);
      return;
    }
    this.vendorClickSub = this.clickAnalytics.getVendorAnalytics(id).subscribe({
      next: (data) => this.vendorClickPayload.set(data),
      error: () => this.vendorClickPayload.set(null),
    });
  }

  get vendorViewEvents(): number {
    return this.vendorClickPayload()?.vendor?.totalClickEvents ?? 0;
  }

  get totalOfferViewEvents(): number {
    return this.vendorClickPayload()?.offersAggregate?.totalClickEvents ?? 0;
  }

  private offerClickByOfferId(): Record<string, { totalClickEvents: number; uniqueUsersWhoClicked: number }> {
    const rows = this.vendorClickPayload()?.perOffer ?? [];
    return Object.fromEntries(
      rows.map((r) => [r.offerId, { totalClickEvents: r.totalClickEvents, uniqueUsersWhoClicked: r.uniqueUsersWhoClicked }]),
    );
  }

  /* ─── Overview ─── */

  get locationCount(): number {
    return this.analytics.locationCount(this.locations);
  }

  get activeOfferCount(): number {
    if (!Array.isArray(this.offers) || this.offers.length === 0) return this.activeOffers || 0;
    return this.offers.filter((o) => o?.isActive !== false).length;
  }

  /* ─── Offer Insights ─── */

  get offerInsightRows(): OfferInsightRow[] {
    const list = Array.isArray(this.offers) ? this.offers : [];
    const maxRows = list.length ? Math.min(list.length, 500) : 1;
    return this.analytics.offerInsightRows(list, this.sortField, this.sortDirection, maxRows, this.offerClickByOfferId());
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
    this.router.navigate(['/offers/detail', id]);
  }

  /* ─── Location Insights ─── */

  get countryOptions() {
    return this.analytics.countryOptions(this.locations);
  }

  get locationInsightRows() {
    return this.analytics.locationInsightRows(this.locations, this.selectedCountry());
  }

  get locationAxisLabels(): number[] {
    return this.analytics.locationAxisLabels(this.locationInsightRows);
  }

  getLocationBarHeight(count: number): string {
    return this.analytics.getLocationBarHeight(count, this.locationInsightRows);
  }

  updateSelectedCountry(value: string | null | undefined) {
    this.selectedCountry.set(value ?? 'all');
  }
}
