import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, throwError, switchMap } from 'rxjs';
import { normalizeVendorResponse } from '../models/vendordetails';
import { VendorDetails, VendorStatus } from '../models/vendordetails';
import { environment } from '../../../../environments/environment';

export interface PaginatedVendorsResponse {
  data: VendorDetails[];
  total: number;
  page: number;
  pageSize: number;
}

export type VendorStatusFilter = 'all' | VendorStatus;

export interface VendorDateFilter {
  createdFrom?: string;
  createdTo?: string;
}

export type VendorSortBy =
  | 'name'
  | 'email'
  | 'offersCount'
  | 'locationsCount'
  | 'status'
  | 'createdAt';

export type VendorSortOrder = 'asc' | 'desc';

export interface VendorSortOptions {
  sortBy?: VendorSortBy;
  sortOrder?: VendorSortOrder;
}

export interface VendorListQuery {
  page?: number;
  pageSize?: number;
  searchTerm?: string | null;
  status?: VendorStatusFilter;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: VendorSortBy;
  sortOrder?: VendorSortOrder;
}

export interface VendorExportColumn {
  key: string;
  label: string;
  width?: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class GetVendorList {
  private readonly base_url = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /** Raw API response shape from backend GET /vendor?page=&pageSize= */
  private static parsePaginatedResponse(res: { data?: unknown[]; total?: number; page?: number; pageSize?: number }): PaginatedVendorsResponse {
    const raw = Array.isArray(res?.data) ? res.data : [];
    const data = raw.map((v) => normalizeVendorResponse(v as { socialLinks?: unknown; links?: unknown })) as VendorDetails[];
    return {
      data,
      total: typeof res?.total === 'number' ? res.total : 0,
      page: typeof res?.page === 'number' ? res.page : 1,
      pageSize: typeof res?.pageSize === 'number' ? res.pageSize : 10,
    };
  }

  /**
   * Get vendors with server-side pagination.
   * Only the requested page of vendors is fetched.
   */
  getVendorsPaginated(
    pageOrQuery: number | VendorListQuery = 1,
    pageSize: number = 10,
    status: VendorStatusFilter = 'all',
    dateFilter?: VendorDateFilter,
    sortOptions?: VendorSortOptions
  ): Observable<PaginatedVendorsResponse> {
    const query = typeof pageOrQuery === 'object'
      ? pageOrQuery
      : this.buildLegacyQuery(pageOrQuery, pageSize, status, dateFilter, sortOptions);
    const params = this.buildQueryParams(query, { includePagination: true });

    return this.http
      .get<{ data: unknown[]; total: number; page: number; pageSize: number }>(this.base_url + '/vendor', { params })
      .pipe(
        map(GetVendorList.parsePaginatedResponse),
        catchError(handleApiError)
      );
  }

  /** Fetches every vendor page from the paginated backend list. */
  getAllVendors(
    queryOrStatus: VendorListQuery | VendorStatusFilter = {},
    dateFilter?: VendorDateFilter,
    sortOptions?: VendorSortOptions,
  ): Observable<VendorDetails[]> {
    const normalizedQuery = this.isVendorListQuery(queryOrStatus)
      ? queryOrStatus
      : {
          status: queryOrStatus as VendorStatusFilter,
          createdFrom: dateFilter?.createdFrom,
          createdTo: dateFilter?.createdTo,
          sortBy: sortOptions?.sortBy,
          sortOrder: sortOptions?.sortOrder,
        };
    const pageSize = 100;
    return this.getVendorsPaginated({ ...normalizedQuery, page: 1, pageSize }).pipe(
      switchMap((firstPage) => {
        const totalPages = Math.ceil(firstPage.total / firstPage.pageSize);
        if (totalPages <= 1) return of(firstPage.data);

        const remainingPageRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
          this.getVendorsPaginated({ ...normalizedQuery, page: index + 2, pageSize: firstPage.pageSize })
        );

        return forkJoin(remainingPageRequests).pipe(
          map((remainingPages) => [
            ...firstPage.data,
            ...remainingPages.flatMap((page) => page.data),
          ])
        );
      })
    );
  }

  getExportColumns(): Observable<VendorExportColumn[]> {
    return this.http
      .get<VendorExportColumn[]>(`${this.base_url}/vendor/export/columns`)
      .pipe(
        map((response) =>
          Array.isArray(response)
            ? response.filter(
                (column): column is VendorExportColumn =>
                  !!column &&
                  typeof column.key === 'string' &&
                  typeof column.label === 'string',
              )
            : [],
        ),
        catchError(handleApiError),
      );
  }

