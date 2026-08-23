import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
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
import {
  TicketCategoryRecord,
  TicketCategoryService,
} from '../../services/ticket-category.service';
import { I18nService } from '../../../../shared/i18n/i18n.service';

@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  imports: [CommonModule, MessagingCenterCreateTicket],
  templateUrl: './create-ticket.html',
  styleUrl: './create-ticket.scss',
})
export class CreateTicketPage implements OnInit {
  private readonly store = inject(MessagingCenterStore);
  private readonly categoryApi = inject(TicketCategoryService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  readonly saving = signal(false);

  // p-select renders plain strings, so these have to be recomputed on a
  // language switch — the pipe never sees them.
  readonly participantTypeOptions = computed(() =>
    PARTICIPANT_TYPE_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(SENDER_ROLE_KEYS[o.value as ParticipantType]),
    })),
  );

  readonly ticketTypeOptions = computed(() =>
    TICKET_CATEGORY_OPTIONS.map((o) => ({
      ...o,
      label: this.i18n.t(TICKET_CATEGORY_KEYS[o.value as TicketCategory]),
    })),
  );

  private readonly categories = signal<TicketCategoryRecord[]>([]);
  readonly categoriesLoading = signal(false);

  readonly categoryOptions = computed(() => {
    const arabic = this.i18n.lang() === 'ar';
    return this.categories().map((c) => ({
      label: (arabic ? c.nameAr || c.name : c.name || c.nameAr).trim(),
      value: c.id,
    }));
  });

  // Vendor names and linked-item references are data, not chrome — no catalog.
  readonly vendorOptions = VENDOR_OPTIONS;
  readonly linkedItemOptions = LINKED_ITEM_OPTIONS;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.categoriesLoading.set(true);
    this.categoryApi
      .list()
      .pipe(finalize(() => this.categoriesLoading.set(false)))
      .subscribe({ next: (rows) => this.categories.set(rows) });
  }

  onSubmit(form: CreateTicketForm): void {
    if (this.saving()) return;

    // Map the selected vendor value to its display label for the ticket target.
    const target =
      this.vendorOptions.find((v) => v.value === form.sendTo)?.label ?? form.sendTo;

    this.saving.set(true);
    this.store
      .createTicket({ ...form, sendTo: target })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/messaging-center']),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to create ticket', err);
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('messaging.create.toast.failedSummary'),
            detail:
              extractApiErrorMessage(err) ?? this.i18n.t('messaging.create.toast.failedDetail'),
            life: 8000,
            closable: true,
          });
        },
      });
  }

  onCancel(): void {
    if (this.saving()) return;
    this.router.navigate(['/messaging-center']);
  }

  onBack(): void {
    if (this.saving()) return;
    this.router.navigate(['/messaging-center']);
  }
}
