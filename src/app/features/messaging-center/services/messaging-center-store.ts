import { Injectable, computed, signal } from '@angular/core';
import {
  CreateTicketForm,
  MessageAttachment,
  SortOrder,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketTabKey,
} from '../models/messaging-center.model';
import {
  CURRENT_AGENT,
  MOCK_MESSAGES,
  MOCK_TICKETS,
} from '../data/mock-messaging-center';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../../environments/environment';

/**
 * In-memory store for the messaging center. Mirrors the admin app's
 * MessageService + SendMessage behaviour (select, filter, send, assign,
 * status, create) without any backend/socket/auth dependency.
 */
@Injectable({ providedIn: 'root' })
export class MessagingCenterStore {
  // private readonly ticketsSignal = signal<Ticket[]>(
  //   MOCK_TICKETS.map((t) => ({ ...t })),
  // );
  private readonly ticketsSignal = signal<Ticket[]>([]);
  private readonly messagesRecord = signal<Record<string, TicketMessage[]>>(
    structuredClone(MOCK_MESSAGES),
  );

  readonly tickets = this.ticketsSignal.asReadonly();
  // No auto-select: the details pane shows its "select a ticket" empty state until
  // the user picks one. selectTicket()/createTicket() are the only things that set it.
  readonly selectedTicketId = signal<string | null>(null);

  // Filter state
  readonly searchQuery = signal('');
  readonly selectedType = signal<string | null>(null);
  readonly selectedStatus = signal<string | null>(null);
  readonly selectedSort = signal<SortOrder | null>(null);
  readonly activeTab = signal<TicketTabKey>('all');

  private nextReference = 11;
  private nextMessageId = 1;
  
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  constructor() {
  this.loadTickets();
}

  readonly filteredTickets = computed<Ticket[]>(() => {
    const type = this.selectedType();
    const status = this.selectedStatus();
    const tab = this.activeTab();
    const term = this.searchQuery().trim().toLowerCase();
    const sort = this.selectedSort();

    let list = this.ticketsSignal().filter((ticket) => {
      if (tab === 'unread' && !ticket.unread) return false;
      if (tab === 'read' && ticket.unread) return false;
      if (type && ticket.category !== type) return false;
      if (status && ticket.status !== status) return false;
      if (term) {
        const haystack = [
          ticket.title,
          ticket.preview,
          ticket.reference,
          ticket.createdByName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) =>
      sort === 'oldest' ? a.order - b.order : b.order - a.order,
    );
    return list;
  });

  readonly selectedTicket = computed<Ticket | null>(() => {
    const id = this.selectedTicketId();
    return id ? this.ticketsSignal().find((t) => t.id === id) ?? null : null;
  });

  readonly selectedMessages = computed<TicketMessage[]>(() => {
    const id = this.selectedTicketId();
    return id ? this.messagesRecord()[id] ?? [] : [];
  });

  // --- Filters ---------------------------------------------------------------

  setSearch(value: string): void {
    this.searchQuery.set(value);
  }

  setType(value: string | null): void {
    this.selectedType.set(value);
  }

  setStatus(value: string | null): void {
    this.selectedStatus.set(value);
  }

  setSort(value: SortOrder | null): void {
    this.selectedSort.set(value);
  }

  setTab(tab: TicketTabKey): void {
    this.activeTab.set(tab);
  }

  // --- Ticket actions --------------------------------------------------------

  selectTicket(id: string): void {
    this.selectedTicketId.set(id);
    this.patchTicket(id, { unread: false });
  }

  sendMessage(
    content: string,
    isInternalNote: boolean,
    attachments: MessageAttachment[] = [],
  ): void {
    const ticketId = this.selectedTicketId();
    if (!ticketId) return;
    const text = content.trim();
    if (!text && attachments.length === 0) return;

    const message: TicketMessage = {
      id: `m-${this.nextMessageId++}`,
      authorName: CURRENT_AGENT,
      senderRole: isInternalNote ? 'System' : 'Admin',
      outgoing: true,
      timestamp: this.formatNow(),
      body: text,
      isInternalNote,
      attachments: attachments.length ? attachments : undefined,
    };

    this.messagesRecord.update((records) => ({
      ...records,
      [ticketId]: [...(records[ticketId] ?? []), message],
    }));

    // Internal notes don't change the ticket's preview / ordering.
    if (isInternalNote) return;

    this.patchTicket(ticketId, {
      preview: text || 'Attachment',
      timeAgo: 'Just now',
      lastUpdated: this.formatDate(),
      updatedBy: { name: CURRENT_AGENT, role: 'Admin' },
    });
  }

  assignTicket(ticketId: string, assignee: string): void {
    if (assignee === 'Unassigned') {
      this.patchTicket(ticketId, { assignedTo: 'Unassigned', status: 'New' });
      return;
    }
    const next: Partial<Ticket> = { assignedTo: assignee };
    const current = this.ticketsSignal().find((t) => t.id === ticketId);
    if (current && current.status === 'New') {
      next.status = 'In Progress';
    }
    this.patchTicket(ticketId, next);
  }

  updateStatus(ticketId: string, status: TicketStatus): void {
    this.patchTicket(ticketId, { status, lastUpdated: this.formatDate() });
  }

  closeTicket(ticketId: string): void {
    this.updateStatus(ticketId, 'Closed');
  }

  // createTicket(form: CreateTicketForm): string {
  //   const seq = this.nextReference++;
  //   const id = `tk-${String(seq).padStart(4, '0')}`;
  //   const reference = `TK-2026-${String(seq).padStart(4, '0')}`;
  //   const creatorName = form.sendTo ?? 'New Recipient';
  //   const ticket: Ticket = {
  //     id,
  //     reference,
  //     category: form.ticketType ?? 'General',
  //     title: form.title || 'Untitled ticket',
  //     status: 'New',
  //     assignedTo: 'Unassigned',
  //     createdByName: CURRENT_AGENT,
  //     createdByRole: form.participantType ?? 'Vendor',
  //     createdBy: { name: CURRENT_AGENT, role: form.participantType ?? 'Vendor' },
  //     target: creatorName,
  //     updatedBy: { name: CURRENT_AGENT, role: 'Admin' },
  //     createdDate: this.formatDate(),
  //     lastUpdated: this.formatDate(),
  //     preview: form.description || '',
  //     timeAgo: 'Just now',
  //     unread: false,
  //     order: seq,
  //   };

  //   console.log("Create Ticket", ticket)

  //   this.ticketsSignal.update((list) => [ticket, ...list]);

  //   const initial: TicketMessage[] = form.description
  //     ? [
  //         {
  //           id: `m-${this.nextMessageId++}`,
  //           authorName: CURRENT_AGENT,
  //           senderRole: 'Admin',
  //           outgoing: true,
  //           timestamp: this.formatNow(),
  //           body: form.description,
  //           isInternalNote: false,
  //         },
  //       ]
  //     : [];
  //   this.messagesRecord.update((records) => ({ ...records, [id]: initial }));
  //   this.selectedTicketId.set(id);
  //   return id;
  // }

  createTicket(form: CreateTicketForm): void {

    const headers = new HttpHeaders({
      Accept: '*/*',
      Authorization: 'Bearer YOUR_TOKEN' // Replace with your auth service/interceptor
    });

    const formData = new FormData();

    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('ticketType', form.ticketType ?? 'Technical');
    formData.append('status', 'new');

    // Optional attachments
    if (form.attachments?.length) {
      form.attachments.forEach(file => {
        formData.append('attachment_file', file);
      });
    }

    console.log(form)

    // this.http.post<any>(
    //   `${this.baseUrl}/cmsVendor/messaging-center/tickets`,
    //   formData,
    //   { headers }
    // ).subscribe({
    //   next: (response) => {
    //     console.log('Ticket created successfully', response);

    //     // Reload tickets
    //     this.loadTickets();

    //     // Optionally select the newly created ticket if API returns it
    //     // this.selectedTicketId.set(response.data.id);
    //   },
    //   error: (error) => {
    //     console.error('Failed to create ticket', error);
    //   }
    // });

  }

  // --- Helpers ---------------------------------------------------------------

  private patchTicket(ticketId: string, patch: Partial<Ticket>): void {
    this.ticketsSignal.update((list) =>
      list.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)),
    );
  }

