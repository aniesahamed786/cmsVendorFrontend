import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { CreateRequestPayload } from '../../../request-center/models/request-api.model';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import { BranchForm, BranchFormSubmit } from '../branch-form/branch-form';
 
/**
* Create a new branch.
*
* Same pattern as CreateOffer: the branch is never written directly — saving raises a
* BRANCH/CREATE request for admin review instead. "Save As Draft" creates it in DRAFT,
* "Add Store" creates and submits it in one call (`actionType: 'SUBMIT'`).
*
* Confirmed: `entityType: 'STORE'` is what CreateRequestPayload expects for branches/locations.
*/
@Component({
  selector: 'app-create-branch',
  standalone: true,
  imports: [CommonModule, BranchForm, TranslatePipe],
  templateUrl: './create-branch.html',
  styleUrl: './create-branch.scss',
})
export class CreateBranch {
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
 
  readonly saving = signal(false);
 
  constructor(private readonly router: Router) {}
 
  /** Main action ("Add Store") — raise the request and submit it for review immediately. */
  save(event: BranchFormSubmit): void {
    this.raiseCreateRequest(event, 'SUBMIT');
  }
 
  /** "Save As Draft" — keep the request in DRAFT so it can be submitted later. */
  saveDraft(event: BranchFormSubmit): void {
    this.raiseCreateRequest(event, 'DRAFT');
  }
 
  private raiseCreateRequest(event: BranchFormSubmit, actionType: 'DRAFT' | 'SUBMIT'): void {
    if (this.saving()) return;
 
    const branch = event?.payload;
    if (!branch) return;
 
    // requestData is JSON, so binary uploads cannot ride along — `dropFiles` strips them and
    // empty values are omitted to keep the stored payload small. With no baseline every
    // populated field is included, which is what a CREATE request needs. Recomputed here
    // independently of `event.changedFields` (which would be equivalent in create mode,
    // since BranchForm also diffs against null when there's no editableFormData) to mirror
    // CreateOffer's own behavior exactly.
    const requestData = getChangedFields(null, branch as unknown as Record<string, unknown>, {
      dropFiles: true,
    });
 
    const payload: CreateRequestPayload = {
      entityType: 'STORE',
      // entityId is omitted deliberately: the backend rejects CREATE requests that carry one.
      requestType: 'CREATE',
      title:
        branch.branch_name ||
        branch.branch_name_ar ||
        this.i18n.t('branchForm.request.untitledBranch'),
      requestData,
      actionType,
    };
 
    this.saving.set(true);
    this.requestApi
      .create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast(
            'success',
            actionType === 'SUBMIT'
              ? 'branchForm.toast.requestSubmittedSummary'
              : 'branchForm.toast.requestDraftedSummary',
            actionType === 'SUBMIT'
              ? 'branchForm.toast.requestCreateSubmittedDetail'
              : 'branchForm.toast.requestCreateDraftedDetail',
          );
          this.router.navigate(['/request-center']);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to raise branch create request', err);
          this.showRequestError(err);
        },
      });
  }
 
  /** Surface the backend's own message where there is one — it names the exact problem. */
  private showRequestError(err: HttpErrorResponse): void {
    const isConflict = err?.status === 409;
    this.messageService.add({
      severity: isConflict ? 'warn' : 'error',
      summary: this.i18n.t(
        isConflict ? 'branchForm.toast.requestConflictSummary' : 'branchForm.toast.requestFailedSummary',
      ),
      detail:
        extractApiErrorMessage(err) ??
        this.i18n.t(
          isConflict ? 'branchForm.toast.requestConflictDetail' : 'branchForm.toast.requestFailedDetail',
        ),
      life: isConflict ? 10000 : 5000,
      closable: true,
    });
  }
 
  private toast(severity: 'success' | 'error' | 'info', summaryKey: string, detailKey: string): void {
    this.messageService.add({
      severity,
      summary: this.i18n.t(summaryKey),
      detail: this.i18n.t(detailKey),
      life: 3000,
    });
  }
}