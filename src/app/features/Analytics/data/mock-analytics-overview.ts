/**
 * Static mock data for the "Analytics Overview" dashboard (AnalyticsOverviewPage).
 * No backend endpoint is wired yet — every value here is hand-authored placeholder
 * data that mirrors the shape a future `GET /analytics/overview` response would take.
 * Replace the constants below with real service calls once the API lands; keep the
 * interfaces, the component only reads through them.
 */

/** Icon color treatment for the top status cards — mirrors the offer status palette
 *  used elsewhere in the app (offers.scss `__status--active/--scheduled/--expired`). */
export type StatusCardVariant = 'primary' | 'draft' | 'pending' | 'inactive';

export interface StatusStatCard {
  id: string;
  icon: string;
  value: number;
  label: string;
  sublabel: string;
  variant: StatusCardVariant;
}

export const MOCK_OFFER_STATUS_STATS: StatusStatCard[] = [
  { id: 'active', icon: 'pi pi-tag', value: 402, label: 'Active Offers', sublabel: 'Currently active', variant: 'primary' },
  { id: 'draft', icon: 'pi pi-file-edit', value: 34, label: 'Offers Under Draft', sublabel: 'Offers in draft stage', variant: 'draft' },
  { id: 'pending', icon: 'pi pi-clock', value: 23, label: 'Pending Request', sublabel: 'Offers in pending state', variant: 'pending' },
  { id: 'inactive', icon: 'pi pi-ban', value: 0, label: 'Inactive Offers', sublabel: 'Offers which are not active', variant: 'inactive' },
];

export interface LocationRedemption {
  city: string;
  count: number;
}

export const MOCK_REDEMPTION_BY_LOCATION: LocationRedemption[] = [
  { city: 'Al Bashra', count: 32 },
  { city: 'Al Janubiya', count: 88 },
  { city: 'Hofuf', count: 58 },
  { city: 'Tabuk', count: 90 },
  { city: 'Ar Riyadh', count: 87 },
  { city: 'Ras Tanura', count: 55 },
  { city: 'Al Ula', count: 89 },
  { city: 'Al Ahsa', count: 40 },
  { city: 'Taif', count: 72 },
  { city: 'Hegra', count: 86 },
  { city: 'Uthailya', count: 60 },
];

export interface HighlightOffer {
  id: string;
  icon: string;
  label: string;
  offerTitle: string;
  metricValue: string;
  trendPercent: number;
  trendLabel: string;
}

export const MOCK_HIGHLIGHT_OFFERS: HighlightOffer[] = [
  {
    id: 'favourited',
    icon: 'pi pi-bookmark',
    label: 'Most Favourited Offer',
    offerTitle: 'Summer Staycation Deluxe',
    metricValue: '14.2k Likes',
    trendPercent: 12,
    trendLabel: 'this week',
  },
  {
    id: 'viewed',
    icon: 'pi pi-eye',
    label: 'Most Viewed Offer',
    offerTitle: 'Tech Bundle: Pro Max',
    metricValue: '86.5k Views',
    trendPercent: 5.4,
    trendLabel: 'this week',
  },
  {
    id: 'shared',
    icon: 'pi pi-share-alt',
    label: 'Most Shared Offer',
    offerTitle: 'BOGO Dining Rewards',
    metricValue: '3.8k Shares',
    trendPercent: -1.2,
    trendLabel: 'this week',
  },
];

export type OverviewPeriod = '7d' | '30d' | '90d' | 'all';

export interface OverviewPeriodOption {
  label: string;
  value: OverviewPeriod;
}

export const OVERVIEW_PERIOD_OPTIONS: OverviewPeriodOption[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
];

export interface OffersOverviewStats {
  totalOffers: number;
  totalOffersTrend: number;
  totalRedemption: number;
  totalRedemptionTrend: number;
  costSavings: number;
  costSavingsTrend: number;
  successRate: number;
  successRateTrend: number;
}

export const MOCK_OFFERS_OVERVIEW_BY_PERIOD: Record<OverviewPeriod, OffersOverviewStats> = {
  '7d': {
    totalOffers: 10,
    totalOffersTrend: 12,
    totalRedemption: 240,
    totalRedemptionTrend: 18,
    costSavings: 47500,
    costSavingsTrend: -5,
    successRate: 85,
    successRateTrend: 10,
  },
  '30d': {
    totalOffers: 38,
    totalOffersTrend: 9,
    totalRedemption: 980,
    totalRedemptionTrend: 22,
    costSavings: 182300,
    costSavingsTrend: 6,
    successRate: 81,
    successRateTrend: 4,
  },
  '90d': {
    totalOffers: 104,
    totalOffersTrend: 15,
    totalRedemption: 3120,
    totalRedemptionTrend: 27,
    costSavings: 512400,
    costSavingsTrend: 11,
    successRate: 78,
    successRateTrend: -2,
  },
  all: {
    totalOffers: 402,
    totalOffersTrend: 31,
    totalRedemption: 11840,
    totalRedemptionTrend: 40,
    costSavings: 1875000,
    costSavingsTrend: 19,
    successRate: 80,
    successRateTrend: 6,
  },
};

export interface DayRedemption {
  day: string;
  count: number;
}

export const MOCK_REDEMPTIONS_BY_DAY: DayRedemption[] = [
  { day: 'Sun', count: 28 },
  { day: 'Mon', count: 40 },
  { day: 'Tue', count: 62 },
  { day: 'Wed', count: 38 },
  { day: 'Thu', count: 30 },
  { day: 'Fri', count: 55 },
  { day: 'Sat', count: 50 },
];
