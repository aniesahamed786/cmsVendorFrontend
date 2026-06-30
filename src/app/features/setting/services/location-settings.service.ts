import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, map } from 'rxjs';
import { HttpParams } from '@angular/common/http';

export type SettingsLocation = {
  _id: { $oid: string } | string;
  country: string;
  country_ar?: string;
  region?: string;
  region_ar?: string;
  city: string;
  city_ar?: string;
};

export type CreateSettingsLocationDto = {
  country: string;
  region?: string;
  city: string;
  country_ar?: string;
  region_ar?: string;
  city_ar?: string;
};

export type LocationImportInvalidRow = {
  rowNumber: number;
  reason: string;
};

export type LocationImportResponse = {
  totalRows: number;
  insertedCount: number;
  skippedExistingCount: number;
  skippedDuplicateInFileCount: number;
  invalidRows: LocationImportInvalidRow[];
};

export type LocationOption = {
  en: string;
  ar: string;
};

export type SettingsLocationListQuery = {
  searchTerm?: string;
  country?: string;
  region?: string;
  city?: string;
};

@Injectable({ providedIn: 'root' })
export class LocationSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  list(query: SettingsLocationListQuery = {}): Observable<SettingsLocation[]> {
    let params = new HttpParams();
    const searchTerm = query.searchTerm?.trim();
    const country = query.country?.trim();
    const region = query.region?.trim();
    const city = query.city?.trim();

    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (country) params = params.set('country', country);
    if (region) params = params.set('region', region);
    if (city) params = params.set('city', city);

    return this.http.get<any>(`${this.baseUrl}/settings/locations`, { params }).pipe(
      map((res) => {
        // Backend may return either an array or { value: [...], Count: number }
        const rows = Array.isArray(res) ? res : Array.isArray(res?.value) ? res.value : [];
        return rows as SettingsLocation[];
      }),
    );
  }

  listCountries(): Observable<LocationOption[]> {
    return this.http.get<LocationOption[]>(`${this.baseUrl}/settings/locations/filter-options/countries`);
  }

  listRegions(country: string): Observable<LocationOption[]> {
    const params = new HttpParams().set('country', country);
    return this.http.get<LocationOption[]>(`${this.baseUrl}/settings/locations/filter-options/regions`, { params });
  }

  listCities(country: string, region?: string): Observable<LocationOption[]> {
    let params = new HttpParams().set('country', country);
    const normalizedRegion = region?.trim();
    if (normalizedRegion) params = params.set('region', normalizedRegion);
    return this.http.get<LocationOption[]>(`${this.baseUrl}/settings/locations/filter-options/cities`, { params });
  }

  create(payload: CreateSettingsLocationDto): Observable<SettingsLocation> {
    return this.http.post<SettingsLocation>(`${this.baseUrl}/settings/locations`, payload);
  }

  update(id: string, payload: CreateSettingsLocationDto): Observable<SettingsLocation> {
    return this.http.patch<SettingsLocation>(
      `${this.baseUrl}/settings/locations/${encodeURIComponent(id)}`,
      payload,
    );
  }

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/settings/locations/import/template`, {
      responseType: 'blob',
    });
  }

  importLocationsCsv(file: File): Observable<LocationImportResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<LocationImportResponse>(`${this.baseUrl}/settings/locations/import`, body);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/settings/locations/${encodeURIComponent(id)}`);
  }
}

