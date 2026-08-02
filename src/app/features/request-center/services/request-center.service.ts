import { Injectable, computed, signal } from '@angular/core';
import { RequestRow, TERMINAL_STATUSES } from '../models/request.model';

/**
 * Holds the request rows fetched from GET /cmsVendor/requests so both the list page (table +
 * tab counts) and the detail page (getRow) read the same set. The list page loads the rows
 * (see RequestCenterList.loadRequests) and calls setRows; recall/remove apply the optimistic
 * local change once their workflow endpoint succeeds.
 *
 * Note: rows live only for the session. Deep-linking to /request-center/:id after a reload
 * finds an empty store (there is no get-single-request endpoint yet) — the detail page shows
 * its not-found state in that case.
 */
@Injectable({ providedIn: 'root' })
export class RequestCenterService {
  private readonly rows = signal<RequestRow[]>([]);

  /** Tab counts derived from the loaded rows: All / Completed (terminal) / Incomplete (in-flight). */
  readonly tabCounts = computed(() => {
    const all = this.rows();
    const completed = all.filter((r) => r.completed).length;
    return { all: all.length, completed, incomplete: all.length - completed };
  });

  setRows(rows: RequestRow[]): void {
    this.rows.set(rows);
  }

  getRows() {
    return this.rows.asReadonly();
  }

  getRow(rowKey: string) {
    return computed(() => this.rows().find((r) => r.rowKey === rowKey) ?? null);
  }

  /** Reflect a successful recall locally: RECALLED is terminal, so the row becomes completed. */
  recall(rowKey: string): void {
    this.rows.update((rows) =>
      rows.map((r) =>
        r.rowKey === rowKey ? { ...r, status: 'RECALLED', completed: TERMINAL_STATUSES.includes('RECALLED') } : r,
      ),
    );
  }

  remove(rowKey: string): void {
    this.rows.update((rows) => rows.filter((r) => r.rowKey !== rowKey));
  }
}
