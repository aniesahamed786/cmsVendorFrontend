import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { OfferForm, OfferFormSubmit } from '../../../../shared/Components/offer-form/offer-form';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { CreateRequestPayload } from '../../../request-center/models/request-api.model';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/**
 * Create a new offer.
 *
 * The offer is never written directly — the cmsVendor offer API is read-only. Saving raises an
 * OFFER/CREATE request for admin review instead: "Save As Draft" creates it in DRAFT, the main
 * action creates and submits it in one call (`actionType: 'SUBMIT'`).
 */
@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, OfferForm, TranslatePipe],
  templateUrl: './create-offer.html',
  styleUrl: './offer-form.scss',
})
export class CreateOffer {
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  readonly saving = signal(false);

  constructor(private readonly router: Router) {}

  /** Main action ("Add Offer") — raise the request and submit it for review immediately. */
  save(event: OfferFormSubmit): void {
    this.raiseCreateRequest(event, 'SUBMIT');
  }

  /** "Save As Draft" — keep the request in DRAFT so it can be submitted later. */
  saveDraft(event: OfferFormSubmit): void {
    this.raiseCreateRequest(event, 'DRAFT');
  }

  private raiseCreateRequest(event: OfferFormSubmit, actionType: 'DRAFT' | 'SUBMIT'): void {
    if (this.saving()) return;

    const offer = event?.payload;
    if (!offer) return;

    // Empty values are omitted to keep the stored payload small; with no baseline every
    // populated field is included, which is what a CREATE request needs. Image `File`s are
    // kept — the request is posted as multipart, so they travel as their own parts.
    const requestData = getChangedFields(null, offer as unknown as Record<string, unknown>);

    const payload: CreateRequestPayload = {
      entityType: 'OFFER',
      // entityId is omitted deliberately: the backend rejects CREATE requests that carry one.
      requestType: 'CREATE',
      // The vendor's own summary of the request — what the admin reads in the Request Center
      // list. The offer's name is only the fallback.
      title: event.requestSummary || offer.title || this.i18n.t('offerForm.request.untitledOffer'),
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
              ? 'offerForm.toast.requestSubmittedSummary'
              : 'offerForm.toast.requestDraftedSummary',
            actionType === 'SUBMIT'
              ? 'offerForm.toast.requestCreateSubmittedDetail'
              : 'offerForm.toast.requestCreateDraftedDetail',
          );
          this.router.navigate(['/request-center']);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to raise offer create request', err);
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
        isConflict ? 'offerForm.toast.requestConflictSummary' : 'offerForm.toast.requestFailedSummary',
      ),
      detail:
        extractApiErrorMessage(err) ??
        this.i18n.t(
          isConflict ? 'offerForm.toast.requestConflictDetail' : 'offerForm.toast.requestFailedDetail',
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
