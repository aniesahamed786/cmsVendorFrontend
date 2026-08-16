import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SystemLogListResponse, SystemLogQuery } from '../models/system-log.model';

@Injectable({ providedIn: 'root' })
export class SystemLogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  getSystemLogs(query: SystemLogQuery): Observable<SystemLogListResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);

    if (query.sortOrder) params = params.set('sortOrder', query.sortOrder);
    if (query.entityType) params = params.set('entityType', query.entityType);
    if (query.action) params = params.set('action', query.action);
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);

    return this.http.get<SystemLogListResponse>(`${this.baseUrl}/system-logs`, { params });
  }
}
