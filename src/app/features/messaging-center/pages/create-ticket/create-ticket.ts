import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessagingCenterCreateTicket } from '../../componentes/messaging-center-create-ticket/messaging-center-create-ticket';
import {
  LINKED_ITEM_OPTIONS,
  PARTICIPANT_TYPE_OPTIONS,
  TICKET_CATEGORY_OPTIONS,
  VENDOR_OPTIONS,
} from '../../data/mock-messaging-center';
import {
  CreateTicketForm,
  ParticipantType,
  TicketCategory,
  SENDER_ROLE_KEYS,
  TICKET_CATEGORY_KEYS,
} from '../../models/messaging-center.model';
import { MessagingCenterStore } from '../../services/messaging-center-store';
import { I18nService } from '../../../../shared/i18n/i18n.service';

@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  imports: [CommonModule, MessagingCenterCreateTicket],
  templateUrl: './create-ticket.html',
  styleUrl: './create-ticket.scss',
})
export class CreateTicketPage {
  private readonly store = inject(MessagingCenterStore);
  private readonly i18n = inject(I18nService);

  // p-select renders plain strings, so these have to be recomputed on a
  // language switch — the pipe never sees them.
  readonly participantTypeOptions = computed(() =>
    PARTICIPANT_TYPE_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(SENDER_ROLE_KEYS[o.value as ParticipantType]),
    })),
  );

  readonly categoryOptions = computed(() =>
    TICKET_CATEGORY_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(TICKET_CATEGORY_KEYS[o.value as TicketCategory]),
    })),
  );

  // Vendor names and linked-item references are data, not chrome — no catalog.
  readonly vendorOptions = VENDOR_OPTIONS;
  readonly linkedItemOptions = LINKED_ITEM_OPTIONS;

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
