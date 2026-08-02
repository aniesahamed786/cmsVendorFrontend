import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PrimeUIModules } from '../../../../core/prime.import';
import {
  MessageAttachment,
  ParticipantType,
  TicketStatus,
  TicketCategory,
  SENDER_ROLE_KEYS,
  TICKET_STATUS_KEYS,
  TICKET_CATEGORY_KEYS,
} from '../../models/messaging-center.model';
import { MessagingCenterStore } from '../../services/messaging-center-store';
import { DialogModule } from 'primeng/dialog';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { Button } from '../../../../shared/Components/button/button';

@Component({
  selector: 'app-messaging-center-ticket-details',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, DialogModule, Button, TranslatePipe],
  templateUrl: './messaging-center-ticket-details.html',
  styleUrl: './messaging-center-ticket-details.scss',
})
export class MessagingCenterTicketDetails {
  readonly store = inject(MessagingCenterStore);

  readonly ticket = this.store.selectedTicket;
  readonly messages = this.store.selectedMessages;

  readonly draft = signal<string>('');

  // readonly attachments = signal<{ name: string; url: string }[]>([]);
  readonly attachments = signal<File[]>([]);

  displayFilePopup = false;
  readonly selectedFileUrl = signal<string | null>(null);

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    // Scroll to the newest message whenever the thread changes.
    effect(() => {
      this.messages();
      this.ticket();
      untracked(() => setTimeout(() => this.scrollToBottom(), 0));
    });


  }

  statusKey(status: TicketStatus): string {
    return TICKET_STATUS_KEYS[status];
  }

  categoryKey(category: TicketCategory): string {
    return TICKET_CATEGORY_KEYS[category];
  }

  roleKey(role: string): string {
    const key = (role.charAt(0).toUpperCase() + role.slice(1)) as keyof typeof SENDER_ROLE_KEYS;
    return SENDER_ROLE_KEYS[key];
  }

  onSend(): void {
    const text = this.draft().trim();
    const files = this.attachments();
    if (!text && files.length === 0) {
      return;
    }

    this.store.sendMessage(text, false, files);

    this.draft.set('');
    this.clearAttachments();
    this.draft.set('');
    this.clearAttachments();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onClose(): void {
    const t = this.ticket();
    if (t) {
      this.store.closeTicket(t.id);
    }
  }

  onAttachClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  // onFilesSelected(event: Event): void {
  //   const input = event.target as HTMLInputElement;
  //   const files = input.files ? Array.from(input.files) : [];
  //   for (const file of files) {
  //     if (this.attachments().length >= 5) {
  //       break;
  //     }
  //     this.attachments.update((list) => [
  //       ...list,
  //       { name: file.name, url: URL.createObjectURL(file) },
  //     ]);
  //   }
  //   input.value = '';
  // }

  onFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];

  this.attachments.update(existing => {
    const remaining = 5 - existing.length;
    return [...existing, ...files.slice(0, remaining)];
  });

  input.value = '';
}

 removeAttachment(index: number): void {
  this.attachments.update(list =>
    list.filter((_, i) => i !== index)
  );
}

 private clearAttachments(): void {
  this.attachments.set([]);
}

  openPreview(url: string | undefined): void {
    if (!url) return;
    this.selectedFileUrl.set(url);
    this.displayFilePopup = true;
  }

  private scrollToBottom(): void {
    const el = this.thread()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