  private formatNow(): string {
    const d = new Date();
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
  }

  private formatDate(): string {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private loadTickets(): void {
  this.getTickets().subscribe({
    next: (response) => {
      const tickets = response.data.map((ticket: any, index: number) =>
        this.mapTicket(ticket, index)
      );

      this.ticketsSignal.set(tickets);
    },
    error: (error) => {
      console.error('Failed to load tickets', error);
    },
  });
}

  getTickets(pageSize: number = 20) {
    const headers = new HttpHeaders({
      Accept: '*/*',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTY1ZTIyNzJkODQ3MjM4ZmFjMTNiNTAiLCJ2ZW5kb3JJZCI6IjZhNWQwMzk4MTRkYjIyZTlhODYyNzQ2YiIsInJvbGVJZCI6IjZhNjVkMjVhY2NjOGJiY2JmMzlmOGI4ZCIsInJvbGVOYW1lIjoiVkVORE9SX0FETUlOIiwibmFtZSI6IkphbmUgRG9lIiwiZW1haWwiOiJqYW5lLmRvZUB2ZW5kb3IuY29tIiwidHlwZSI6InZlbmRvci1hY2NvdW50IiwiaWF0IjoxNzg1MzA1OTk0LCJleHAiOjE3ODUzMTMxOTR9.wHpIUL6e7rOwTe49a21LwMI74Pey4Cui2ElUkLcJJnk'
    });

    const params = new HttpParams().set('pageSize', pageSize);

    return this.http.get<any>(
      `${this.baseUrl}/cmsVendor/messaging-center/tickets`,
      {
        headers,
        params,
      }
    );
  }

  private mapTicket(ticket: any, index: number): Ticket {
    return {
      id: ticket.id,
      reference: ticket.ticketId,
      category: ticket.ticketType,
      title: ticket.title,
      preview: ticket.lastMessage ?? ticket.description,
      status: this.mapStatus(ticket.status),
      assignedTo: ticket.assignedToName ?? 'Unassigned',
      createdByName: ticket.createdByUsername,
      createdByRole: ticket.createdByType,
      createdBy: {
        name: ticket.createdByUsername,
        role: ticket.createdByType,
      },
      target: ticket.target,
      updatedBy: {
        name: ticket.updatedBy,
        role: 'Admin',
      },
      createdDate: this.formatApiDate(ticket.createdAt),
      lastUpdated: this.formatApiDate(ticket.updatedAt),
      timeAgo: this.getTimeAgo(ticket.lastMessageAt),
      unread: ticket.unreadCount_admin > 0,
      order: index + 1,
    };
  }

  private mapStatus(status: string): TicketStatus {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'New';

      case 'inprogress':
        return 'In Progress';

      case 'closed':
        return 'Closed';

      default:
        return 'New';
    }
  }

  private formatApiDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private getTimeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();

    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(date).toLocaleDateString();
  }
}
