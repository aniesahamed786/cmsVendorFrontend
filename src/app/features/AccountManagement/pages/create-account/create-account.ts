import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, finalize, forkJoin } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import {
  buildAccountPayload,
  buildAccountUpdatePayload,
  isEmptyUpdate,
} from '../../models/account.mapper';
import {
  AccountStatus,
  AccountType,
  SUBACCOUNT_PERMISSION_OPTIONS,
  SelectOption,
  VendorAccountDetail,
} from '../../models/account.model';
import { AccountsService } from '../../services/accounts.service';

@Component({
  selector: 'app-create-account',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PrimeUIModules,
    Button,
    TranslatePipe,
  ],
  templateUrl: './create-account.html',
  styleUrl: './create-account.scss',
})
export class CreateAccount implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountsService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly saving = signal(false);

  readonly editing = signal<VendorAccountDetail | null>(null);

  readonly isEdit = signal(false);
  readonly loading = signal(false);
  readonly notFound = signal(false);

  readonly permissionOptions = SUBACCOUNT_PERMISSION_OPTIONS;

  readonly locations = signal<SelectOption[]>([]);
  readonly categories = signal<SelectOption[]>([]);
  readonly locationsLoading = signal(false);
  readonly categoriesLoading = signal(false);


  readonly skeletonSections: number[][] = [new Array(4).fill(0), new Array(2).fill(0)];

  readonly statusOptions = computed(() => {
    this.i18n.loadSeq();
    return [
      { label: this.i18n.t('accountManagement.status.ACTIVE'), value: 'ACTIVE' },
      { label: this.i18n.t('accountManagement.status.SUSPENDED'), value: 'SUSPENDED' },
    ];
  });

  readonly form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[+()\d][\d\s()-]{6,19}$/)]],
      accountStatus: ['ACTIVE' as AccountStatus],
      permissions: [[] as string[]],
      locationIds: [[] as string[]],
      categoryIds: [[] as string[]],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.loadForEdit(id);
      return;
    }
    this.applyScopeRules();
  }

  private loadForEdit(id: string): void {
    this.loading.set(true);
    this.api
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (record) => this.applyEditRecord(record),
        error: (err: unknown) => {
          console.error('Failed to load account', err);
          this.notFound.set(true);
        },
      });
  }

  private applyEditRecord(record: VendorAccountDetail): void {
    this.editing.set(record);
    this.applyScopeRules();

    this.form.patchValue(
      {
        name: record.name,
        email: record.email,
        phone: record.phone,
        accountStatus: record.accountStatus ?? 'ACTIVE',
        permissions: [...(record.permissions ?? [])],
        locationIds: [...(record.locationIds ?? [])],
        categoryIds: [...(record.categoryIds ?? [])],
      },
      { emitEvent: false },
    );

    this.form.get('email')!.disable({ emitEvent: false });
  }

  private applyScopeRules(): void {
    for (const field of ['permissions', 'locationIds', 'categoryIds']) {
      const control = this.form.get(field)!;
      control.setValidators([nonEmptyArray]);
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.loadLookups();
  }

  private loadLookups(): void {
    this.locationsLoading.set(true);
    this.api
      .listLocations()
      .pipe(finalize(() => this.locationsLoading.set(false)))
      .subscribe({ next: (list: SelectOption[]) => this.locations.set(list) });

    this.categoriesLoading.set(true);
    this.api
      .listCategories()
      .pipe(finalize(() => this.categoriesLoading.set(false)))
      .subscribe({ next: (list: SelectOption[]) => this.categories.set(list) });
  }

  isPermissionOn(value: string): boolean {
    return ((this.form.get('permissions')!.value as string[]) ?? []).includes(value);
  }

  togglePermission(value: string, checked: boolean): void {
    const control = this.form.get('permissions')!;
    const current = new Set<string>((control.value as string[]) ?? []);
    if (checked) current.add(value);
    else current.delete(value);
    control.setValue([...current]);
    control.markAsDirty();
    control.updateValueAndValidity();
  }

  showError(control: string, error: string): boolean {
    const c = this.form.get(control);
    return !!c && c.hasError(error) && (c.dirty || c.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: this.i18n.t('accountManagement.toast.invalidSummary'),
        detail: this.i18n.t('accountManagement.toast.invalidDetail'),
        life: 4000,
      });
      return;
    }

    const value = this.form.getRawValue();
    const existing = this.editing();

    if (existing) {
      this.submitUpdate(existing, value);
      return;
    }

    const payload = buildAccountPayload(value);
    const displayName = payload.name;

    this.saving.set(true);
    this.api
      .createAccount(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastSuccess('createdSummary', 'createdDetail', displayName);
          this.goBack();
        },
        error: (err: HttpErrorResponse) => this.toastFailure('createFailed', err),
      });
  }

  private submitUpdate(
    existing: VendorAccountDetail,
    value: ReturnType<FormGroup['getRawValue']>,
  ): void {
    const payload = buildAccountUpdatePayload(existing, value);

    const nextStatus = value.accountStatus as AccountStatus;
    const statusChanged = !!nextStatus && nextStatus !== existing.accountStatus;

    if (isEmptyUpdate(payload) && !statusChanged) {
      this.messageService.add({
        severity: 'info',
        summary: this.i18n.t('accountManagement.toast.noChangesSummary'),
        detail: this.i18n.t('accountManagement.toast.noChangesDetail'),
        life: 4000,
      });
      return;
    }

    const requests: Observable<unknown>[] = [];
    if (!isEmptyUpdate(payload)) requests.push(this.api.updateAccount(existing.id, payload));
    if (statusChanged) requests.push(this.api.updateAccountStatus(existing.id, nextStatus));

    this.saving.set(true);
    forkJoin(requests)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastSuccess('updatedSummary', 'updatedDetail', payload.name ?? existing.name);
          this.goBack();
        },
        error: (err: HttpErrorResponse) => this.toastFailure('updateFailed', err),
      });
  }

  private toastSuccess(summaryKey: string, detailKey: string, name: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.i18n.t(`accountManagement.toast.${summaryKey}`),
      detail: this.i18n.t(`accountManagement.toast.${detailKey}`).replace('{{name}}', name),
      life: 5000,
    });
  }

  private toastFailure(summaryKey: string, err: HttpErrorResponse): void {
    console.error(`Account ${summaryKey}`, err);
    this.messageService.add({
      severity: 'error',
      summary: this.i18n.t(`accountManagement.toast.${summaryKey}`),
      detail:
        extractApiErrorMessage(err) ?? this.i18n.t('accountManagement.toast.genericErrorDetail'),
      life: 8000,
      closable: true,
    });
  }

  goBack(): void {
    this.router.navigate(['/account-management']);
  }
}

function nonEmptyArray(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}
