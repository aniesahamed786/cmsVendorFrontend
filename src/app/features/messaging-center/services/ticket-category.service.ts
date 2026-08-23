import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface TicketCategoryRecord {
  id: string;
  name: string;
  nameAr: string;
}

interface CategoryApiRow {
  _id: { $oid: string } | string;
  name: string;
  name_ar: string;
}

@Injectable({ providedIn: 'root' })
export class TicketCategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  list(): Observable<TicketCategoryRecord[]> {
    return this.http.get<CategoryApiRow[]>(`${this.baseUrl}/category`).pipe(
      map((rows) =>
        (rows ?? [])
          .map((row) => ({
            id: typeof row._id === 'string' ? row._id : (row._id?.$oid ?? ''),
            name: row.name ?? '',
            nameAr: row.name_ar ?? '',
          }))
          .filter((row) => !!row.id),
      ),
      catchError((err) => {
        console.error('Failed to load ticket categories', err);
        return of<TicketCategoryRecord[]>([]);
      }),
    );
  }
}
