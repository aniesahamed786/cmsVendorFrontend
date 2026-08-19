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
import { Observable, finalize, firstValueFrom, from, of, switchMap } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
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
import {
  TemplateOffer,
  branchLabel,
  buildRedemptionTemplate,
  downloadBlob,
} from '../../utils/redemption-template';
import {
  LiveCatalogue,
  RedemptionUploadError,
  ResolvedRedemptionRow,
  parseRedemptionUpload,
  referencedOfferIds,
  validateAgainstLiveCatalogue,
} from '../../utils/redemption-upload';

interface SelectOption {
  label: string;
  value: string;
}

function unwrapArray<T>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) return response as T[];
  const body = response as Record<string, unknown> | null;
  for (const key of keys) {
    const value = body?.[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function asLocationArray(response: unknown): OfferLocation[] {
  return unwrapArray<OfferLocation>(response, ['data', 'locations', 'items', 'result']);
}

function asOfferArray(response: unknown): ActiveStoreOffer[] {
  return unwrapArray<ActiveStoreOffer>(response, ['data', 'offers', 'items', 'result']);
}

interface CatalogueEntry {
  offerId: string;
  title: string;
  raw: unknown;
  locations: { id: string; name: string; city: string; raw: unknown }[];
}

function toTemplateOffer(entry: CatalogueEntry): TemplateOffer {
  return {
    offerId: entry.offerId,
    title: entry.title,
    raw: entry.raw,
    branches: entry.locations.map((l) => ({
      id: l.id,
      label: branchLabel(l.name, l.city),
      raw: l.raw,
    })),
  };
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
  readonly downloadingTemplate = signal(false);
  readonly uploading = signal(false);

  private static readonly LOCATION_FETCH_CONCURRENCY = 6;

  readonly uploadErrors = signal<RedemptionUploadError[]>([]);

  readonly offerOptions = computed<SelectOption[]>(() =>
    this.activeOffers().map((o) => ({
      value: o.offerId,
      label: this.localized(o.offerTitle, o.offerTitleAr),
    })),
  );

  readonly branchOptions = computed<SelectOption[]>(() =>
    this.offerLocations()
      .map((l) => {
        const raw = l as unknown as Record<string, unknown>;
        const id = String(l.locationId ?? raw['_id'] ?? raw['id'] ?? '');
        const name = this.localized(
          l.locationName ?? (raw['name'] as string),
          l.locationNameAr ?? (raw['nameAr'] as string),
        );
        const city = this.localized(l.city, l.cityAr);
        return { value: id, label: branchLabel(name, city) || id };
      })
      .filter((o) => !!o.value),
  );

  readonly redemptions = signal<RedemptionRow[]>([]);
  readonly totalRecords = signal(0);
  readonly listLoading = signal(true);
  readonly pageSize = signal(10);

  /** While loading, feed the table falsy rows so PrimeNG renders the skeleton body. */
  readonly redemptionRows = computed(() =>
    this.listLoading()
      ? new Array(this.pageSize()).fill(null)
      : this.redemptions().map((r) => ({
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
  }

  ngOnInit(): void {
    this.loadActiveOffers();
    this.loadRedemptions(1, this.pageSize());
  }

  get isCollectiveTransaction(): boolean {
    return this.redemptionForm.get('transactionType')?.value === 'COLLECTIVE';
  }

  get canSubmit(): boolean {
    return !this.submitting();
  }

  private updateTransactionValidators(): void {
    const collective = this.isCollectiveTransaction;

    const rules: Record<string, ValidatorFn[]> = {
      membershipId: collective ? [Validators.pattern(/^\d+$/)] : [Validators.required, Validators.pattern(/^\d+$/)],
      transactionDate: collective ? [] : [Validators.required],
      startDate: collective ? [Validators.required] : [],
      endDate: collective ? [Validators.required] : [],
    };

    for (const [field, validators] of Object.entries(rules)) {
      const control = this.redemptionForm.get(field)!;
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    }

    const toClear = collective ? ['transactionDate'] : ['startDate', 'endDate'];
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

  private loadActiveOffers(): void {
    this.offersLoading.set(true);
    this.api
      .getActiveStoreOffers()
      .pipe(finalize(() => this.offersLoading.set(false)))
      .subscribe({
        next: (offers) => this.activeOffers.set(asOfferArray(offers)),
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

  downloadTemplate(): void {
    if (this.downloadingTemplate()) return;
    this.downloadingTemplate.set(true);

    this.loadOfferCatalogue()
      .pipe(finalize(() => this.downloadingTemplate.set(false)))
      .subscribe({
        next: (catalogue) => this.generateTemplateFile(catalogue.map(toTemplateOffer)),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to build redemption template', err);
          this.showError('redemption.toast.templateFailed', err);
        },
      });
  }

  private loadOfferCatalogue(): Observable<CatalogueEntry[]> {
    return this.api.getActiveStoreOffers().pipe(
      switchMap((offers) => {
        const list = asOfferArray(offers);
        if (!list.length) return of<CatalogueEntry[]>([]);

        return from(list).pipe(
          mergeMap(
            (offer) =>
              this.api.getOfferLocations(offer.offerId).pipe(
                catchError(() => of<OfferLocation[]>([])),
                map<unknown, CatalogueEntry>((locations) => ({
                  offerId: offer.offerId,
                  title: this.localized(offer.offerTitle, offer.offerTitleAr),
                  raw: offer,
                  locations: asLocationArray(locations).map((l) => {
                    const raw = l as unknown as Record<string, unknown>;
                    return {
                      id: String(l.locationId ?? raw['_id'] ?? raw['id'] ?? ''),
                      name: this.localized(l.locationName, l.locationNameAr),
                      city: this.localized(l.city, l.cityAr),
                      raw: l,
                    };
                  }),
                })),
              ),
            Redemption.LOCATION_FETCH_CONCURRENCY,
          ),
          toArray(),
          map((entries) => {
            const order = new Map(list.map((o, i) => [o.offerId, i]));
            return entries.sort((a, b) => (order.get(a.offerId) ?? 0) - (order.get(b.offerId) ?? 0));
          }),
        );
      }),
    );
  }

  triggerUpload(input: HTMLInputElement): void {
    if (this.uploading()) return;
    input.value = ''; 
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.uploadErrors.set([]);
    void this.parseUploadedFile(file);
  }

  private async parseUploadedFile(file: File): Promise<void> {
    try {
      const result = await parseRedemptionUpload(
        file,
        () => firstValueFrom(this.loadOfferCatalogue()).then((c) => c.map(toTemplateOffer)),
        {
          missingSheet: this.i18n.t('redemption.upload.missingSheet'),
          emptyFile: this.i18n.t('redemption.upload.emptyFile'),
          unknownOffer: this.i18n.t('redemption.upload.unknownOffer'),
          unknownBranch: this.i18n.t('redemption.upload.unknownBranch'),
          required: this.i18n.t('redemption.upload.required'),
          notANumber: this.i18n.t('redemption.upload.notANumber'),
          invalidDate: this.i18n.t('redemption.upload.invalidDate'),
          invalidMembershipId: this.i18n.t('redemption.upload.invalidMembershipId'),
          startDateRequired: this.i18n.t('redemption.upload.startDateRequired'),
          endDateRequired: this.i18n.t('redemption.upload.endDateRequired'),
          endBeforeStart: this.i18n.t('redemption.upload.endBeforeStart'),
          negativeAmount: this.i18n.t('redemption.upload.negativeAmount'),
          invalidTransactionType: this.i18n.t('redemption.upload.invalidTransactionType'),
          offerNoLongerActive: this.i18n.t('redemption.upload.offerNoLongerActive'),
          branchNoLongerAvailable: this.i18n.t('redemption.upload.branchNoLongerAvailable'),
        },
        {
          membershipId: this.i18n.t('redemption.label.membershipId'),
          offer: this.i18n.t('redemption.label.offer'),
          branch: this.i18n.t('redemption.label.branch'),
          transactionDate: this.i18n.t('redemption.label.transactionDate'),
          totalAmountIncVat: this.i18n.t('redemption.label.totalInvoiceAmount'),
          totalAmountPaid: this.i18n.t('redemption.label.totalAmountPaid'),
          currency: this.i18n.t('redemption.label.currency'),
          discountAmount: this.i18n.t('redemption.label.discountAmount'),
        },
      );

      if (result.errors.length) {
        this.uploading.set(false);
        this.uploadErrors.set(result.errors);
        this.messageService.add({
          severity: 'warn',
          summary: this.i18n.t('redemption.toast.uploadInvalidSummary'),
          detail: this.i18n.t('redemption.toast.uploadInvalidDetail'),
          life: 6000,
        });
        return;
      }

      console.log('Parsed upload payloads:', result.payloads);

      this.verifyThenSubmit(result.rows);
    } catch (err) {
      console.error('Failed to parse uploaded file', err);
      this.uploading.set(false);
      this.messageService.add({
        severity: 'error',
        summary: this.i18n.t('redemption.toast.uploadFailed'),
        detail: this.i18n.t('redemption.toast.genericErrorDetail'),
        life: 6000,
        closable: true,
      });
    }
  }

  private verifyThenSubmit(rows: ResolvedRedemptionRow[]): void {
    const offerIds = referencedOfferIds(rows);
    if (!offerIds.length) {
      this.submitBulk(rows.map((r) => r.payload));
      return;
    }

    this.api
      .getActiveStoreOffers()
      .pipe(
        switchMap((offers) => {
          const activeOfferIds = new Set(asOfferArray(offers).map((o) => o.offerId));
          const toCheck = offerIds.filter((id) => activeOfferIds.has(id));
          if (!toCheck.length) {
            return of<LiveCatalogue>({ activeOfferIds, branchIdsByOffer: new Map() });
          }

          return from(toCheck).pipe(
            mergeMap(
              (offerId) =>
                this.api.getOfferLocations(offerId).pipe(
                  catchError(() => of(null)),
                  map((locations) => ({ offerId, locations })),
                ),
              Redemption.LOCATION_FETCH_CONCURRENCY,
            ),
            toArray(),
            map<{ offerId: string; locations: unknown }[], LiveCatalogue>((results) => {
              const branchIdsByOffer = new Map<string, Set<string>>();
              for (const { offerId, locations } of results) {
                if (locations === null) continue; 
                const ids = asLocationArray(locations).map((l) => {
                  const raw = l as unknown as Record<string, unknown>;
                  return String(l.locationId ?? raw['_id'] ?? raw['id'] ?? '');
                });
                branchIdsByOffer.set(offerId, new Set(ids.filter(Boolean)));
              }
              return { activeOfferIds, branchIdsByOffer };
            }),
          );
        }),
      )
      .subscribe({
        next: (live) => {
          const staleErrors = validateAgainstLiveCatalogue(rows, live, {
            offerNoLongerActive: this.i18n.t('redemption.upload.offerNoLongerActive'),
            branchNoLongerAvailable: this.i18n.t('redemption.upload.branchNoLongerAvailable'),
          });

          if (staleErrors.length) {
            this.uploading.set(false);
            this.uploadErrors.set(staleErrors);
            this.messageService.add({
              severity: 'warn',
              summary: this.i18n.t('redemption.toast.uploadStaleSummary'),
              detail: this.i18n.t('redemption.toast.uploadStaleDetail'),
              life: 8000,
            });
            return;
          }

          this.submitBulk(rows.map((r) => r.payload));
        },
        error: (err: HttpErrorResponse) => {
          this.uploading.set(false);
          console.error('Failed to verify uploaded rows against live data', err);
          this.showError('redemption.toast.uploadFailed', err);
        },
      });
  }

  private submitBulk(payloads: RecordRedemptionPayload[]): void {
    if (!payloads.length) {
      this.uploading.set(false);
      this.uploadErrors.set([{ row: 0, message: this.i18n.t('redemption.upload.emptyFile') }]);
      return;
    }

    this.api
      .uploadBulkRedemptions(payloads)
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.i18n.t('redemption.toast.uploadSuccessSummary'),
            detail: this.i18n
              .t('redemption.toast.uploadSuccessDetail')
              .replace('{{count}}', String(payloads.length)),
            life: 5000,
          });
          this.loadRedemptions(1, this.pageSize());
        },
        error: (err: HttpErrorResponse) => {
          const message = extractApiErrorMessage(err);
          this.uploadErrors.set([
            { row: 0, message: message ?? this.i18n.t('redemption.toast.genericErrorDetail') },
          ]);
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('redemption.toast.uploadFailed'),
            detail: message ?? this.i18n.t('redemption.toast.genericErrorDetail'),
            life: 8000,
            closable: true,
          });
        },
      });
  }

  clearUploadErrors(): void {
    this.uploadErrors.set([]);
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

  private localized(en: string, ar: string): string {
    const value = this.i18n.lang() === 'ar' ? ar || en : en || ar;
    return value ?? '';
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
