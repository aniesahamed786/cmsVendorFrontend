import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessagingCenterList } from '../../componentes/messaging-center-list/messaging-center-list';
import { MessagingCenterTicketDetails } from '../../componentes/messaging-center-ticket-details/messaging-center-ticket-details';

@Component({
  selector: 'app-messaging-center-page',
  standalone: true,
  imports: [MessagingCenterList, MessagingCenterTicketDetails],
  templateUrl: './messaging-center.html',
  styleUrl: './messaging-center.scss',
})
export class MessagingCenterPage {
  private readonly router = inject(Router);

  onCreateTicket(): void {
    this.router.navigate(['/messaging-center/create']);
  }
}
