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
  readonly store = inject(MessagingCenterStore);

  // The store is root-scoped and survives navigation, so every entry starts from
  // empty and refetches — no ticket from the last visit stays on screen.
  ngOnInit(): void {
    this.store.reset();
    this.store.refreshTickets();
  }

  onCreateTicket(): void {
    this.router.navigate(['/messaging-center/create']);
  }
}
