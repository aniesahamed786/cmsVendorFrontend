import { Injectable, computed, signal } from '@angular/core';
import {
  COMPLETED_STATUSES,
  INCOMPLETE_STATUSES,
  RequestRow,
  RequestStatus,
  TERMINAL_STATUSES,
} from '../models/request.model';

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

  /** Tab counts from server: All / Completed ("APPROVED", "REJECTED", "RECALLED", "CANCELLED") / Incomplete ("DRAFT", "SUBMITTED", "RETURNED"). */
  readonly tabCounts = signal<{ all: number; completed: number; incomplete: number }>({
    all: 0,
    completed: 0,
    incomplete: 0,
  });

  setTabCounts(counts: { all: number; completed: number; incomplete: number }): void {
    this.tabCounts.set(counts);
  }

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

  updateStatus(rowKey: string, status: RequestStatus): void {
    this.rows.update((rows) =>
      rows.map((r) =>
        r.rowKey === rowKey ? { ...r, status, completed: TERMINAL_STATUSES.includes(status) } : r,
      ),
    );
  }

  remove(rowKey: string): void {
    this.rows.update((rows) => rows.filter((r) => r.rowKey !== rowKey));
  }
}
