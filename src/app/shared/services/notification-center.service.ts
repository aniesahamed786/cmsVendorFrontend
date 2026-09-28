import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * One row from the vendor notification API. `type` splits the bell into its two
 * sections: MESSAGE → MESSAGES, SYSTEM/ADMIN → NOTIFICATIONS.
 */
export interface VendorNotification {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  image: string;
  isRead: boolean;
  createdAt: string;
  type: 'MESSAGE' | 'SYSTEM' | 'ADMIN';
  actionType: string;
  actionValue: string;
  offerId: string;
  /** Request reference on request workflow notifications. */
  requestId: string;
  /** Ticket reference on MESSAGE rows, so the bell can deep-link the ticket. */
  ticketId: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.backendUrl + environment.apiBaseUrl;

  private readonly all = signal<VendorNotification[]>([]);

  readonly loading = signal(false);

  readonly messages = computed(() => this.all().filter((n) => n.type === 'MESSAGE'));
  readonly notifications = computed(() => this.all().filter((n) => n.type !== 'MESSAGE'));

  readonly unreadCount = computed(() => this.all().filter((n) => !n.isRead).length);
  readonly hasAnyItem = computed(() => this.all().length > 0);

  load(): void {
    this.loading.set(true);
    this.http
      .get<any>(`${this.baseUrl}/notification`)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        const rows: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.all.set(
          rows
            .map((n) => this.map(n))
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
        );
        this.loading.set(false);
      });
  }

  private map(n: any): VendorNotification {
    const id = typeof n._id === 'string' ? n._id : (n._id?.$oid ?? n.id ?? '');
    const createdAt = typeof n.createdAt === 'string' ? n.createdAt : n.createdAt?.$date;
    const image = n.image ?? '';
    const type = n.type === 'MESSAGE' || n.type === 'SYSTEM' ? n.type : 'ADMIN';
    return {
      id,
      title: n.title ?? '',
      titleAr: n.title_ar ?? '',
      description: n.description ?? '',
      descriptionAr: n.description_ar ?? '',
      // Relative paths come back from the media service; make them absolute.
      image: image && !/^https?:/i.test(image) ? `${this.baseUrl}${image}` : image,
      isRead: n.isRead ?? false,
      createdAt: createdAt ?? new Date().toISOString(),
      type,
      actionType: n.actionType ?? '',
      actionValue: n.actionValue ?? '',
      offerId: n.offerId ?? '',
      requestId: n.requestId ?? '',
      ticketId: n.ticketId ?? '',
    };
  }

  markAsRead(id: string): void {
    this.all.update((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    this.http
      .put(`${this.baseUrl}/notification/${id}/read`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  markAllAsRead(): void {
    this.all.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.http
      .put(`${this.baseUrl}/notification/read-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  open(notification: VendorNotification): void {
    if (!notification.isRead) {
      this.markAsRead(notification.id);
    }

    const ticketId =
      notification.ticketId ||
      (notification.type === 'MESSAGE' ? notification.actionValue : '');
    if (ticketId) {
      void this.router.navigate(['/messaging-center', ticketId]);
      return;
    }

    if (notification.type === 'MESSAGE') {
      void this.router.navigate(['/messaging-center']);
      return;
    }

    const isRequestAction = notification.actionType.toLowerCase().includes('request');
    const requestId =
      notification.requestId ||
      (isRequestAction || (notification.type === 'SYSTEM' && !notification.actionType)
        ? notification.actionValue
        : '');

    if (requestId) {
      void this.router.navigate(['/request-center', requestId]);
      return;
    }

    if (isRequestAction) {
      void this.router.navigate(['/request-center']);
      return;
    }

    const offerId =
      notification.offerId ||
      (notification.actionType === 'Open Specific Offer' ? notification.actionValue : '');

    if (offerId) {
      void this.router.navigate(['/offers', offerId]);
    } else if (notification.actionType === 'Open External link' && notification.actionValue) {
      window.open(notification.actionValue, '_blank', 'noopener');
    }
  }
}
