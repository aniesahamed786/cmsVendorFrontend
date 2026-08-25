import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, finalize, tap } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  CreateTicketForm,
  SortOrder,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketTabKey,
} from '../models/messaging-center.model';
import { environment } from '../../../../environments/environment';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { MessagingSocketService } from '../services/messaging-socket.service';
import { AuthService } from '../../../core/services/auth.service';

export interface NextPageToken {
  updatedAt?: string;
  docId?: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingCenterStore {
  private readonly ticketsSignal = signal<Ticket[]>([]);
  private readonly messagesRecord = signal<Record<string, TicketMessage[]>>({});

  readonly tickets = this.ticketsSignal.asReadonly();
  readonly filteredTickets = this.ticketsSignal.asReadonly();

  readonly selectedTicketId = signal<string | null>(null);

  // Filter state
  readonly searchQuery = signal('');
  readonly selectedType = signal<string | null>(null);
  readonly selectedStatus = signal<string | null>(null);
  readonly selectedSort = signal<SortOrder | null>(null);
  readonly activeTab = signal<TicketTabKey>('all');

  // Pagination cursor state
  readonly nextPageToken = signal<NextPageToken | null>(null);
  readonly hasMoreTickets = computed(() => !!this.nextPageToken());

  // Loading signals
  readonly isLoadingTickets = signal(false);
  readonly isLoadingMoreTickets = signal(false);
  readonly isLoadingMessages = signal(false);

  private readonly searchSubject = new Subject<string>();

  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;
  private readonly socketService = inject(MessagingSocketService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  constructor() {
    this.socketService.connect();

    this.socketService.ticketUpdated$.subscribe(() => {
      this.refreshSilently();
    });

    this.socketService.messageCreated$.subscribe((payload: any) => {
      this.refreshSilently();
      const selected = this.selectedTicket();
      if (selected?.reference === payload.ticketId) {
        this.loadTicketMessages(payload.ticketId);
      }
    });

    // Debounce search typing
    this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.loadTickets(true);
      });
  }

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
    this.searchSubject.next(value);
  }

  setType(value: string | null): void {
    this.selectedType.set(value);
    this.loadTickets(true);
  }

  setStatus(value: string | null): void {
    this.selectedStatus.set(value);
    this.loadTickets(true);
  }

  setSort(value: SortOrder | null): void {
    this.selectedSort.set(value);
    this.loadTickets(true);
  }

  setTab(tab: TicketTabKey): void {
    this.activeTab.set(tab);
    this.loadTickets(true);
  }

  clearFilters(): void {
    this.selectedType.set(null);
    this.selectedStatus.set(null);
    this.loadTickets(true);
  }

  // --- Ticket actions --------------------------------------------------------

  selectTicket(id: string): void {
    const previous = this.selectedTicket();
    if (previous) {
      this.socketService.leaveTicketRoom(previous.reference);
    }

    this.selectedTicketId.set(id);
    this.messagesRecord.update(({ [id]: _dropped, ...rest }) => rest);
    this.patchTicket(id, { unread: false });

    const ticket = this.ticketsSignal().find((t) => t.id === id);
    if (!ticket) {
      return;
    }

    this.socketService.joinTicketRoom(ticket.reference);
    this.loadTicketMessages(ticket.reference);
  }

  /** Drops everything the root-scoped store is holding so a page entry starts empty. */
  reset(): void {
    this.ticketsSignal.set([]);
    this.messagesRecord.set({});
    this.selectedTicketId.set(null);
    this.nextPageToken.set(null);
    this.searchQuery.set('');
    this.selectedType.set(null);
    this.selectedStatus.set(null);
    this.selectedSort.set(null);
    this.activeTab.set('all');
  }

  refreshTickets(): void {
    this.loadTickets(true);
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
    attachments.forEach((file) => {
      formData.append('attachment_file', file);
    });

    const pendingId = `pending-${Date.now()}`;
    const pending: TicketMessage = {
      id: pendingId,
      authorName: this.i18n.t('messaging.details.you'),
      senderRole: 'Vendor',
      outgoing: true,
      timestamp: this.formatMessageDate(new Date().toISOString()),
      body: content,
      isInternalNote,
      attachments: attachments.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
      pending: true,
    };
    this.messagesRecord.update((records) => ({
      ...records,
      [ticket.id]: [...(records[ticket.id] ?? []), pending],
    }));

    this.http
      .post<any>(
        `${this.baseUrl}/messaging-center/tickets/${ticket.reference}/messages`,
        formData,
      )
      .subscribe({
        next: () => {
          this.messagesRecord.update((records) => ({
            ...records,
            [ticket.id]: (records[ticket.id] ?? []).map((m) =>
              m.id === pendingId ? { ...m, pending: false } : m,
            ),
          }));
        },
        error: (error) => {
          console.error('Failed to send message', error);
          this.messagesRecord.update((records) => ({
            ...records,
            [ticket.id]: (records[ticket.id] ?? []).filter((m) => m.id !== pendingId),
          }));
        },
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

  createTicket(form: CreateTicketForm): Observable<any> {
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    const ticketType = form.ticketType ?? 'Technical';
    formData.append('ticketType', ticketType);
    formData.append('status', 'new');

    if (ticketType === 'Suggestion' && form.categoryId) {
      formData.append('category', form.categoryId);
    }

    if (ticketType === 'VendorIssue') {
      const vendorId = this.auth.getVendorId();
      if (vendorId) formData.append('vendorId', vendorId);
    }

    if (form.attachments?.length) {
      form.attachments.forEach((file) => {
        formData.append('attachment_file', file);
      });
    }

    return this.http
      .post<any>(`${this.baseUrl}/messaging-center/tickets`, formData)
      .pipe(
        tap((response) => {
          if (response?.data?.ticketId) {
            this.socketService.joinTicketRoom(response.data.ticketId);
          }
          if (response?.data?.id) {
            this.selectedTicketId.set(response.data.id);
          }
          this.loadTickets(true);
        }),
      );
  }

  // --- Fetching & Pagination -------------------------------------------------

  loadTickets(showSkeleton: boolean = true): void {
    if (showSkeleton) {
      this.isLoadingTickets.set(true);
    }
    this.nextPageToken.set(null);

    this.getTickets({ pageSize: 20 })
      .pipe(finalize(() => this.isLoadingTickets.set(false)))
      .subscribe({
        next: (response) => {
          const rawTickets = Array.isArray(response?.data) ? response.data : [];
          const tickets = rawTickets.map((ticket: any, index: number) =>
            this.mapTicket(ticket, index),
          );

          this.ticketsSignal.set(tickets);
          this.nextPageToken.set(this.extractNextPageToken(response));
        },
        error: (error) => {
          console.error('Failed to load tickets', error);
          this.ticketsSignal.set([]);
          this.nextPageToken.set(null);
        },
      });
  }

  loadMoreTickets(): void {
    if (this.isLoadingTickets() || this.isLoadingMoreTickets()) {
      return;
    }

    const token = this.nextPageToken();
    if (!token) {
      return;
    }

    this.isLoadingMoreTickets.set(true);
    this.getTickets({
      pageSize: 20,
      updatedAt: token.updatedAt,
      docId: token.docId,
    })
      .pipe(finalize(() => this.isLoadingMoreTickets.set(false)))
      .subscribe({
        next: (response) => {
          const rawTickets = Array.isArray(response?.data) ? response.data : [];
          const currentIndex = this.ticketsSignal().length;
          const newTickets = rawTickets.map((ticket: any, index: number) =>
            this.mapTicket(ticket, currentIndex + index),
          );

          this.ticketsSignal.update((existing) => [...existing, ...newTickets]);
          this.nextPageToken.set(this.extractNextPageToken(response));
        },
        error: (error) => {
          console.error('Failed to load more tickets', error);
        },
      });
  }

  private refreshSilently(): void {
    this.getTickets({ pageSize: 20 }).subscribe({
      next: (response) => {
        const rawTickets = Array.isArray(response?.data) ? response.data : [];
        const tickets = rawTickets.map((ticket: any, index: number) =>
          this.mapTicket(ticket, index),
        );
        this.ticketsSignal.set(tickets);
        this.nextPageToken.set(this.extractNextPageToken(response));
      },
      error: (error) => {
        console.error('Failed to silently refresh tickets', error);
      },
    });
  }

  getTickets(options: {
    pageSize?: number;
    updatedAt?: string;
    docId?: string;
  } = {}) {
    const { pageSize = 20, updatedAt, docId } = options;
    let params = new HttpParams().set('pageSize', pageSize);

    if (updatedAt) {
      params = params.set('updatedAt', updatedAt);
    }
    if (docId) {
      params = params.set('docId', docId);
    }

    const searchTerm = this.searchQuery().trim();
    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }

    const type = this.selectedType();
    if (type) {
      params = params.set('type', type);
    }

    const status = this.selectedStatus();
    if (status) {
      params = params.set('status', status);
    }

    const sortOrder = this.selectedSort();
    if (sortOrder) {
      params = params.set('sortOrder', sortOrder);
    }

    const tab = this.activeTab();
    if (tab === 'read') {
      params = params.set('readStatus', 'read');
    } else if (tab === 'unread') {
      params = params.set('readStatus', 'unread');
    }

    return this.http.get<any>(`${this.baseUrl}/messaging-center/tickets`, {
      params,
    });
  }

  private extractNextPageToken(response: any): NextPageToken | null {
    const token = response?.nextPageToken ?? response?.pagination?.nextPageToken;
    if (!token) return null;
    if (typeof token === 'object' && (token.updatedAt || token.docId)) {
      return {
        updatedAt: token.updatedAt,
        docId: token.docId,
      };
    }
    return null;
  }

  // --- Helpers ---------------------------------------------------------------

  private patchTicket(ticketId: string, patch: Partial<Ticket>): void {
    this.ticketsSignal.update((list) =>
      list.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)),
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
      timeAgo: this.getTimeAgo(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt),
      unread: ticket.unreadCount_vendor > 0 || ticket.unreadCount_admin > 0 || ticket.unread === true,
      order: index + 1,
    };
  }

  private mapStatus(status: string): TicketStatus {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'New';

      case 'inprogress':
      case 'in progress':
        return 'In Progress';

      case 'closed':
        return 'Closed';

      default:
        return 'New';
    }
  }

  private formatApiDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private getTimeAgo(date: string): string {
    if (!date) return '';
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
        params,
      },
    );
  }

  private loadTicketMessages(ticketId: string): void {
    const selected = this.selectedTicketId();
    this.isLoadingMessages.set(!selected || !this.messagesRecord()[selected]);
    this.getTicketMessages(ticketId)
      .pipe(finalize(() => this.isLoadingMessages.set(false)))
      .subscribe({
        next: (response) => {
          const selectedId = this.selectedTicketId();
          if (!selectedId) return;
          const messages = response.data.map((message: any) =>
            this.mapTicketMessage(message),
          );
          this.messagesRecord.update((records) => ({
            ...records,
            [selectedId]: messages,
          }));
        },
        error: (error) => {
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
        url: `${this.baseUrl}${url}`,
      })),
    };
  }

  private formatMessageDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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

