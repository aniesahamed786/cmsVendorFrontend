import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import {
  SortOrder,
  Ticket,
  TicketTabKey,
} from '../../models/messaging-center.model';
import {
  TICKET_SORT_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_TYPE_OPTIONS,
} from '../../data/mock-messaging-center';
import { MessagingCenterStore } from '../../services/messaging-center-store';

@Component({
  selector: 'app-messaging-center-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules],
  templateUrl: './messaging-center-list.html',
  styleUrl: './messaging-center-list.scss',
})
export class MessagingCenterList {
  private readonly store = inject(MessagingCenterStore);

  createTicket = output<void>();

  readonly typeOptions = TICKET_TYPE_OPTIONS;
  readonly statusOptions = TICKET_STATUS_OPTIONS;
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

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress':
        return 'mc-list__badge--progress';
      case 'Resolved':
        return 'mc-list__badge--resolved';
      case 'Closed':
        return 'mc-list__badge--closed';
      case 'New':
      default:
        return 'mc-list__badge--new';
    }
  }
}