  exportVendors(
    query: VendorListQuery = {},
    columns: string[] = [],
  ): Observable<HttpResponse<Blob>> {
    let params = this.buildQueryParams(query, { includePagination: false });

    const normalizedColumns = columns
      .map((column) => String(column ?? '').trim())
      .filter(Boolean);

    if (normalizedColumns.length) {
      params = params.set('columns', normalizedColumns.join(','));
    }

    return this.http
      .get(`${this.base_url}/vendor/export`, {
        params,
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(catchError(handleApiError));
  }

   /**
    * Get locations for the authenticated vendor.
    * Backend route: GET /cmsVendor/locations — the vendor is resolved from the
    * vendor-account JWT, so the `vendorId` arg only gates the call (there is one
    * vendor per logged-in account). The CMS DTO fields are mapped back to the
    * legacy location shape the offer form + location dialog consume.
    */
  getVendorLocationsById(vendorId: string): Observable<any[]> {
     if (!vendorId) {
       return new Observable<any[]>((subscriber) => {
         subscriber.next([]);
         subscriber.complete();
       });
     }
     return this.http
       .get<any>(`${this.base_url}/locations`)
       .pipe(
         map((res) => {
           const rows = Array.isArray(res) ? res : res?.locations ?? [];
           return (rows ?? []).map((loc: any) => ({
             id: loc?.locationId ?? loc?.id ?? loc?._id ?? loc?.__id__?.$oid ?? '',
             __id__: { $oid: loc?.locationId ?? loc?.id ?? loc?._id ?? loc?.__id__?.$oid ?? '' },
             locationId: loc?.locationId ?? loc?.id ?? loc?._id ?? loc?.__id__?.$oid ?? '',
             branch_name: loc?.locationName ?? loc?.branch_name ?? '',
             branch_name_ar: loc?.locationNameAr ?? loc?.branch_name_ar ?? '',
             locationName: loc?.locationName ?? loc?.branch_name ?? '',
             locationNameAr: loc?.locationNameAr ?? loc?.branch_name_ar ?? '',
             city: loc?.city ?? '',
             cityAr: loc?.cityAr ?? loc?.city_ar ?? '',
             city_ar: loc?.cityAr ?? loc?.city_ar ?? '',
             country: loc?.country ?? '',
             countryAr: loc?.countryAr ?? '',
             region: loc?.region ?? '',
             regionAr: loc?.regionAr ?? '',
             latitude: loc?.latitude,
             longitude: loc?.longitude,
             googleMapLink: loc?.googleMapLink ?? '',
             representativeName: loc?.representativeName ?? '',
             representativeNameAr: loc?.representativeNameAr ?? '',
             totalOffers: loc?.totalOffers,
             vendorLogo: res?.vendorLogo,
           }));
         }),
         catchError(handleApiError),
       );
   }

  searchVendors(
    searchTerm: string,
    status: VendorStatusFilter = 'all',
    dateFilter?: VendorDateFilter,
    sortOptions?: VendorSortOptions
  ): Observable<VendorDetails[]> {
    const normalizedTerm = searchTerm.trim();
    if (!normalizedTerm) {
      return of([]);
    }

    return this.getAllVendors({
      searchTerm: normalizedTerm,
      status,
      createdFrom: dateFilter?.createdFrom,
      createdTo: dateFilter?.createdTo,
      sortBy: sortOptions?.sortBy,
      sortOrder: sortOptions?.sortOrder,
    });
  }
  
  private buildQueryParams(
    query: VendorListQuery,
    options: { includePagination: boolean },
  ): HttpParams {
    let params = new HttpParams();

    if (options.includePagination) {
      params = params
        .set('page', String(query.page ?? 1))
        .set('pageSize', String(query.pageSize ?? 10));
    }

    const searchTerm = String(query.searchTerm ?? '').trim();
    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }

    if (query.status && query.status !== 'all') {
      params = params.set('status', query.status);
    }

    if (query.createdFrom) {
      params = params.set('createdFrom', query.createdFrom);
    }

    if (query.createdTo) {
      params = params.set('createdTo', query.createdTo);
    }

    if (query.sortBy) {
      params = params.set('sortBy', query.sortBy);
    }

    if (query.sortOrder) {
      params = params.set('sortOrder', query.sortOrder);
    }

    return params;
  }

  private buildLegacyQuery(
    page: number,
    pageSize: number,
    status: VendorStatusFilter,
    dateFilter?: VendorDateFilter,
    sortOptions?: VendorSortOptions,
  ): VendorListQuery {
    return {
      page,
      pageSize,
      status,
      createdFrom: dateFilter?.createdFrom,
      createdTo: dateFilter?.createdTo,
      sortBy: sortOptions?.sortBy,
      sortOrder: sortOptions?.sortOrder,
    };
  }

  private isVendorListQuery(value: unknown): value is VendorListQuery {
    return !!value && typeof value === 'object';
  }
}

function handleApiError(err: unknown) {
  return throwError(() => err);
}
