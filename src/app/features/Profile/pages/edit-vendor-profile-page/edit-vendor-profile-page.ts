import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorProfileEditForm } from '../../components/vendor-profile-edit-form/vendor-profile-edit-form';
import { VendorPreview } from '../../components/vendor-preview/vendor-preview';
import { Button } from '../../../../shared/Components/button/button';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import { VendorProfileEditData } from '../../models/vendor-profile-edit.model';
import {
  hasPendingImageUpload,
  toVendorProfileEditData,
  toVendorSchemaPayload,
} from '../../models/vendor-profile-request.mapper';
import { VendorProfileService } from '../vendor-profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { CreateRequestPayload } from '../../../request-center/models/request-api.model';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';

/**
 * Title every PROFILE request carries. Unlike offers and branches, the profile form has no
 * Request Summary box — there is only one profile and only one kind of change to it, so the
 * title is fixed rather than asked for. Kept here so the request-edit page reuses the exact
 * same string.
 */
export const PROFILE_REQUEST_TITLE = 'Profile Edit';

/**
 * Edit the vendor's own profile.
 *
 * As with offers, the vendor cannot write to the profile directly — saving raises a
 * PROFILE/UPDATE request for admin review. "Save As Draft" creates it in DRAFT; "Update
 * Changes" creates and submits it in one call (`actionType: 'SUBMIT'`).
 *
 * PROFILE requests carry no `entityId`: the backend resolves the target from the caller's own
 * vendorId (see validateEntityReference in request-cms-vendor.service.ts).
 */
@Component({
  selector: 'app-edit-vendor-profile-page',
  imports: [CommonModule, PrimeUIModules, VendorProfileEditForm, VendorPreview, Button, BackButton, ConfirmationPopUp, TranslatePipe],
  templateUrl: './edit-vendor-profile-page.html',
  styleUrl: './edit-vendor-profile-page.css',
  providers: [MessageService],
})
export class EditVendorProfilePage {
  // Signal-based queries so the template re-renders when the child resolves — and the ref
  // names differ from these properties, since a template ref var would otherwise shadow them.
  readonly editForm = viewChild<VendorProfileEditForm>('editFormRef');
  readonly preview = viewChild<VendorPreview>('previewRef');

  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly profileService = inject(VendorProfileService);
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly auth = inject(AuthService);

  readonly initialData = signal<VendorProfileEditData>(MOCK_VENDOR_PROFILE_EDIT);
  readonly isLoading = signal(false);
  readonly loadingProfile = signal(true);
  readonly showUpdateConfirm = signal(false);
  private pendingUpdate: VendorProfileEditData | null = null;

  /** Nothing to save until the form reports a real difference from the loaded profile. */
  readonly hasChanges = computed(() => this.editForm()?.hasChanges() ?? false);
  readonly canSave = computed(() => !this.loadingProfile() && !this.isLoading() && this.hasChanges());

  constructor() {
    this.loadProfile();

    // The form is created before the profile arrives, so re-seed it (and its change-detection
    // baseline) once the data lands.
    effect(() => {
      const data = this.initialData();
      const form = this.editForm();
      const loading = this.loadingProfile();
      // Seed untracked: reset() reads the form's own value signals, and tracking those here
      // would re-run this effect on every keystroke and patch the user's typing straight back
      // to the loaded profile — making the fields impossible to edit.
      untracked(() => {
        if (form && !loading) {
          form.reset(data);
        }
      });
    });
  }

