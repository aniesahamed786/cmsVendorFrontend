import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import {
  SortOrder,
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketTabKey,
  TICKET_CATEGORY_KEYS,
  TICKET_STATUS_KEYS,
} from '../../models/messaging-center.model';
import {
  TICKET_SORT_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_TYPE_OPTIONS,
} from '../../data/mock-messaging-center';
import { MessagingCenterStore } from '../../services/messaging-center-store';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';

@Component({
  selector: 'app-messaging-center-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, TranslatePipe, AppSearch],
  templateUrl: './messaging-center-list.html',
  styleUrl: './messaging-center-list.scss',
})
export class MessagingCenterList {
  private readonly store = inject(MessagingCenterStore);
  private readonly i18n = inject(I18nService);

  createTicket = output<void>();

  // ===========================================================================
  // ARTIFICIAL LOADING — DELETE WHEN THE API IS WIRED
  // ---------------------------------------------------------------------------
  // The store is a synchronous in-memory array, so there is no real load to wait
  // for. This timer fakes one purely so the ticket-list skeleton is reachable and
  // reviewable. When the real fetch lands: delete the setTimeout below, and flip
  // `loading` to false in the store's subscribe instead. Keep `loading` and the
  // skeleton markup — only the timer and the initial `true` are throwaway.
  // ===========================================================================
  readonly loading = signal(true);
  private static readonly FAKE_LOAD_MS = 800; // DELETE WITH THE TIMER BELOW

  constructor() {
    // DELETE WHEN THE API IS WIRED — see the block above.
    setTimeout(() => this.loading.set(false), MessagingCenterList.FAKE_LOAD_MS);
  }

  // p-select renders plain strings, so the labels have to be recomputed on a
  // language switch — the pipe never sees them.
  readonly typeOptions = computed(() =>
    TICKET_TYPE_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(
        o.value ? TICKET_CATEGORY_KEYS[o.value as TicketCategory] : 'messaging.all',
      ),
    })),
  );

  readonly statusOptions = computed(() =>
    TICKET_STATUS_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(
        o.value ? TICKET_STATUS_KEYS[o.value as TicketStatus] : 'messaging.all',
      ),
    })),
  );

  // ponytail: never rendered — no sort control in the template. Left untranslated.
  readonly sortOptions = TICKET_SORT_OPTIONS;

  readonly tickets = this.store.filteredTickets;
  readonly selectedTicketId = this.store.selectedTicketId;
  readonly selectedType = this.store.selectedType;
  readonly selectedStatus = this.store.selectedStatus;
  readonly selectedSort = this.store.selectedSort;
  readonly activeTab = this.store.activeTab;
  readonly searchText = this.store.searchQuery;

  onTypeChange(value: string | null): void {
    this.store.setType(value);
  }

  onStatusChange(value: string | null): void {
    this.store.setStatus(value);
  }

  onSortChange(value: SortOrder | null): void {
    this.store.setSort(value);
  }

  onSearchChange(value: string): void {
    this.store.setSearch(value);
  }

  setTab(tab: TicketTabKey): void {
    this.store.setTab(tab);
  }

  onSelectTicket(ticket: Ticket): void {
    this.store.selectTicket(ticket.id);
  }

  onCreateTicket(): void {
    this.createTicket.emit();
  }

  statusKey(status: TicketStatus): string {
    return TICKET_STATUS_KEYS[status];
  }

  categoryKey(category: TicketCategory): string {
    return TICKET_CATEGORY_KEYS[category];
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress':
        return 'mc-list__badge--progress';
      case 'Closed':
        return 'mc-list__badge--closed';
      case 'New':
      default:
        return 'mc-list__badge--new';
    }
  }
}
