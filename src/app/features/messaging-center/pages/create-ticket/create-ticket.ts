import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessagingCenterCreateTicket } from '../../componentes/messaging-center-create-ticket/messaging-center-create-ticket';
import {
  LINKED_ITEM_OPTIONS,
  PARTICIPANT_TYPE_OPTIONS,
  TICKET_CATEGORY_OPTIONS,
  VENDOR_OPTIONS,
} from '../../data/mock-messaging-center';
import { CreateTicketForm } from '../../models/messaging-center.model';
import { MessagingCenterStore } from '../../services/messaging-center-store';

@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  imports: [CommonModule, MessagingCenterCreateTicket],
  templateUrl: './create-ticket.html',
  styleUrl: './create-ticket.scss',
})
export class CreateTicketPage {
  readonly participantTypeOptions = PARTICIPANT_TYPE_OPTIONS;
  readonly vendorOptions = VENDOR_OPTIONS;
  readonly categoryOptions = TICKET_CATEGORY_OPTIONS;
  readonly linkedItemOptions = LINKED_ITEM_OPTIONS;

  private readonly store = inject(MessagingCenterStore);

  constructor(private readonly router: Router) {}

  onSubmit(form: CreateTicketForm): void {
    // Map the selected vendor value to its display label for the ticket target.
    const target =
      this.vendorOptions.find((v) => v.value === form.sendTo)?.label ?? form.sendTo;
    this.store.createTicket({ ...form, sendTo: target });
    this.router.navigate(['/messaging-center']);
  }

  onCancel(): void {
    this.router.navigate(['/messaging-center']);
  }

  onBack(): void {
    this.router.navigate(['/messaging-center']);
  }
}
