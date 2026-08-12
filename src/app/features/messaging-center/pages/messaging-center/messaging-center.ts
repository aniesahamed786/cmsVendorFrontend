import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
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
  private readonly store = inject(MessagingCenterStore);

  // The store is root-scoped and survives navigation, so refetch on every entry.
  ngOnInit(): void {
    this.store.refreshTickets();
    const selected = this.store.selectedTicket();
    if (selected) {
      this.store.refreshMessages(selected.reference);
    }
  }

  onCreateTicket(): void {
    this.router.navigate(['/messaging-center/create']);
  }
}
