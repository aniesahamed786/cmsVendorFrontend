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

@Component({
  selector: 'app-messaging-center-create-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, TranslatePipe],
  templateUrl: './messaging-center-create-ticket.html',
  styleUrl: './messaging-center-create-ticket.scss',
})
export class MessagingCenterCreateTicket {
  readonly participantTypeOptions = input<SelectOption[]>([]);
  readonly vendorOptions = input<SelectOption[]>([]);
  readonly categoryOptions = input<SelectOption[]>([]);
  readonly linkedItemOptions = input<SelectOption[]>([]);

  readonly submitTicket = output<CreateTicketForm>();
  readonly cancel = output<void>();
  readonly back = output<void>();

  readonly participantType = signal<ParticipantType | null>('Vendor');
  readonly sendTo = signal<string | null>('Admin');
  readonly title = signal<string>('');
  readonly ticketType = signal<TicketCategory | null>(null);
  readonly linkedItem = signal<string | null>(null);
  readonly description = signal<string>('');

  readonly attachmentNames = signal<string[]>([]);

  readonly form = computed<CreateTicketForm>(() => ({
    participantType: this.participantType(),
    sendTo: this.sendTo(),
    title: this.title(),
    ticketType: this.ticketType(),
    linkedItem: this.linkedItem(),
    description: this.description(),
  }));

  onSubmit(): void {
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
    this.attachmentNames.set(files.map((f) => f.name));
  }
}
