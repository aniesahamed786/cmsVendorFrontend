import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AnalyticsTopOffer {
  offerId: string;
  offerTitle: string;
  offerTitleAr: string;
  count: number;
}

export interface AnalyticsOverview {
  activeOffersCount: number;
  inactiveOffersCount: number;
  draftOffersCount: number;
  pendingRequestsCount: number;
  mostFavouritedOffer: AnalyticsTopOffer;
  mostViewedOffer: AnalyticsTopOffer;
  mostSharedOffer: AnalyticsTopOffer;
}

export interface AnalyticsOffersSummary {
  totalOffers: number;
  totalViews: number;
  totalLocations: number;
  totalRedemptions: number;
}

export interface AnalyticsRedemptionsByLocation {
  branchId: unknown;
  branchName: string;
  branchName_ar: string;
  city: string;
  city_ar: string;
  redemptionsCount: number;
}

export interface AnalyticsRedemptionsByDay {
  day: string;
  dayOfWeek: string;
  redemptionsCount: number;
}

export interface OfferInsightRow {
  id: string | null;
  title: string;
  discount: string;
  type: string;
  shares: number;
  redemptions: number;
  views: number;
  favorites: number;
}

export interface OfferInsightApiRow {
  offerId: string;
  offerTitle: string;
  discountAmount: string;
  discountType: string;
  offerType: string[];
  shares: number;
  views: number;
  redemptions: number;
}

