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
      // The image proxy already adds the CMS vendor API path.
      image: image && !/^https?:/i.test(image) ? `${environment.backendUrl}${image}` : image,
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

  isRequestNotification(notification: VendorNotification): boolean {
    return (
      !!notification.requestId ||
      notification.actionType.toLowerCase().includes('request') ||
      (notification.type === 'SYSTEM' && !notification.actionType && !!notification.actionValue)
    );
  }

  open(notification: VendorNotification): void {
    if (!notification.isRead) {
      this.markAsRead(notification.id);
    }

    const target = this.target(notification);
    if (target?.route) {
      void this.router.navigate(target.route);
    } else if (target?.url) {
      window.open(target.url, '_blank', 'noopener');
    }
  }

  /**
   * Where a row leads, and the `notifications.goTo.*` key naming it. `open()` and the row's
   * "View in …" hint both read this, so the label can't promise a page the click doesn't open.
   */
  target(
    notification: VendorNotification,
  ): { labelKey: string; route?: string[]; url?: string } | null {
    const ticketId =
      notification.ticketId ||
      (notification.type === 'MESSAGE' ? notification.actionValue : '');
    if (ticketId) {
      return { labelKey: 'notifications.goTo.messagingCenter', route: ['/messaging-center', ticketId] };
    }

    if (notification.type === 'MESSAGE') {
      return { labelKey: 'notifications.goTo.messagingCenter', route: ['/messaging-center'] };
    }

    const isRequestAction = this.isRequestNotification(notification);
    const requestId =
      notification.requestId ||
      (isRequestAction || (notification.type === 'SYSTEM' && !notification.actionType)
        ? notification.actionValue
        : '');

    if (requestId) {
      return { labelKey: 'notifications.goTo.requestCenter', route: ['/request-center', requestId] };
    }

    if (isRequestAction) {
      return { labelKey: 'notifications.goTo.requestCenter', route: ['/request-center'] };
    }

    const offerId =
      notification.offerId ||
      (notification.actionType === 'Open Specific Offer' ? notification.actionValue : '');

    if (offerId) {
      return { labelKey: 'notifications.goTo.offer', route: ['/offers', offerId] };
    }

    if (notification.actionType === 'Open External link' && notification.actionValue) {
      const externalUrl = this.normalizeExternalUrl(notification.actionValue);
      if (externalUrl) {
        return { labelKey: 'notifications.goTo.externalLink', url: externalUrl };
      }
    }

    return null;
  }

  private normalizeExternalUrl(value: string): string | null {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    // Also tolerate a Markdown-formatted link if one is returned by the API.
    const markdownLink = trimmedValue.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
    const link = markdownLink?.[1] ?? trimmedValue;
    const absoluteLink = /^https?:\/\//i.test(link)
      ? link
      : link.startsWith('//')
        ? `https:${link}`
        : `https://${link}`;

    try {
      const url = new URL(absoluteLink);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
