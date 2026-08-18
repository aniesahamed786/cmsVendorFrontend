import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { I18nService } from '../../../shared/i18n/i18n.service';
import {
  AccountListQuery,
  AccountStatus,
  CreateAccountPayload,
  PaginatedResponse,
  SelectOption,
  UpdateAccountPayload,
  UpdateAccountStatusPayload,
  VendorAccount,
  VendorAccountDetail,
  VendorCategory,
  VendorLocation,
} from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  list(query: AccountListQuery): Observable<PaginatedResponse<VendorAccount>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.accountType) params = params.set('accountType', query.accountType);

    return this.http
      .get<PaginatedResponse<VendorAccount>>(`${this.baseUrl}/accounts`, { params })
      .pipe(
        map((res) =>
          Array.isArray(res)
            ? { data: res as VendorAccount[], total: res.length, page: query.page, pageSize: query.pageSize }
            : { ...res, data: res?.data ?? [] },
        ),
        map((res) => this.enforceAccountType(res, query)),
      );
  }

  private enforceAccountType(
    res: PaginatedResponse<VendorAccount>,
    query: AccountListQuery,
  ): PaginatedResponse<VendorAccount> {
    if (!query.accountType) return res;

    const matching = res.data.filter((a) => !a.accountType || a.accountType === query.accountType);
    if (matching.length !== res.data.length) {
    }
    return { ...res, data: matching };
  }

  createAccount(payload: CreateAccountPayload): Observable<VendorAccount> {
    return this.http.post<VendorAccount>(`${this.baseUrl}/accounts`, payload);
  }

  updateAccount(id: string, payload: UpdateAccountPayload): Observable<VendorAccount> {
    return this.http.patch<VendorAccount>(`${this.baseUrl}/accounts/${id}`, payload);
  }

  updateAccountStatus(id: string, accountStatus: AccountStatus): Observable<VendorAccount> {
    const payload: UpdateAccountStatusPayload = { accountStatus };
    return this.http.patch<VendorAccount>(`${this.baseUrl}/accounts/${id}/status`, payload);
  }

  deleteAccount(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/accounts/${id}`);
  }

  getById(id: string): Observable<VendorAccountDetail> {
    return this.http.get<VendorAccountDetail>(`${this.baseUrl}/accounts/${id}`);
  }

  listLocations(): Observable<SelectOption[]> {
    return this.http.get<VendorLocation[]>(`${this.baseUrl}/locations`).pipe(
      map((rows) =>
        (rows ?? [])
          .map((row) => ({ label: this.branchLabel(row), value: row.locationId }))
          .filter((o) => !!o.value),
      ),
      catchError((err) => {
        return of<SelectOption[]>([]);
      }),
    );
  }

  listCategories(): Observable<SelectOption[]> {
    return this.http.get<VendorCategory[]>(`${this.baseUrl}/category`).pipe(
      map((rows) =>
        (rows ?? [])
          .map((c) => ({
            label: this.localized(c.name, c.name_ar),
            value: typeof c._id === 'string' ? c._id : (c._id?.$oid ?? ''),
          }))
          .filter((o) => !!o.value),
      ),
      catchError((err) => {
        console.error('Failed to load categories', err);
        return of<SelectOption[]>([]);
      }),
    );
  }

  private branchLabel(row: VendorLocation): string {
    const name = this.localized(row.locationName, row.locationNameAr);
    const city = this.localized(row.city, row.cityAr);
    return name && city ? `${name} — ${city}` : name || city;
  }

  private localized(en: string | undefined, ar: string | undefined): string {
    const value = this.i18n.lang() === 'ar' ? ar || en : en || ar;
    return (value ?? '').trim();
  }
}