  private loadProfile(): void {
    this.loadingProfile.set(true);
    this.profileService
      .getVendorProfile()
      .pipe(finalize(() => this.loadingProfile.set(false)))
      .subscribe({
        next: (profile) => this.initialData.set(toVendorProfileEditData(profile)),
        error: (err) => {
          console.error('Failed to load vendor profile', err);
          this.toast('error', 'profile.toast.loadFailedSummary', 'profile.toast.loadFailedDetail');
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  onSaveDraft(payload: VendorProfileEditData): void {
    this.raiseProfileRequest(payload, 'DRAFT');
  }

  /** "Update Changes" asks for confirmation first, then submits for review. */
  onUpdateChanges(payload: VendorProfileEditData): void {
    this.pendingUpdate = payload;
    this.showUpdateConfirm.set(true);
  }

  onConfirmUpdate(): void {
    const payload = this.pendingUpdate;
    if (!payload || this.isLoading()) return;
    this.raiseProfileRequest(payload, 'SUBMIT');
  }

  onCancelUpdate(): void {
    if (this.isLoading()) return;
    this.showUpdateConfirm.set(false);
    this.pendingUpdate = null;
  }

  private raiseProfileRequest(payload: VendorProfileEditData, actionType: 'DRAFT' | 'SUBMIT'): void {
    if (this.isLoading()) return;

    // Diff against the loaded profile in vendor-schema terms — requestData stores only the
    // changed fields. Newly cropped images stay in as `File`s; the request is posted as
    // multipart, so they are lifted out into their own parts by the API service.
    const changedFields = getChangedFields(
      toVendorSchemaPayload(this.initialData()),
      toVendorSchemaPayload(payload),
    );

    if (Object.keys(changedFields).length === 0) {
      this.showUpdateConfirm.set(false);
      this.pendingUpdate = null;
      this.toast(
        'info',
        'profile.toast.noChangesSummary',
        hasPendingImageUpload(payload) ? 'profile.toast.imageOnlyDetail' : 'profile.toast.noChangesDetail',
      );
      return;
    }

    const requestPayload: CreateRequestPayload = {
      entityType: 'PROFILE',
      // No entityId — the backend resolves PROFILE from the caller's vendorId.
      requestType: 'UPDATE',
      // Fixed title, no Request Summary box on this form: a vendor has exactly one profile
      // and one kind of edit to make to it, so asking them to describe it every time is noise.
      title: PROFILE_REQUEST_TITLE,
      requestData: changedFields,
      actionType,
    };

    this.isLoading.set(true);
    this.requestApi
      .create(requestPayload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.showUpdateConfirm.set(false);
          this.pendingUpdate = null;
          this.toast(
            'success',
            actionType === 'SUBMIT' ? 'profile.toast.requestSubmittedSummary' : 'profile.toast.requestDraftedSummary',
            actionType === 'SUBMIT' ? 'profile.toast.requestSubmittedDetail' : 'profile.toast.requestDraftedDetail',
          );
          this.router.navigate(['/request-center']);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to raise profile update request', err);
          this.showUpdateConfirm.set(false);
          this.showRequestError(err);
        },
      });
  }

  /**
   * A 409 means a PROFILE update request is already open; the backend message names the
   * blocking requestId and status, so show it verbatim as a warning rather than an error.
   */
  private showRequestError(err: HttpErrorResponse): void {
    const apiMessage = extractApiErrorMessage(err);
    const isConflict = err?.status === 409;

    this.messageService.add({
      severity: isConflict ? 'warn' : 'error',
      summary: this.i18n.t(
        isConflict ? 'profile.toast.requestConflictSummary' : 'profile.toast.requestFailedSummary',
      ),
      detail:
        apiMessage ??
        this.i18n.t(isConflict ? 'profile.toast.requestConflictDetail' : 'profile.toast.requestFailedDetail'),
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

  triggerSaveDraft(): void {
    this.editForm()?.onSaveDraft();
  }

  triggerUpdateChanges(): void {
    this.editForm()?.onUpdateChanges();
  }

  onLanguageFocus(lang: 'en' | 'ar'): void {
    this.preview()?.setLanguage(lang);
  }

  onFieldFocus(event: FocusEvent): void {
    const el = (event.target as HTMLElement).closest('[formControlName],[data-preview-section]');
    if (!el) return;
    // rep* fields have no preview counterpart; every other business field maps to identity
    const section =
      el.getAttribute('data-preview-section') ??
      (el.getAttribute('formControlName')?.startsWith('rep') ? null : 'identity');
    if (section) {
      this.preview()?.scrollToSection('preview-section-' + section);
    }
  }
}
