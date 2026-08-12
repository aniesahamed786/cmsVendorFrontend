import { Injectable, computed, signal } from '@angular/core';
import {
  CreateTicketForm,
  SortOrder,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketTabKey,
} from '../models/messaging-center.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { finalize } from 'rxjs';
import { inject } from '@angular/core';
import { environment } from '../../../../environments/environment';

// Socket
import { MessagingSocketService } from '../services/messaging-socket.service';

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
  private readonly messagesRecord = signal<Record<string, TicketMessage[]>>({});

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

  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  // Socket Injection
  private readonly socketService = inject(MessagingSocketService);

  isLoadingTickets = signal(false);
  isLoadingMessages = signal(false);

  constructor() {
    this.socketService.connect();
    this.socketService.ticketUpdated$
      .subscribe(() => {
        this.loadTickets();
      });

    this.socketService.messageCreated$
      .subscribe((payload: any) => {
        this.loadTickets();
        const selected = this.selectedTicket();
        if (selected?.reference === payload.ticketId) {
          this.loadTicketMessages(payload.ticketId);
        }
      });
    // ponytail: no load here — the page's ngOnInit refreshes on every entry so
    // navigating away and back always re-hits the backend.
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
  // After Socket Injection
  selectTicket(id: string): void {
    const previous = this.selectedTicket();
    if (previous) {
      this.socketService.leaveTicketRoom(previous.reference);
    }

    this.selectedTicketId.set(id);
    this.patchTicket(id, { unread: false });
    const ticket = this.ticketsSignal().find(t => t.id === id);
    if (!ticket) {
      return;
    }
    this.socketService.joinTicketRoom(ticket.reference);
    this.loadTicketMessages(ticket.reference);
    // this.markTicketAsRead(ticket.reference).subscribe({
    //   next: () => this.loadTickets(),
    //   error: () => { }
    // });
  }

  /** Drops everything the root-scoped store is holding so a page entry starts empty. */
  reset(): void {
    this.ticketsSignal.set([]);
    this.messagesRecord.set({});
    this.selectedTicketId.set(null);
  }

  refreshTickets(): void {
    this.loadTickets();
  }

  refreshMessages(ticketId: string): void {
    this.loadTicketMessages(ticketId);
  }

  disconnectSocket(): void {
    this.socketService.disconnect();
  }

  sendMessage(content: string, isInternalNote: boolean, attachments: File[] = []): void {
    const ticket = this.selectedTicket();

    if (!ticket) {
      return;
    }

    const formData = new FormData();
    formData.append('text', content);
    attachments.forEach(file => {
      formData.append('attachment_file', file);
    });
    formData.forEach((value, key) => {
      console.log(key, value);
    });

    this.http.post<any>(
      `${this.baseUrl}/messaging-center/tickets/${ticket.reference}/messages`,
      formData,
    ).subscribe({
      next: response => {
        // console.log('Message Sent', response);
        // this.loadTicketMessages(ticket.reference);
        // this.loadTickets();
      },
      error: error => {
        console.error('Failed to send message', error);
      }
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

  createTicket(form: CreateTicketForm): void {
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

    this.http.post<any>(
      `${this.baseUrl}/messaging-center/tickets`,
      formData,
    ).subscribe({
      next: (response) => {
        console.log('Ticket created successfully', response);

        // Reload tickets
        // this.loadTickets();

        if (response?.data?.ticketId) {
          this.socketService.joinTicketRoom(response.data.ticketId);
        }

        // Optionally select the newly created ticket if API returns it
        this.selectedTicketId.set(response.data.id);
      },
      error: (error) => {
        console.error('Failed to create ticket', error);
      }
    });
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
    // ponytail: skeleton only when there is nothing on screen yet. loadTickets() also runs on
    // every socket event — skeletoning over a list the user is reading is the thing the
    // pattern doc forbids. finalize, not complete: complete never fires after an error.
    this.isLoadingTickets.set(this.ticketsSignal().length === 0);
    this.getTickets()
      .pipe(finalize(() => this.isLoadingTickets.set(false)))
      .subscribe({
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
    const params = new HttpParams().set('pageSize', pageSize);

    return this.http.get<any>(
      `${this.baseUrl}/messaging-center/tickets`,
      {
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

  getTicketMessages(ticketId: string, pageSize: number = 20) {
    const params = new HttpParams().set('pageSize', pageSize);
    return this.http.get<any>(
      `${this.baseUrl}/messaging-center/tickets/${ticketId}/messages`,
      {
        params
      }
    );
  }

  private loadTicketMessages(ticketId: string): void {
    // ponytail: same rule as tickets — only skeleton the thread the first time a ticket is
    // opened, never over messages already on screen (socket refreshes re-enter here).
    const selected = this.selectedTicketId();
    this.isLoadingMessages.set(!selected || !this.messagesRecord()[selected]);
    this.getTicketMessages(ticketId)
      .pipe(finalize(() => this.isLoadingMessages.set(false)))
      .subscribe({
        next: (response) => {
          const selectedId = this.selectedTicketId();
          if (!selectedId) return;
          const messages = response.data.map((message: any) =>
            this.mapTicketMessage(message)
          );
          this.messagesRecord.update(records => ({
            ...records,
            [selectedId]: messages
          }));
        },
        error: error => {
          console.error('Failed to load messages', error);
        },
      });
  }

  private mapTicketMessage(message: any): TicketMessage {
    return {
      id: message.id,
      authorName: message.senderType === 'admin' ? 'Admin' : message.senderName,
      senderRole: message.senderType,
      outgoing: message.senderType !== 'admin',
      timestamp: this.formatMessageDate(message.createdAt),
      body: message.text,
      isInternalNote: message.isInternalNote,
      attachments: message.fileUrls?.map((url: string) => ({
        name: url.split('/').pop() ?? '',
        url: `${this.baseUrl}${url}`
      }))
    };

  }

  private formatMessageDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  markTicketAsRead(ticketId: string) {
    return this.http.patch(
      `${this.baseUrl}/messaging-center/tickets/${ticketId}/read`,
      {},
    );
  }

  destroy(): void {
    this.socketService.disconnect();
  }
}
