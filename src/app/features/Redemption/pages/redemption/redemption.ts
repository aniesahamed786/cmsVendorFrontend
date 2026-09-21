import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table, TableLazyLoadEvent } from 'primeng/table';
import { Observable, finalize, merge, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import {
  ActiveStoreOffer,
  OfferLocation,
  OffersForRedemptionPayload,
  RecordRedemptionPayload,
  RedemptionRow,
  RedemptionTransactionType,
} from '../../models/redemption.model';
import {
  RedemptionCatalogueService,
  asLocationArray,
  asOfferArray,
  toTemplateOffer,
} from '../../services/redemption-catalogue.service';
import { RedemptionService } from '../../services/redemption.service';
import {
  TemplateOffer,
  branchLabel,
  buildRedemptionTemplate,
  downloadBlob,
} from '../../utils/redemption-template';

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-redemption',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PrimeUIModules, Button, TranslatePipe],
  templateUrl: './redemption.html',
  styleUrl: './redemption.scss',
})
export class Redemption {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RedemptionService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly catalogueApi = inject(RedemptionCatalogueService);

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
  readonly downloadingTemplate = signal(false);

  readonly offerOptions = computed<SelectOption[]>(() =>
    this.activeOffers().map((o) => ({
      value: o.offerId,
      label: this.catalogueApi.localized(o.offerTitle, o.offerTitleAr),
    })),
  );

  readonly branchOptions = computed<SelectOption[]>(() =>
    this.offerLocations()
      .map((l) => {
        const raw = l as unknown as Record<string, unknown>;
        const id = String(l.locationId ?? raw['_id'] ?? raw['id'] ?? '');
        const name = this.catalogueApi.localized(
          l.locationName ?? (raw['name'] as string),
          l.locationNameAr ?? (raw['nameAr'] as string),
        );
        const city = this.catalogueApi.localized(l.city, l.cityAr);
        return { value: id, label: branchLabel(name, city) || id };
      })
      .filter((o) => !!o.value),
  );

  readonly redemptions = signal<RedemptionRow[]>([]);
  readonly totalRecords = signal(0);
  readonly listLoading = signal(true);
  readonly pageSize = signal(10);

  /** Which transaction type the list is filtered to. */
  readonly listType = signal<RedemptionTransactionType>('SINGLE');
  @ViewChild(Table) private listTable!: Table;

  /** One skeleton-width modifier per column, so the loading row can't drift out of
   *  step with the header. COLLECTIVE drops membership ID and splits the date column. */
  get skeletonCells(): string[] {
    const collective = this.listType() === 'COLLECTIVE';
    return [
      ...(collective ? [] : ['id']),
      'text', // transaction type
      'wide', // offer
      'text', // current price
      'text', // discount price
      'text', // amount saved
      ...(collective ? ['text', 'text'] : ['text']), // dates
    ];
  }

  get columnCount(): number {
    return this.skeletonCells.length;
  }

  selectListType(value: RedemptionTransactionType): void {
    if (this.listType() === value) return;
    this.listType.set(value);
    // reset() sends the paginator back to page 1 and re-emits onLazyLoad.
    this.listTable.reset();
  }

  /** While loading, feed the table falsy rows so PrimeNG renders the skeleton body. */
  readonly redemptionRows = computed(() =>
    this.listLoading()
      ? new Array(this.pageSize()).fill(null)
      : this.redemptions().map((r) => ({
          ...r,
          offer: this.catalogueApi.localized(r.offerTitle, r.offerTitleAr),
          type: this.transactionTypes.find((t) => t.value === r.transactionType)?.label ?? '—',
          transactionDate: this.formatDate(r.transactionDate),
          startDate: this.formatDate(r.startDate),
          endDate: this.formatDate(r.endDate),
        })),
  );

