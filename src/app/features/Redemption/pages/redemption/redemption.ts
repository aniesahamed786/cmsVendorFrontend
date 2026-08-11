import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import {
  ActiveStoreOffer,
  OfferLocation,
  RecordRedemptionPayload,
  RedemptionRow,
} from '../../models/redemption.model';
import { RedemptionService } from '../../services/redemption.service';

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-redemption',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules, Button, TranslatePipe],
  templateUrl: './redemption.html',
  styleUrl: './redemption.css',
})
export class Redemption implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RedemptionService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  redemptionForm: FormGroup;

  transactionTypes = [
    { label: 'Single Transaction', value: 'SINGLE' },
    { label: 'Collective Transaction', value: 'COLLECTIVE' },
  ];

  private readonly activeOffers = signal<ActiveStoreOffer[]>([]);
  private readonly offerLocations = signal<OfferLocation[]>([]);

  readonly offersLoading = signal(false);
  readonly branchesLoading = signal(false);
  readonly submitting = signal(false);

  readonly offerOptions = computed<SelectOption[]>(() =>
    this.activeOffers().map((o) => ({
      value: o.offerId,
      label: this.localized(o.offerTitle, o.offerTitleAr),
    })),
  );

  readonly branchOptions = computed<SelectOption[]>(() =>
    this.offerLocations().map((l) => {
      const name = this.localized(l.locationName, l.locationNameAr);
      const city = this.localized(l.city, l.cityAr);
      return { value: l.locationId, label: city ? `${name} — ${city}` : name };
    }),
  );

  readonly redemptions = signal<RedemptionRow[]>([]);
  readonly totalRecords = signal(0);
  readonly listLoading = signal(true);
  readonly pageSize = signal(10);

  readonly redemptionRows = computed(() =>
    this.redemptions().map((r) => ({
      ...r,
      offer: this.localized(r.offerTitle, r.offerTitleAr),
    })),
  );

  constructor() {
    this.redemptionForm = this.fb.group({
      transactionType: ['SINGLE', Validators.required],
      membershipId: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      mobileNumber: [''],
      transactionDate: ['', Validators.required],
      offer: [null, Validators.required],
      branch: [null],
      totalInvoiceAmount: ['', Validators.required],
      totalAmountPaid: ['', Validators.required],
      currency: ['SAR', Validators.required],
      discountAmount: ['', Validators.required],
    });

    this.redemptionForm
      .get('transactionType')!
      .valueChanges.subscribe(() => this.updateTransactionValidators());

    this.redemptionForm.get('offer')!.valueChanges.subscribe((offerId: string | null) => {
      this.redemptionForm.get('branch')!.reset(null, { emitEvent: false });
      this.offerLocations.set([]);
      if (offerId) this.loadOfferLocations(offerId);
    });
  }

  ngOnInit(): void {
    this.loadActiveOffers();
    this.loadRedemptions(1, this.pageSize());
  }

  get isCollectiveTransaction(): boolean {
    return this.redemptionForm.get('transactionType')?.value === 'COLLECTIVE';
  }

  get canSubmit(): boolean {
    return !this.isCollectiveTransaction && !this.submitting();
  }

  private updateTransactionValidators(): void {
    const requiredForSingle: Record<string, ValidatorFn[]> = {
      membershipId: [Validators.required, Validators.pattern(/^\d+$/)],
      offer: [Validators.required],
    };

    for (const [field, validators] of Object.entries(requiredForSingle)) {
      const control = this.redemptionForm.get(field)!;
      control.setValidators(this.isCollectiveTransaction ? [] : validators);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private loadActiveOffers(): void {
    this.offersLoading.set(true);
    this.api
      .getActiveStoreOffers()
      .pipe(finalize(() => this.offersLoading.set(false)))
      .subscribe({
        next: (offers) => this.activeOffers.set(offers ?? []),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to load active store offers', err);
          this.activeOffers.set([]);
          this.showError('redemption.toast.offersFailed', err);
        },
      });
  }

  private loadOfferLocations(offerId: string): void {
    this.branchesLoading.set(true);
    this.api
      .getOfferLocations(offerId)
      .pipe(finalize(() => this.branchesLoading.set(false)))
      .subscribe({
        next: (locations) => this.offerLocations.set(locations ?? []),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to load offer locations', err);
          this.offerLocations.set([]);
          this.showError('redemption.toast.branchesFailed', err);
        },
      });
  }

  private loadRedemptions(page: number, pageSize: number): void {
    this.listLoading.set(true);
    this.api
      .getRedemptions(page, pageSize)
      .pipe(finalize(() => this.listLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.redemptions.set(res?.data ?? []);
          this.totalRecords.set(res?.total ?? 0);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to load redemptions', err);
          this.redemptions.set([]);
          this.totalRecords.set(0);
          this.showError('redemption.toast.listFailed', err);
        },
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    this.pageSize.set(rows);
    this.loadRedemptions(page, rows);
  }

  submit(): void {
    if (this.isCollectiveTransaction) {
      this.messageService.add({
        severity: 'info',
        summary: this.i18n.t('redemption.toast.collectiveUnsupportedSummary'),
        detail: this.i18n.t('redemption.toast.collectiveUnsupportedDetail'),
        life: 5000,
      });
      return;
    }

    if (this.redemptionForm.invalid) {
      this.redemptionForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: this.i18n.t('redemption.toast.invalidSummary'),
        detail: this.i18n.t('redemption.toast.invalidDetail'),
        life: 4000,
      });
      return;
    }

    const v = this.redemptionForm.getRawValue();
    const mobileNumber = String(v.mobileNumber ?? '').trim();
    const branchId = String(v.branch ?? '').trim();

    const payload: RecordRedemptionPayload = {
      membershipId: Number(v.membershipId),
      offerId: v.offer,
      transactionType: 'SINGLE',
      totalAmountIncVat: this.toNumber(v.totalInvoiceAmount),
      transactionDate: this.toIsoDate(v.transactionDate),
      totalAmountPaid: this.toNumber(v.totalAmountPaid),
      currency: String(v.currency ?? '')
        .trim()
        .toUpperCase(),
      discountAmount: this.toNumber(v.discountAmount),
      ...(mobileNumber ? { mobileNumber } : {}),
      ...(branchId ? { branchId } : {}),
    };

    this.submitting.set(true);
    this.api
      .recordRedemption(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.i18n.t('redemption.toast.successSummary'),
            detail: this.i18n.t('redemption.toast.successDetail'),
            life: 3000,
          });
          this.resetForm();
          this.loadRedemptions(1, this.pageSize());
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to record redemption', err);
          this.showError('redemption.toast.submitFailed', err);
        },
      });
  }

  private resetForm(): void {
    this.redemptionForm.reset({
      transactionType: 'SINGLE',
      membershipId: '',
      mobileNumber: '',
      transactionDate: '',
      offer: null,
      branch: null,
      totalInvoiceAmount: '',
      totalAmountPaid: '',
      currency: 'SAR',
      discountAmount: '',
    });
    this.offerLocations.set([]);
  }

  private localized(en: string, ar: string): string {
    const value = this.i18n.lang() === 'ar' ? ar || en : en || ar;
    return value ?? '';
  }

  private toNumber(value: unknown): number {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  private toIsoDate(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(String(value ?? ''));
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private showError(summaryKey: string, err: HttpErrorResponse): void {
    this.messageService.add({
      severity: 'error',
      summary: this.i18n.t(summaryKey),
      detail: extractApiErrorMessage(err) ?? this.i18n.t('redemption.toast.genericErrorDetail'),
      life: 6000,
      closable: true,
    });
  }
}
