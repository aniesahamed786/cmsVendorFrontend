import { computed, Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TagApiService } from '../tag-api.service';

export interface TagListItem {
  name: string;
  count: number;
  createdAt?: { $date: string };
  updatedAt?: { $date: string };
}

export type TagSortBy = 'name' | 'count' | 'createdAt' | 'updatedAt';
export type TagSortOrder = 'asc' | 'desc';

export function normalizeTagName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

@Injectable({
  providedIn: 'root'
})
export class TagsListService {
  private tagApi = inject(TagApiService);

  tags = signal<TagListItem[]>([]);
  topTags = signal<TagListItem[]>([]);
  loading = signal(false);
  topTagsLoading = signal(false);
  total = signal(0);
  usedTagsCount = signal(0);
  unusedTagsCount = signal(0);
  mostUsedTagName = signal('--');
  currentPage = signal(1);
  currentLimit = signal(10);
  currentSortBy = signal<TagSortBy>('createdAt');
  currentSortOrder = signal<TagSortOrder>('desc');

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil((this.total() || 0) / Math.max(1, this.currentLimit()))),
  );

  /** Load tags from the tag collection (call from component init). */
  loadTags(
    page = this.currentPage(),
    limit = this.currentLimit(),
    sortBy = this.currentSortBy(),
    sortOrder = this.currentSortOrder(),
  ) {
    this.currentPage.set(page);
    this.currentLimit.set(limit);
    this.currentSortBy.set(sortBy);
    this.currentSortOrder.set(sortOrder);
    this.loading.set(true);
    this.tagApi.getTags(page, limit, sortBy, sortOrder).subscribe({
      next: (response) => {
        const total = response.total ?? response.data.length;
        if (page > 1 && response.data.length === 0 && total > 0) {
          this.loadTags(page - 1, limit, sortBy, sortOrder);
          return;
        }
        this.tags.set(
          response.data
            .map((t) => ({ name: t.name, count: t.count ?? 0, createdAt: t.createdAt, updatedAt: t.updatedAt }))
        );
        this.total.set(total);
        this.usedTagsCount.set(response.usedTagsCount ?? 0);
        this.unusedTagsCount.set(response.unusedTagsCount ?? 0);
        this.mostUsedTagName.set(response.mostUsedTagName?.trim() || '--');
        this.loading.set(false);
      },
      error: () => {
        this.tags.set([]);
        this.total.set(0);
        this.usedTagsCount.set(0);
        this.unusedTagsCount.set(0);
        this.mostUsedTagName.set('--');
        this.loading.set(false);
      },
    });
  }

  loadTopTags(limit = 6): void {
    this.topTagsLoading.set(true);
    this.tagApi.getTags(1, limit, 'count', 'desc').subscribe({
      next: (response) => {
        this.topTags.set(
          response.data
            .filter((t) => (t.count ?? 0) > 0)
            .map((t) => ({ name: t.name, count: t.count ?? 0, createdAt: t.createdAt, updatedAt: t.updatedAt })),
        );
        this.total.set(response.total ?? response.data.length);
        this.topTagsLoading.set(false);
      },
      error: () => {
        this.topTags.set([]);
        this.topTagsLoading.set(false);
      },
    });
  }

  private reloadAfterMutation(): void {
    const targetPage = Math.min(this.currentPage(), this.pageCount());
    this.loadTags(
      Math.max(1, targetPage),
      this.currentLimit(),
      this.currentSortBy(),
      this.currentSortOrder(),
    );
    this.loadTopTags();
  }

  /** Add a tag via POST to the tag collection, then refresh the list. */
  addTag(name: string): Observable<unknown> {
    const trimmed = name?.trim();
    if (!trimmed) return of(null);
    return this.tagApi.createTag(trimmed).pipe(
      tap({
        next: () => this.reloadAfterMutation(),
      }),
    );
  }

  updateTag(currentName: string, nextName: string): Observable<unknown> {
    const current = currentName?.trim();
    const next = nextName?.trim();
    if (!current || !next || current === next) return of(null);

    return this.tagApi.updateTag(current, next).pipe(
      tap({
        next: () => this.reloadAfterMutation(),
      }),
    );
  }

  removeTag(tagToDelete: TagListItem) {
    const name = tagToDelete?.name?.trim();
    if (!name) return;

    this.tagApi.deleteTag(name).subscribe({
      next: () => this.reloadAfterMutation(),
      error: () => {
        // If delete fails, reload to restore UI state
        this.reloadAfterMutation();
      },
    });
  }
}
