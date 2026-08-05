import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { OfferForm, OfferFormSubmit } from '../../../../shared/Components/offer-form/offer-form';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { OfferDetailService } from '../../services/offer-detail.service';
import { toEditableOfferData } from '../../models/offer-edit.mapper';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { CreateRequestPayload } from '../../../request-center/models/request-api.model';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/**
 * Edit an existing offer.
 *
 * Vendors cannot write to an offer directly — the cmsVendor offer API is read-only. Saving
 * raises an OFFER/UPDATE request for admin review instead: "Save As Draft" creates it in
 * DRAFT, "Update Offer" creates and submits it in one call (`actionType: 'SUBMIT'`).
 */
@Component({
  selector: 'app-edit-offer',
  standalone: true,
  imports: [CommonModule, OfferForm, TranslatePipe],
  templateUrl: './edit-offer.html',
  styleUrl: '../create-offer/offer-form.scss',
})
export class EditOffer {
  private readonly route = inject(ActivatedRoute);
  private readonly offerDetailService = inject(OfferDetailService);
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  readonly id = this.route.snapshot.paramMap.get('id');

  readonly editableFormData = signal<Record<string, unknown> | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  /** Offer title, used as the request title so the Request Center row is recognisable. */
  private offerTitle = '';

  constructor(private readonly router: Router) {
    if (this.id) {
      this.loadOffer(this.id);
    } else {
      this.loading.set(false);
    }
  }

  private loadOffer(offerId: string): void {
    this.loading.set(true);
    this.offerDetailService.getOfferDetail(offerId).subscribe({
      next: (offer) => {
        this.offerTitle = offer?.offerTitle ?? '';
        this.editableFormData.set(toEditableOfferData(offer));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load offer for editing', err);
        this.loading.set(false);
        this.toast('error', 'offerForm.toast.loadFailed', 'offerForm.toast.loadFailedDetail');
      },
    });
  }

  /** "Update Offer" — raise the change request and submit it for review immediately. */
  save(event: OfferFormSubmit): void {
    this.raiseUpdateRequest(event, 'SUBMIT');
  }

  /** "Save As Draft" — keep the change request in DRAFT so it can be submitted later. */
  saveDraft(event: OfferFormSubmit): void {
    this.raiseUpdateRequest(event, 'DRAFT');
  }

  private raiseUpdateRequest(event: OfferFormSubmit, actionType: 'DRAFT' | 'SUBMIT'): void {
    if (!this.id || this.saving()) return;

    const changedFields = event?.changedFields ?? {};
    if (Object.keys(changedFields).length === 0) {
      this.toast('info', 'offerForm.toast.noChangesSummary', 'offerForm.toast.noChangesDetail');
      return;
    }

    const payload: CreateRequestPayload = {
      entityType: 'OFFER',
      entityId: this.id,
      requestType: 'UPDATE',
      // The vendor's own summary of the change — what the admin sees in the Request Center
      // list. The offer's name is the fallback only if the form somehow emits nothing.
      title: event.requestSummary || this.offerTitle || (event.payload?.title ?? ''),
      // Only the edited fields — the backend stores requestData as the diff.
      requestData: changedFields,
      actionType,
    };

    this.saving.set(true);
    this.requestApi.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast(
          'success',
          actionType === 'SUBMIT'
            ? 'offerForm.toast.requestSubmittedSummary'
            : 'offerForm.toast.requestDraftedSummary',
          actionType === 'SUBMIT'
            ? 'offerForm.toast.requestSubmittedDetail'
            : 'offerForm.toast.requestDraftedDetail',
        );
        this.router.navigate(['/request-center']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        console.error('Failed to raise offer update request', err);
        this.showRequestError(err);
      },
    });
  }

  /**
   * Surface the backend's own message where there is one. A 409 means an UPDATE request for
   * this offer is already open, and the message names the blocking requestId and its status —
   * detail worth showing verbatim, and actionable, so it is not an "error" the user caused.
   */
  private showRequestError(err: HttpErrorResponse): void {
    const apiMessage = extractApiErrorMessage(err);
    const isConflict = err?.status === 409;

    this.messageService.add({
      severity: isConflict ? 'warn' : 'error',
      summary: this.i18n.t(
        isConflict ? 'offerForm.toast.requestConflictSummary' : 'offerForm.toast.requestFailedSummary',
      ),
      detail:
        apiMessage ??
        this.i18n.t(
          isConflict ? 'offerForm.toast.requestConflictDetail' : 'offerForm.toast.requestFailedDetail',
        ),
      // The conflict message is long and worth reading — keep it up longer, and let the user
      // dismiss it rather than timing out mid-sentence.
      life: isConflict ? 10000 : 5000,
      sticky: false,
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
