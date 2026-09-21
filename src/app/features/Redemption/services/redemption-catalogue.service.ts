import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { OfferDetailApi } from '../../Offers/models/offerList';
import { OfferDetailService } from '../../Offers/services/offer-detail.service';
import { ActiveStoreOffer, OfferLocation } from '../models/redemption.model';
import { DraftBranch } from '../utils/redemption-draft';
import { TemplateOffer, branchLabel } from '../utils/redemption-template';
import { RedemptionService } from './redemption.service';

/** Offers with their branches, resolved and localized — shared by the template
 *  download and the bulk-upload page. */
export interface CatalogueEntry {
  offerId: string;
  title: string;
  raw: unknown;
  locations: { id: string; name: string; city: string; raw: unknown }[];
  /** Only filled when loaded with dates (the Excel template). UTC midnight, see offerDayUtc. */
  startDate?: Date | null;
  endDate?: Date | null;
}

/** The offer's calendar day as UTC midnight. exceljs serialises a Date from its UTC
 *  time, so a local-midnight date would land on the previous day east of UTC. */
function offerDayUtc(value: { $date: string } | string | undefined): Date | null {
  const iso = typeof value === 'string' ? value : value?.$date;
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function unwrapArray<T>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) return response as T[];
  const body = response as Record<string, unknown> | null;
  for (const key of keys) {
    const value = body?.[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export function asLocationArray(response: unknown): OfferLocation[] {
  return unwrapArray<OfferLocation>(response, ['data', 'locations', 'items', 'result']);
}

export function asOfferArray(response: unknown): ActiveStoreOffer[] {
  return unwrapArray<ActiveStoreOffer>(response, ['data', 'offers', 'items', 'result']);
}

export function toTemplateOffer(entry: CatalogueEntry): TemplateOffer {
  return {
    offerId: entry.offerId,
    title: entry.title,
    raw: entry.raw,
    startDate: entry.startDate ?? null,
    endDate: entry.endDate ?? null,
    branches: entry.locations.map((l) => ({
      id: l.id,
      label: branchLabel(l.name, l.city),
      raw: l.raw,
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class RedemptionCatalogueService {
  private readonly api = inject(RedemptionService);
  private readonly i18n = inject(I18nService);
  private readonly offerDetail = inject(OfferDetailService);

  private static readonly LOCATION_FETCH_CONCURRENCY = 6;

  /** Picks the field for the active language, falling back to the other one. */
  localized(en: string | undefined, ar: string | undefined): string {
    const value = this.i18n.lang() === 'ar' ? ar || en : en || ar;
    return value ?? '';
  }

  /** Active offers, each with its branches fetched in parallel and the source order kept.
   *  withDates also pulls each offer's detail for its active period — one extra request
   *  per offer, so only the template download asks for it. */
  loadOfferCatalogue(withDates = false): Observable<CatalogueEntry[]> {
    return this.api.getActiveStoreOffers().pipe(
      switchMap((offers) => {
        const list = asOfferArray(offers);
        if (!list.length) return of<CatalogueEntry[]>([]);

        return from(list).pipe(
          mergeMap(
            (offer) =>
              forkJoin({
                locations: this.api
                  .getOfferLocations(offer.offerId)
                  .pipe(catchError(() => of<OfferLocation[]>([]))),
                detail: withDates
                  ? this.offerDetail
                      .getOfferDetail(offer.offerId)
                      .pipe(catchError(() => of<OfferDetailApi | null>(null)))
                  : of<OfferDetailApi | null>(null),
              }).pipe(
                map<{ locations: unknown; detail: OfferDetailApi | null }, CatalogueEntry>(
                  ({ locations, detail }) => ({
                  offerId: offer.offerId,
                  startDate: offerDayUtc(detail?.startDate),
                  endDate: offerDayUtc(detail?.endDate),
                  title: this.localized(offer.offerTitle, offer.offerTitleAr),
                  raw: offer,
                  locations: asLocationArray(locations).map((l) => {
                    const raw = l as unknown as Record<string, unknown>;
                    return {
                      id: String(l.locationId ?? raw['_id'] ?? raw['id'] ?? ''),
                      name: this.localized(l.locationName, l.locationNameAr),
                      city: this.localized(l.city, l.cityAr),
                      raw: l,
                    };
                  }),
                  }),
                ),
              ),
            RedemptionCatalogueService.LOCATION_FETCH_CONCURRENCY,
          ),
          toArray(),
          map((entries) => {
            const order = new Map(list.map((o, i) => [o.offerId, i]));
            return entries.sort((a, b) => (order.get(a.offerId) ?? 0) - (order.get(b.offerId) ?? 0));
          }),
        );
      }),
    );
  }

  /** Branches for one offer, ready for the draft catalogue. */
  toDraftBranches(locations: unknown): DraftBranch[] {
    return asLocationArray(locations)
      .map((l) => {
        const raw = l as unknown as Record<string, unknown>;
        const id = String(l.locationId ?? raw['_id'] ?? raw['id'] ?? '');
        const name = this.localized(l.locationName, l.locationNameAr);
        const city = this.localized(l.city, l.cityAr);
        return { branchId: id, label: branchLabel(name, city) || id };
      })
      .filter((b) => !!b.branchId);
  }
}
