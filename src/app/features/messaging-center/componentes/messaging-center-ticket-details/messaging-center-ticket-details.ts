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
import { MessageAttachment } from '../../models/messaging-center.model';
import { ASSIGNEE_OPTIONS } from '../../data/mock-messaging-center';
import { MessagingCenterStore } from '../../services/messaging-center-store';

@Component({
  selector: 'app-messaging-center-ticket-details',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules],
  templateUrl: './messaging-center-ticket-details.html',
  styleUrl: './messaging-center-ticket-details.scss',
})
export class MessagingCenterTicketDetails {
  private readonly store = inject(MessagingCenterStore);

  readonly assigneeOptions = ASSIGNEE_OPTIONS;
  readonly ticket = this.store.selectedTicket;
  readonly messages = this.store.selectedMessages;

  readonly draft = signal<string>('');

  readonly attachments = signal<{ name: string; url: string }[]>([]);

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    // Scroll to the newest message whenever the thread changes.
    effect(() => {
      this.messages();
      this.ticket();
      untracked(() => setTimeout(() => this.scrollToBottom(), 0));
    });


  }

  onAssignChange(value: string): void {
    const t = this.ticket();
    if (t) {
      this.store.assignTicket(t.id, value);
    }
  }

  onSend(): void {
    const text = this.draft().trim();
    const files: MessageAttachment[] = this.attachments().map((a) => ({
      name: a.name,
      url: a.url,
    }));
    if (!text && files.length === 0) {
      return;
    }
    this.store.sendMessage(text, false, files);
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

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    for (const file of files) {
      if (this.attachments().length >= 5) {
        break;
      }
      this.attachments.update((list) => [
        ...list,
        { name: file.name, url: URL.createObjectURL(file) },
      ]);
    }
    input.value = '';
  }

  removeAttachment(index: number): void {
    const removed = this.attachments()[index];
    if (removed) {
      URL.revokeObjectURL(removed.url);
    }
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  private clearAttachments(): void {
    this.attachments().forEach((a) => URL.revokeObjectURL(a.url));
    this.attachments.set([]);
  }

  private scrollToBottom(): void {
    const el = this.thread()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
