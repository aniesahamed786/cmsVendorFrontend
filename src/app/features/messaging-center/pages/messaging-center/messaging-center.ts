import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessagingCenterList } from '../../componentes/messaging-center-list/messaging-center-list';
import { MessagingCenterTicketDetails } from '../../componentes/messaging-center-ticket-details/messaging-center-ticket-details';
import { MessagingCenterStore } from '../../services/messaging-center-store';

@Component({
  selector: 'app-messaging-center-page',
  standalone: true,
  imports: [MessagingCenterList, MessagingCenterTicketDetails],
  templateUrl: './messaging-center.html',
  styleUrl: './messaging-center.scss',
})
export class MessagingCenterPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(MessagingCenterStore);

  // The store is root-scoped and survives navigation, so every entry starts from
  // empty and refetches — no ticket from the last visit stays on screen.
  ngOnInit(): void {
    this.store.reset();

    // A browser reload opens on the empty state, not the ticket left in the URL.
    // Links from notifications (in-app navigation) still open their ticket.
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!this.router.navigated && nav?.type === 'reload' && this.route.snapshot.paramMap.has('ticketId')) {
      void this.router.navigate(['/messaging-center'], { replaceUrl: true });
      return;
    }

    this.route.paramMap.subscribe((params) => {
      const ticketId = params.get('ticketId');

      if (ticketId) {
        if (!this.store.selectTicketByReference(ticketId)) {
          this.store.refreshTickets(ticketId);
        }
        return;
      }

      this.store.clearSelectedTicket();
      if (!this.store.tickets().length) {
        this.store.refreshTickets();
      }
    });
  }

  onCreateTicket(): void {
    this.router.navigate(['/messaging-center/create']);
  }
}
