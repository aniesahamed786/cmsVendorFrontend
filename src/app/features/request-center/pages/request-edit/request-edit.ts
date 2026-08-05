import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { Button } from '../../../../shared/Components/button/button';
// import { CancelButton } from '../../../../shared/Components/cancel-button/cancel-button';
import { RequestCenterApiService } from '../../services/request-center-api.service';
import { ApiRequestStatus, RequestDetailsResponse } from '../../models/request-api.model';
import { buildProposedEntity } from '../../models/request-entity-view.mapper';
import {
  fromBranchFormModel,
  fromBranchFormSubmit,
  mergeRequestData,
  toBranchFormModel,
  toProfileEditData,
} from '../../models/request-edit.mapper';
import { OfferForm, OfferFormSubmit } from '../../../../shared/Components/offer-form/offer-form';
import { BranchForm, BranchFormModel, BranchFormSubmit } from '../../../Branches/pages/branch-form/branch-form';
import { VendorProfileEditForm } from '../../../Profile/components/vendor-profile-edit-form/vendor-profile-edit-form';
import { VendorProfileEditData } from '../../../Profile/models/vendor-profile-edit.model';
import { toVendorSchemaPayload } from '../../../Profile/models/vendor-profile-request.mapper';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/** Mirrors the backend's EDITABLE_STATUSES — once the admin's decision sticks, it's read-only. */
export const EDITABLE_REQUEST_STATUSES: ApiRequestStatus[] = ['DRAFT', 'SUBMITTED', 'RETURNED'];

/**
 * Edit a pending request.
 *
 * The vendor edits the *request*, not the entity, so this page reuses the real offer / profile
 * / branch forms — seeded with the request's proposed entity (live values overlaid with what
 * the request already changes) — and saves through PUT /cmsVendor/requests/{id} instead of
 * raising a new request.
 */
@Component({
  selector: 'app-request-edit',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    BackButton,
    Button,
    // CancelButton,
    OfferForm,
    BranchForm,
    VendorProfileEditForm,
  ],
  templateUrl: './request-edit.html',
  styleUrl: './request-edit.scss',
})
export class RequestEdit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RequestCenterApiService);
  private readonly i18n = inject(I18nService);
  private readonly messageService = inject(MessageService);

  readonly requestId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Ref name differs from the property so the template variable doesn't shadow the query. */
  private readonly profileForm = viewChild<VendorProfileEditForm>('profileFormRef');

  readonly details = signal<RequestDetailsResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly entityType = computed(() => this.details()?.entityType ?? null);
  readonly requestType = computed(() => this.details()?.requestType ?? 'UPDATE');

  /** Live entity overlaid with this request's edits — what the vendor should see in the form. */
  private readonly proposed = computed(() => buildProposedEntity(this.details()));

  /** OfferForm.mapOfferToForm reads the raw offer-document shape, which `proposed` already is. */
  readonly offerFormData = computed(() => (this.details() ? this.proposed() : null));
  readonly branchFormData = computed(() => (this.details() ? toBranchFormModel(this.proposed()) : null));
  readonly profileData = computed(() => toProfileEditData(this.proposed()));

  constructor() {
    this.loadRequest();

    // The profile form renders before the request arrives, so re-seed it (and its
    // change-detection baseline) once the data lands. Seeding is untracked: reset() reads the
    // form's own value signals, and tracking them here would patch the vendor's typing straight
    // back to the loaded values on every keystroke.
    effect(() => {
      const data = this.profileData();
      const form = this.profileForm();
      const loading = this.loading();
      untracked(() => {
        if (form && !loading) form.reset(data);
      });
    });
  }

  private loadRequest(): void {
    if (!this.requestId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.api
      .getDetails(this.requestId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (details) => {
          // A request the admin has already decided on cannot be edited (the backend rejects
          // it too) — send the vendor back to the read-only view rather than showing a form
          // whose save is guaranteed to fail.
          if (!EDITABLE_REQUEST_STATUSES.includes(details.status)) {
            this.goBack();
            return;
          }
          this.details.set(details);
        },
        error: (err) => {
          console.error('Failed to load request for editing', err);
          this.loadError.set(
            extractApiErrorMessage(err) ?? this.i18n.t('requestCenter.detail.changesFailed'),
          );
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/request-center', this.requestId]);
  }

  // ---- Saves ---------------------------------------------------------------

  onOfferSave(event: OfferFormSubmit): void {
    // An UPDATE request stores the diff and a CREATE request the whole payload — exactly the
    // split create-offer/edit-offer already make when raising one.
    const payload = event.payload as unknown as Record<string, unknown>;
    const data =
      this.requestType() === 'CREATE'
        ? getChangedFields(null, payload)
        : event.changedFields ?? {};

    this.persist(data, String(payload?.['title'] ?? ''));
  }

 onBranchSave(event: BranchFormSubmit): void {
  const full = fromBranchFormSubmit(event);
  const data =
    this.requestType() === 'CREATE'
      ? full
      : getChangedFields(fromBranchFormModel(this.branchFormData() ?? {}), full);

  this.persist(data, event.payload.branch_name ?? '');
}

  /** The profile form has no footer of its own — the hosting page owns the save button. */
  triggerProfileSave(): void {
    this.profileForm()?.onUpdateChanges();
  }

  onProfileSave(payload: VendorProfileEditData): void {
    const full = toVendorSchemaPayload(payload);
    // Newly cropped images stay in as `File`s — the request is posted as multipart, so the
    // API service lifts them out into their own parts.
    const data =
      this.requestType() === 'CREATE'
        ? getChangedFields(null, full)
        : getChangedFields(toVendorSchemaPayload(this.profileData()), full);

    this.persist(data, payload.nameEn ?? '');
  }

  /**
   * PUT /cmsVendor/requests/{id}. Only `title` and `requestData` are sent — entityType,
   * entityId and requestType are the request's identity and must not change, and the endpoint
   * rejects any field outside its DTO (`forbidNonWhitelisted`), so `actionType` is not sent
   * either: editing a request never changes its status.
   */
  private persist(formData: Record<string, unknown>, title: string): void {
    if (this.saving()) return;

    const details = this.details();
    if (!details) return;

    const requestData = mergeRequestData(
      details.requestType,
      details.requestData ?? {},
      formData,
    );

    if (Object.keys(requestData).length === 0) {
      this.toast('info', 'requestCenter.edit.noChangesSummary', 'requestCenter.edit.noChangesDetail');
      return;
    }

    this.saving.set(true);
    this.api
      .update(this.requestId, { title: title || details.title, requestData })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast('success', 'requestCenter.edit.savedSummary', 'requestCenter.edit.savedDetail');
          this.goBack();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to update request', err);
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('requestCenter.edit.failedSummary'),
            detail: extractApiErrorMessage(err) ?? this.i18n.t('requestCenter.edit.failedDetail'),
            life: 8000,
            closable: true,
          });
        },
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
