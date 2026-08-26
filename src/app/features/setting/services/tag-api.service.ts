import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TagResponse {
  _id: { $oid: string };
  name: string;
  count?: number;
  createdAt?: { $date: string };
  updatedAt?: { $date: string };
  __v?: number;
}

export interface PaginatedTagsResponse {
  data: TagResponse[];
  total: number;
  page: number;
  limit: number;
  usedTagsCount?: number;
  unusedTagsCount?: number;
  mostUsedTagName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TagApiService {
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  /** POST: create a tag in the tag collection */
  createTag(name: string): Observable<TagResponse> {
    return this.http.post<TagResponse>(`${this.baseUrl}/tag`, { name: name.trim() });
  }

  /** GET: fetch paginated tags (with offer counts) */
  getTags(
    page = 1,
    limit = 10,
    sortBy = 'count',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Observable<PaginatedTagsResponse> {
    return this.http.get<PaginatedTagsResponse>(
      `${this.baseUrl}/tag?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
    );
  }

  /** PATCH: rename an existing tag */
  updateTag(currentName: string, nextName: string): Observable<TagResponse> {
    const encoded = encodeURIComponent(currentName.trim());
    return this.http.patch<TagResponse>(`${this.baseUrl}/tag/${encoded}`, { name: nextName.trim() });
  }

  /** DELETE: delete a tag by name */
  deleteTag(name: string): Observable<{ message: string; name: string }> {
    const encoded = encodeURIComponent(name.trim());
    return this.http.delete<{ message: string; name: string }>(`${this.baseUrl}/tag/${encoded}`);
  }
}