export interface OfferInsightsResponse {
  data: OfferInsightApiRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CityInsightRow {
  city: string;
  count: number;
}

export interface CountryOption {
  label: string;
  value: string;
}

/**
 * VendorAnalyticsService
 *
 * Centralises computable analytics logic shared by VendorAnalyticsComponent
 * and OfferAnalytics. All metrics that require a dedicated analytics backend
 * endpoint (views, shares, redemptions, platform breakdown, employee types)
 * are intentionally returned as 0 here until those services are connected.
 */
@Injectable({ providedIn: 'root' })
export class VendorAnalyticsService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(`${environment.apiBaseUrl}/analytics/overview`);
  }

  getOffersSummary(): Observable<AnalyticsOffersSummary> {
    return this.http.get<AnalyticsOffersSummary>(`${environment.apiBaseUrl}/analytics/offersSummary`);
  }

  getRedemptionsByLocation(): Observable<AnalyticsRedemptionsByLocation[]> {
    return this.http.get<AnalyticsRedemptionsByLocation[]>(`${environment.apiBaseUrl}/analytics/getRedemptionsByLocation`);
  }

  getRedemptionsByDays(): Observable<AnalyticsRedemptionsByDay[]> {
    return this.http.get<AnalyticsRedemptionsByDay[]>(`${environment.apiBaseUrl}/analytics/redemptionsByDays`);
  }

  /** Server-paginated + server-sorted offer insights. */
  getOfferInsights(
    page: number,
    pageSize: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Observable<OfferInsightsResponse> {
    return this.http.get<OfferInsightsResponse>(
      `${environment.apiBaseUrl}/analytics/offerInsights`,
      { params: sortBy ? { page, pageSize, sortBy, sortOrder: sortOrder ?? 'asc' } : { page, pageSize } },
    );
  }

  toOfferInsightRow(row: OfferInsightApiRow): OfferInsightRow {
    const types = Array.isArray(row.offerType) ? row.offerType : [row.offerType];
    return {
      id: row.offerId ?? null,
      title: row.offerTitle || '-',
      discount: this.getDiscountAmount(row),
      type: this.formatOfferType(types.length > 1 ? 'both' : types[0]),
      shares: Number(row.shares) || 0,
      redemptions: Number(row.redemptions) || 0,
      views: Number(row.views) || 0,
      favorites: 0,
    };
  }

  /* ─────────────────── Location helpers ─────────────────── */

  /** Total number of locations. */
  locationCount(locations: any[]): number {
    return Array.isArray(locations) ? locations.length : 0;
  }

  /** Unique sorted country options derived from the locations list. */
  countryOptions(locations: any[]): CountryOption[] {
    const countries = Array.from(
      new Set(
        (Array.isArray(locations) ? locations : [])
          .map(l => this.getLocationCountry(l))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { label: 'All Countries', value: 'all' },
      ...countries.map(c => ({ label: c, value: c })),
    ];
  }

  /**
   * Groups locations by city, optionally filtered by country, and returns
   * rows sorted descending by count.
   */
  locationInsightRows(locations: any[], selectedCountry: string): CityInsightRow[] {
    const counts = new Map<string, number>();

    for (const loc of Array.isArray(locations) ? locations : []) {
      const country = this.getLocationCountry(loc);
      if (selectedCountry !== 'all' && country !== selectedCountry) continue;
      const city = this.getLocationCity(loc);
      counts.set(city, (counts.get(city) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count !== a.count ? b.count - a.count : a.city.localeCompare(b.city));
  }

  /**
   * Max Y-axis value rounded up to the nearest multiple of 4
   * (so the chart always has 4 equal steps).
   */
  locationScaleMax(rows: CityInsightRow[]): number {
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  }

  /** Y-axis tick labels (top → bottom). */
  locationAxisLabels(rows: CityInsightRow[]): number[] {
    const max = this.locationScaleMax(rows);
    const step = max / 4;
    return [max, max - step, max - step * 2, max - step * 3, 0];
  }

  /** CSS percentage height for a city bar. */
  getLocationBarHeight(count: number, rows: CityInsightRow[]): string {
    const scaleMax = this.locationScaleMax(rows);
    if (scaleMax <= 0) return '0%';
    return `${Math.max((count / scaleMax) * 100, count > 0 ? 8 : 0)}%`;
  }

  /* ─────────────────── Offer table helpers ─────────────────── */

  /** Builds offer insight rows from the local offer list. */
  offerInsightRows(
    offers: any[],
    sortField: 'shares' | 'redemptions' | 'views' | null,
    sortDirection: 1 | -1,
    maxRows = 3,
  ): OfferInsightRow[] {
    const slice = Array.isArray(offers) && offers.length ? offers.slice(0, maxRows) : [];
    const rows: OfferInsightRow[] = slice.length
      ? slice.map(offer => {
          const id = this.getOfferId(offer);
          return {
            id,
            title: offer?.title ?? '-',
            discount: this.getDiscountAmount(offer),
            type: this.formatOfferType(offer?.offerMode ?? offer?.offer_type ?? offer?.offerType),
            shares: Number(offer?.shares) || 0,
            redemptions: Number(offer?.redemptions) || 0,
            views: Number(offer?.views) || 0,
            favorites: Number(offer?.favorites) || 0,
          };
        })
      : [{ id: null, title: '-', discount: '0', type: '-', shares: 0, redemptions: 0, views: 0, favorites: 0 }];

    if (!sortField) return rows;

    return [...rows].sort((a, b) => {
      const vA = a[sortField as keyof OfferInsightRow];
      const vB = b[sortField as keyof OfferInsightRow];
      if (typeof vA === 'number' && typeof vB === 'number') return (vA - vB) * sortDirection;
      return String(vA ?? '').localeCompare(String(vB ?? '')) * sortDirection;
    });
  }

  /** Returns the PrimeNG sort icon class for a given column. */
  getSortIcon(
    column: 'shares' | 'redemptions' | 'views',
    sortField: 'shares' | 'redemptions' | 'views' | null,
    sortDirection: 1 | -1,
  ): string {
    if (sortField !== column) return 'pi pi-sort-alt';
    return sortDirection === 1 ? 'pi pi-sort-amount-down-alt' : 'pi pi-sort-amount-up-alt';
  }

  /* ─────────────────── Formatting helpers ─────────────────── */

  getOfferId(offer: any): string | null {
    if (typeof offer?._id === 'string') return offer._id;
    if (typeof offer?._id?.$oid === 'string') return offer._id.$oid;
    if (typeof offer?.id === 'string') return offer.id;
    if (typeof offer?.offerId === 'string') return offer.offerId;
    return null;
  }

  getDiscountAmount(offer: any): string {
    const amount =
      offer?.discountAmount ??
      offer?.discount_amount ??
      offer?.Discount_amount ??
      offer?.discount;

    if (amount != null && String(amount).trim()) {
      return this.formatDiscountDisplayValue(offer, String(amount).trim());
    }
    return String(offer?.discountCode ?? '0');
  }

  private formatDiscountDisplayValue(offer: any, amount: string): string {
    const discountType = String(offer?.discountType ?? '').trim().toLowerCase();
    if (!amount) return '0';
    if (discountType === 'percentage') return amount.endsWith('%') ? amount : `${amount}%`;
    if (discountType === 'fixed') return amount.toUpperCase().endsWith('SAR') ? amount : `${amount} SAR`;
    return amount;
  }

  formatOfferType(value: unknown): string {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '-';
    if (normalized.includes('both')) return 'In-Store & Digital';
    if (normalized.includes('digital') || normalized.includes('online')) return 'Digital';
    if (normalized.includes('store')) return 'In-Store';
    return String(value);
  }

  private getLocationCity(location: any): string {
    return String(location?.city ?? location?.branch_name ?? location?.name ?? '--').trim() || '--';
  }

  private getLocationCountry(location: any): string {
    return String(location?.country ?? 'Saudi Arabia').trim() || 'Saudi Arabia';
  }
}
