import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import {
  DraftBranch,
  DraftCatalogue,
  DraftErrors,
  DraftField,
  RedemptionDraftRow,
  emptyDraftCatalogue,
} from '../../utils/redemption-draft';

export interface DraftPatch {
  id: string;
  field: DraftField;
  value: unknown;
}

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-redemption-upload-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimeUIModules, Button, TranslatePipe],
  templateUrl: './redemption-upload-preview.html',
  styleUrl: './redemption-upload-preview.scss',
})
export class RedemptionUploadPreview {
  readonly visible = input<boolean>(false);
  readonly drafts = input<RedemptionDraftRow[]>([]);
  readonly catalogue = input<DraftCatalogue>(emptyDraftCatalogue());
  readonly errors = input<Map<string, DraftErrors>>(new Map());
  readonly serverErrors = input<Map<string, string>>(new Map());
  readonly branchesLoading = input<ReadonlySet<string>>(new Set<string>());
  readonly submitting = input<boolean>(false);
  readonly fileName = input<string>('');

  readonly patch = output<DraftPatch>();
  readonly removeRow = output<string>();
  readonly submitRows = output<void>();
  readonly cancel = output<void>();

  readonly transactionTypeOptions: SelectOption[] = [
    { label: 'Single Transaction', value: 'SINGLE' },
    { label: 'Collective Transaction', value: 'COLLECTIVE' },
  ];

  readonly offerOptions = computed<SelectOption[]>(() =>
    this.catalogue().offers.map((o) => ({ label: o.title, value: o.offerId })),
  );

  readonly invalidCount = computed(() => {
    const errors = this.errors();
    const server = this.serverErrors();
    return this.drafts().filter(
      (d) => Object.keys(errors.get(d.id) ?? {}).length > 0 || server.has(d.id),
    ).length;
  });

  readonly rejectedCount = computed(() => {
    const server = this.serverErrors();
    return this.drafts().filter((d) => server.has(d.id)).length;
  });

  readonly canSubmit = computed(
    () => this.drafts().length > 0 && this.invalidCount() === 0 && !this.submitting(),
  );

  readonly trackDraftById = (_index: number, draft: RedemptionDraftRow): string => draft.id;

  branchOptionsFor(draft: RedemptionDraftRow): SelectOption[] {
    if (!draft.offerId) return [];
    const branches: DraftBranch[] = this.catalogue().branchesByOffer.get(draft.offerId) ?? [];
    return branches.map((b) => ({ label: b.label, value: b.branchId }));
  }

  isBranchLoading(draft: RedemptionDraftRow): boolean {
    return !!draft.offerId && this.branchesLoading().has(draft.offerId);
  }

  errorFor(draft: RedemptionDraftRow, field: DraftField): string | null {
    return this.errors().get(draft.id)?.[field] ?? null;
  }

  rowErrorSummary(draft: RedemptionDraftRow): string {
    const messages = Object.values(this.errors().get(draft.id) ?? {}).filter(
      (m): m is string => !!m,
    );
    const server = this.serverErrors().get(draft.id);
    if (server) messages.push(server);

    if (!messages.length) return '';
    if (messages.length === 1) return messages[0];
    return messages.map((m) => `• ${m}`).join('\n');
  }

  hasRowError(draft: RedemptionDraftRow): boolean {
    return (
      Object.keys(this.errors().get(draft.id) ?? {}).length > 0 ||
      this.serverErrors().has(draft.id)
    );
  }

  onEdit(draft: RedemptionDraftRow, field: DraftField, value: unknown): void {
    this.patch.emit({ id: draft.id, field, value });
  }

  onRemove(draft: RedemptionDraftRow): void {
    this.removeRow.emit(draft.id);
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    this.submitRows.emit();
  }

  onCancel(): void {
    if (this.submitting()) return;
    this.cancel.emit();
  }
}