  /** Read in UTC: the API sends day boundaries (00:00:00Z / 23:59:59Z), so a local
   *  offset would drag the end date onto the next day. */
  private formatDate(value: string | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  constructor() {
    this.redemptionForm = this.fb.group({
      transactionType: ['SINGLE', Validators.required],
      membershipId: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      mobileNumber: [''],
      transactionDate: ['', Validators.required],
      startDate: [''],
      endDate: [''],
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

    // Offers depend on the dates: only offers active then can be redeemed.
    // transactionType is in here because updateTransactionValidators clears the dates
    // silently — without it, an in-flight request would land in the other mode.
    merge(
      this.redemptionForm.get('transactionType')!.valueChanges,
      this.redemptionForm.get('transactionDate')!.valueChanges,
      this.redemptionForm.get('startDate')!.valueChanges,
      this.redemptionForm.get('endDate')!.valueChanges,
    )
      .pipe(switchMap(() => this.offersForDates()))
      .subscribe((offers) => this.activeOffers.set(asOfferArray(offers)));
  }

  /** Re-reads the form, so one stream covers both SINGLE and COLLECTIVE. */
  private offersForDates(): Observable<ActiveStoreOffer[]> {
    this.redemptionForm.get('offer')!.reset(null);
    this.activeOffers.set([]);

    const payload = this.offersPayload();
    if (!payload) return of<ActiveStoreOffer[]>([]);

    this.offersLoading.set(true);
    return this.api.getOffersForRedemption(payload).pipe(
      catchError((err: HttpErrorResponse) => {
        console.error('Failed to load offers for the selected dates', err);
        this.showError('redemption.toast.offersFailed', err);
        return of<ActiveStoreOffer[]>([]);
      }),
      finalize(() => this.offersLoading.set(false)),
    );
  }

  /** null while the dates needed for a lookup are missing or contradictory. */
  private offersPayload(): OffersForRedemptionPayload | null {
    const { transactionDate, startDate, endDate } = this.redemptionForm.getRawValue();

    if (!this.isCollectiveTransaction) {
      return transactionDate
        ? { transactionType: 'SINGLE', transactionDate: this.toIsoDate(transactionDate) }
        : null;
    }

    if (!startDate || !endDate || this.isDateRangeInvalid) return null;
    return {
      transactionType: 'COLLECTIVE',
      startDate: this.toIsoDate(startDate),
      endDate: this.toIsoDate(endDate, true),
    };
  }

  // The list loads itself: p-table is lazy, so it emits onLazyLoad on init.

  get isCollectiveTransaction(): boolean {
    return this.redemptionForm.get('transactionType')?.value === 'COLLECTIVE';
  }

  get canSubmit(): boolean {
    return !this.submitting();
  }

  /** Offers come from the dates, so the select stays shut until they are picked. */
  get isOfferLocked(): boolean {
    return !this.offersPayload();
  }

  warnOfferNeedsDate(): void {
    if (!this.isOfferLocked) return;
    const range = this.isCollectiveTransaction;
    this.messageService.add({
      severity: 'warn',
      summary: this.i18n.t(
        range ? 'redemption.toast.offerNeedsRangeSummary' : 'redemption.toast.offerNeedsDateSummary',
      ),
      detail: this.i18n.t(
        range ? 'redemption.toast.offerNeedsRangeDetail' : 'redemption.toast.offerNeedsDateDetail',
      ),
      life: 4000,
    });
  }

  private updateTransactionValidators(): void {
    const collective = this.isCollectiveTransaction;

    const rules: Record<string, ValidatorFn[]> = {
      membershipId: collective ? [] : [Validators.required, Validators.pattern(/^\d+$/)],
      transactionDate: collective ? [] : [Validators.required],
      startDate: collective ? [Validators.required] : [],
      endDate: collective ? [Validators.required] : [],
    };

    for (const [field, validators] of Object.entries(rules)) {
      const control = this.redemptionForm.get(field)!;
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    }

    const toClear = collective
      ? ['transactionDate', 'membershipId', 'mobileNumber']
      : ['startDate', 'endDate'];
    for (const field of toClear) {
      this.redemptionForm.get(field)!.reset('', { emitEvent: false });
    }
  }

  get isDateRangeInvalid(): boolean {
    if (!this.isCollectiveTransaction) return false;
    const { startDate, endDate } = this.redemptionForm.getRawValue();
    if (!startDate || !endDate) return false;
    return new Date(startDate).getTime() > new Date(endDate).getTime();
  }

  private loadOfferLocations(offerId: string): void {
    this.branchesLoading.set(true);
    this.api
      .getOfferLocations(offerId)
      .pipe(finalize(() => this.branchesLoading.set(false)))
      .subscribe({
        next: (locations) => {
          const list = asLocationArray(locations);
          this.offerLocations.set(list);
          if (!list.length) {
            console.warn('[redemption] No branches returned for offer', offerId, locations);
          }
        },
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
      .getRedemptions(page, pageSize, this.listType())
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

  downloadTemplate(): void {
    if (this.downloadingTemplate()) return;
    this.downloadingTemplate.set(true);

    this.catalogueApi.loadOfferCatalogue()
      .pipe(finalize(() => this.downloadingTemplate.set(false)))
      .subscribe({
        next: (catalogue) => this.generateTemplateFile(catalogue.map(toTemplateOffer)),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to build redemption template', err);
          this.showError('redemption.toast.templateFailed', err);
        },
      });
  }

  private async generateTemplateFile(offers: TemplateOffer[]): Promise<void> {
    try {
      const blob = await buildRedemptionTemplate(offers, {
        sheetName: this.i18n.t('redemption.template.sheetName'),
        listsSheetName: this.i18n.t('redemption.template.listsSheetName'),
        membershipId: this.i18n.t('redemption.label.membershipId'),
        mobileNumber: this.i18n.t('redemption.label.mobileNumber'),
        transactionType: this.i18n.t('redemption.label.transactionType'),
        offer: this.i18n.t('redemption.label.offer'),
        branch: this.i18n.t('redemption.label.branch'),
        transactionDate: this.i18n.t('redemption.label.transactionDate'),
        startDate: this.i18n.t('redemption.label.startDate'),
        endDate: this.i18n.t('redemption.label.endDate'),
        totalInvoiceAmount: this.i18n.t('redemption.label.totalInvoiceAmount'),
        totalAmountPaid: this.i18n.t('redemption.label.totalAmountPaid'),
        currency: this.i18n.t('redemption.label.currency'),
        discountAmount: this.i18n.t('redemption.label.discountAmount'),
        listsOfferHeader: this.i18n.t('redemption.label.offer'),
        listsRefHeader: this.i18n.t('redemption.template.reference'),
        noBranches: this.i18n.t('redemption.template.noBranches'),
        invalidValueTitle: this.i18n.t('redemption.template.invalidTitle'),
        invalidValueMessage: this.i18n.t('redemption.template.invalidMessage'),
      });

      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${this.i18n.t('redemption.template.fileName')}-${stamp}.xlsx`);
    } catch (err) {
      console.error('Failed to generate redemption template file', err);
      this.messageService.add({
        severity: 'error',
        summary: this.i18n.t('redemption.toast.templateFailed'),
        detail: this.i18n.t('redemption.toast.genericErrorDetail'),
        life: 6000,
        closable: true,
      });
    }
  }

  submit(): void {
    if (this.redemptionForm.invalid || this.isDateRangeInvalid) {
      this.redemptionForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: this.i18n.t('redemption.toast.invalidSummary'),
        detail: this.isDateRangeInvalid
          ? this.i18n.t('redemption.toast.dateRangeInvalidDetail')
          : this.i18n.t('redemption.toast.invalidDetail'),
        life: 4000,
      });
      return;
    }

    const v = this.redemptionForm.getRawValue();
    const mobileNumber = String(v.mobileNumber ?? '').trim();
    const branchId = String(v.branch ?? '').trim();
    const membershipRaw = String(v.membershipId ?? '').trim();

    const common = {
      offerId: v.offer,
      totalAmountIncVat: this.toNumber(v.totalInvoiceAmount),
      totalAmountPaid: this.toNumber(v.totalAmountPaid),
      currency: String(v.currency ?? '')
        .trim()
        .toUpperCase(),
      discountAmount: this.toNumber(v.discountAmount),
      ...(mobileNumber ? { mobileNumber } : {}),
      ...(branchId ? { branchId } : {}),
    };

    const payload: RecordRedemptionPayload = this.isCollectiveTransaction
      ? {
          ...common,
          transactionType: 'COLLECTIVE',
          startDate: this.toIsoDate(v.startDate),
          endDate: this.toIsoDate(v.endDate, true),
          ...(membershipRaw ? { membershipId: Number(membershipRaw) } : {}),
        }
      : {
          ...common,
          transactionType: 'SINGLE',
          membershipId: Number(membershipRaw),
          transactionDate: this.toIsoDate(v.transactionDate),
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
      startDate: '',
      endDate: '',
      offer: null,
      branch: null,
      totalInvoiceAmount: '',
      totalAmountPaid: '',
      currency: 'SAR',
      discountAmount: '',
    });
    this.offerLocations.set([]);
  }

  private toNumber(value: unknown): number {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  private toIsoDate(value: unknown, endOfDay = false): string {
    const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const ms = endOfDay
      ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0)
      : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    return new Date(ms).toISOString();
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
