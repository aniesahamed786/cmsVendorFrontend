import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import {
  CreateTicketForm,
  ParticipantType,
  SelectOption,
  TicketCategory,
} from '../../models/messaging-center.model';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { Button } from '../../../../shared/Components/button/button';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { CancelButton } from '../../../../shared/Components/cancel-button/cancel-button';

@Component({
  selector: 'app-messaging-center-create-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, Button, BackButton, CancelButton, TranslatePipe],
  templateUrl: './messaging-center-create-ticket.html',
  styleUrl: './messaging-center-create-ticket.scss',
})
export class MessagingCenterCreateTicket {
  readonly participantTypeOptions = input<SelectOption[]>([]);
  readonly vendorOptions = input<SelectOption[]>([]);
  readonly ticketTypeOptions = input<SelectOption[]>([]);
  readonly categoryOptions = input<SelectOption[]>([]);
  readonly categoriesLoading = input<boolean>(false);
  readonly linkedItemOptions = input<SelectOption[]>([]);
  readonly saving = input<boolean>(false);

  readonly submitTicket = output<CreateTicketForm>();
  readonly cancel = output<void>();
  readonly back = output<void>();

  readonly participantType = signal<ParticipantType | null>('Vendor');
  readonly sendTo = signal<string | null>('Admin');
  readonly title = signal<string>('');
  readonly ticketType = signal<TicketCategory | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly linkedItem = signal<string | null>(null);
  readonly description = signal<string>('');

  readonly attachments = signal<File[]>([]);
  readonly attachmentNames = signal<string[]>([]);

  readonly showCategory = computed(() => this.ticketType() === 'Suggestion');
  readonly submitted = signal(false);
  readonly titleMissing = computed(() => !this.title().trim());
  readonly typeMissing = computed(() => !this.ticketType());
  readonly categoryMissing = computed(() => this.showCategory() && !this.categoryId());
  readonly descriptionMissing = computed(() => !this.description().trim());

  readonly invalid = computed(
    () =>
      this.titleMissing() ||
      this.typeMissing() ||
      this.categoryMissing() ||
      this.descriptionMissing(),
  );

  onTicketTypeChange(value: TicketCategory | null): void {
    this.ticketType.set(value);
    if (value !== 'Suggestion') {
      this.categoryId.set(null);
    }
  }

  readonly form = computed<CreateTicketForm>(() => ({
    participantType: this.participantType(),
    sendTo: this.sendTo(),
    title: this.title(),
    ticketType: this.ticketType(),
    categoryId: this.showCategory() ? this.categoryId() : null,
    linkedItem: this.linkedItem(),
    description: this.description(),
    attachments: this.attachments(),
  }));

  onSubmit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    if (this.invalid()) return;
    this.submitTicket.emit(this.form());
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBack(): void {
    this.back.emit();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    this.attachments.set(files);
    this.attachmentNames.set(files.map(file => file.name));
  }
}
