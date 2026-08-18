import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { toEditableBranchData } from '../../models/branch-edit.mapper';
import { RequestCenterRequestRecord } from '../../models/request-center-request.model';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import {
  CreateRequestPayload,
  ApiRequestEntityType,
} from '../../../request-center/models/request-api.model';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import { BranchForm, BranchApiPayload, BranchFormSubmit } from '../branch-form/branch-form';

@Component({
  selector: 'app-edit-branch',
  standalone: true,
  imports: [CommonModule, BranchForm, TranslatePipe],
  templateUrl: './edit-branch.html',
  styleUrl: './edit-branch.scss',
})
export class EditBranch {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly requestApi = inject(RequestCenterApiService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  private readonly requestsBaseUrl = '/api/v1/cmsVendor/getStoreDetails';

  readonly id = this.route.snapshot.paramMap.get('id');

  readonly editableFormData = signal<BranchApiPayload | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  private entityId: string | null = null;
  private entityType: ApiRequestEntityType = 'STORE';
  private branchTitle = '';

  constructor(private readonly router: Router) {
    if (this.id) {
      this.loadRequest(this.id);
    } else {
      this.loading.set(false);
    }
  }

  private loadRequest(requestId: string): void {
    this.loading.set(true);
    this.http.get<any>(`${this.requestsBaseUrl}/${requestId}`).subscribe({
      next: (request: any) => {
        this.branchTitle = request?.locationName ?? '';
        this.entityId = request?.locationId;
        this.entityType = 'STORE';
        let formattedRequest = {
          branch_name: request.locationName,
          branch_name_ar: request.locationNameAr,
          country: request.country,
          country_ar: request.countryAr,
          region: request.region,
          region_ar: request.regionAr,
          city: request.city,
          city_ar: request.cityAr,
          address: request.address,
          link: request.googleMapLink,
          branchRepresentativeName: request.representativeName,
          branchPhoneNumber: request.representativePhoneNumber,
          // settingsLocationId: asText(model.settingsLocationId),
          // geoPoint: model.geoPoint ?? DEFAULT_GEOPOINT,
        };
        this.editableFormData.set(toEditableBranchData(formattedRequest));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load branch request for editing', err);
        this.loading.set(false);
        this.toast('error', 'branchForm.toast.loadFailed', 'branchForm.toast.loadFailedDetail');
      },
    });
  }

  save(event: BranchFormSubmit): void {
    this.raiseRequest(event, 'SUBMIT');
  }

  saveDraft(event: BranchFormSubmit): void {
    this.raiseRequest(event, 'DRAFT');
  }

  private raiseRequest(event: BranchFormSubmit, actionType: 'DRAFT' | 'SUBMIT'): void {
    if (this.saving() || !event?.payload) return;

    console.log('this.entityId', this.entityId);

    const payload: CreateRequestPayload | null = this.entityId
      ? this.buildUpdatePayload(event, actionType)
      : this.buildCreatePayload(event, actionType);

    if (!payload) return; // buildUpdatePayload already toasted "no changes"

    this.saving.set(true);
    this.requestApi.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast(
          'success',
          actionType === 'SUBMIT'
            ? 'branchForm.toast.requestSubmittedSummary'
            : 'branchForm.toast.requestDraftedSummary',
          actionType === 'SUBMIT'
            ? 'branchForm.toast.requestSubmittedDetail'
            : 'branchForm.toast.requestDraftedDetail',
        );
        this.router.navigate(['/request-center']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        console.error('Failed to raise branch request', err);
        this.showRequestError(err);
      },
    });
  }

  private buildUpdatePayload(
    event: BranchFormSubmit,
    actionType: 'DRAFT' | 'SUBMIT',
  ): CreateRequestPayload | null {
    const changedFields = event.changedFields ?? {};
    if (Object.keys(changedFields).length === 0) {
      this.toast('info', 'branchForm.toast.noChangesSummary', 'branchForm.toast.noChangesDetail');
      return null;
    }

    return {
      entityType: this.entityType,
      entityId: this.entityId!,
      requestType: 'UPDATE',
      title:
        this.branchTitle ||
        event.payload.branch_name ||
        event.payload.branch_name_ar ||
        this.i18n.t('branchForm.request.untitledBranch'),
      requestData: changedFields,
      actionType,
    };
  }

  private buildCreatePayload(
    event: BranchFormSubmit,
    actionType: 'DRAFT' | 'SUBMIT',
  ): CreateRequestPayload {
    const requestData = getChangedFields(
      null,
      event.payload as unknown as Record<string, unknown>,
      {
        dropFiles: true,
      },
    );

    return {
      entityType: this.entityType,
      // entityId intentionally omitted — CREATE requests must not carry one.
      requestType: 'CREATE',
      title:
        event.payload.branch_name ||
        event.payload.branch_name_ar ||
        this.i18n.t('branchForm.request.untitledBranch'),
      requestData,
      actionType,
    };
  }

  private showRequestError(err: HttpErrorResponse): void {
    const apiMessage = extractApiErrorMessage(err);
    const isConflict = err?.status === 409;

    this.messageService.add({
      severity: isConflict ? 'warn' : 'error',
      summary: this.i18n.t(
        isConflict
          ? 'branchForm.toast.requestConflictSummary'
          : 'branchForm.toast.requestFailedSummary',
      ),
      detail:
        apiMessage ??
        this.i18n.t(
          isConflict
            ? 'branchForm.toast.requestConflictDetail'
            : 'branchForm.toast.requestFailedDetail',
        ),
      life: isConflict ? 10000 : 5000,
      sticky: false,
      closable: true,
    });
  }

  private toast(
    severity: 'success' | 'error' | 'info',
    summaryKey: string,
    detailKey: string,
  ): void {
    this.messageService.add({
      severity,
      summary: this.i18n.t(summaryKey),
      detail: this.i18n.t(detailKey),
      life: 3000,
    });
  }
}
