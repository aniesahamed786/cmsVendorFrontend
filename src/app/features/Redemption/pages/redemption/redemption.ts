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
import { Observable, finalize, firstValueFrom, forkJoin, from, of, switchMap } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import {
  ActiveStoreOffer,
  BulkUploadResponse,
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
  RedemptionUploadError,
  parseRedemptionUpload,
  referencedOfferIds,
} from '../../utils/redemption-upload';
import {
  DraftBranch,
  DraftCatalogue,
  DraftErrors,
  DraftLabels,
  DraftMessages,
  OfferWindow,
  RedemptionDraftRow,
  draftToPayload,
  emptyDraftCatalogue,
  isDraftValid,
  validateDraft,
} from '../../utils/redemption-draft';
import { OfferDetailApi } from '../../../Offers/models/offerList';
import { OfferDetailService } from '../../../Offers/services/offer-detail.service';
import {
  DraftPatch,
  RedemptionUploadPreview,
} from '../../components/redemption-upload-preview/redemption-upload-preview';

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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PrimeUIModules,
    Button,
    TranslatePipe,
    RedemptionUploadPreview,
  ],
  templateUrl: './redemption.html',
  styleUrl: './redemption.css',
})
export class Redemption implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RedemptionService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly offerDetail = inject(OfferDetailService);

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

  readonly previewVisible = signal(false);
  readonly previewFileName = signal('');
  readonly previewDrafts = signal<RedemptionDraftRow[]>([]);
  readonly previewCatalogue = signal<DraftCatalogue>(emptyDraftCatalogue());
  readonly previewBranchesLoading = signal<ReadonlySet<string>>(new Set<string>());

  readonly previewServerErrors = signal<Map<string, string>>(new Map());

  readonly previewErrors = computed(() => {
    const catalogue = this.previewCatalogue();
    const messages = this.draftMessages();
    const labels = this.draftLabels();
    const map = new Map<string, DraftErrors>();
    for (const draft of this.previewDrafts()) {
      map.set(draft.id, validateDraft(draft, catalogue, messages, labels, this.formatDay));
    }
    return map;
  });

  private readonly formatDay = (date: Date): string =>
    date.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  readonly previewInvalidCount = computed(() => {
    const errors = this.previewErrors();
    return this.previewDrafts().filter((d) => !isDraftValid(errors.get(d.id) ?? {})).length;
  });

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

  private draftMessages(): DraftMessages {
    this.i18n.loadSeq();
    return {
      required: this.i18n.t('redemption.upload.required'),
      notANumber: this.i18n.t('redemption.upload.notANumber'),
      negativeAmount: this.i18n.t('redemption.upload.negativeAmount'),
      invalidMembershipId: this.i18n.t('redemption.upload.invalidMembershipId'),
      invalidDate: this.i18n.t('redemption.upload.invalidDate'),
      startDateRequired: this.i18n.t('redemption.upload.startDateRequired'),
      endDateRequired: this.i18n.t('redemption.upload.endDateRequired'),
      endBeforeStart: this.i18n.t('redemption.upload.endBeforeStart'),
      unknownOffer: this.i18n.t('redemption.upload.unknownOffer'),
      unknownBranch: this.i18n.t('redemption.upload.unknownBranch'),
      outsideOfferWindow: this.i18n.t('redemption.upload.outsideOfferWindow'),
    };
  }

  private draftLabels(): DraftLabels {
    this.i18n.loadSeq();
    return {
      membershipId: this.i18n.t('redemption.label.membershipId'),
      offer: this.i18n.t('redemption.label.offer'),
      branch: this.i18n.t('redemption.label.branch'),
      transactionDate: this.i18n.t('redemption.label.transactionDate'),
      startDate: this.i18n.t('redemption.label.startDate'),
      endDate: this.i18n.t('redemption.label.endDate'),
      totalAmountIncVat: this.i18n.t('redemption.label.totalInvoiceAmount'),
      totalAmountPaid: this.i18n.t('redemption.label.totalAmountPaid'),
      currency: this.i18n.t('redemption.label.currency'),
      discountAmount: this.i18n.t('redemption.label.discountAmount'),
    };
  }

  private async parseUploadedFile(file: File): Promise<void> {
    try {
      const result = await parseRedemptionUpload(
        file,
        () => firstValueFrom(this.loadOfferCatalogue()).then((c) => c.map(toTemplateOffer)),
        {
          missingSheet: this.i18n.t('redemption.upload.missingSheet'),
          emptyFile: this.i18n.t('redemption.upload.emptyFile'),
        },
      );

      if (result.fileErrors.length) {
        this.uploading.set(false);
        this.uploadErrors.set(result.fileErrors);
        this.messageService.add({
          severity: 'warn',
          summary: this.i18n.t('redemption.toast.uploadInvalidSummary'),
          detail: this.i18n.t('redemption.toast.uploadInvalidDetail'),
          life: 6000,
        });
        return;
      }

      this.previewFileName.set(file.name);
      this.openPreview(result.drafts, result.catalogue);
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

  private openPreview(drafts: RedemptionDraftRow[], fileCatalogue: DraftCatalogue): void {
    this.previewDrafts.set(drafts);
    this.previewCatalogue.set(fileCatalogue);
    this.previewVisible.set(true);

    const offerIds = referencedOfferIds(drafts);
    this.previewBranchesLoading.set(new Set(offerIds));

    this.api
      .getActiveStoreOffers()
      .pipe(
        switchMap((offers) => {
          const live = asOfferArray(offers);
          const liveOffers = live.map((o) => ({
            offerId: o.offerId,
            title: this.localized(o.offerTitle, o.offerTitleAr),
          }));
          const liveIds = new Set(liveOffers.map((o) => o.offerId));

          const toFetch = offerIds.filter((id) => liveIds.has(id));
          if (!toFetch.length) {
            return of<DraftCatalogue>({
              offers: liveOffers,
              branchesByOffer: new Map(),
              windowsByOffer: new Map(),
            });
          }

          return from(toFetch).pipe(
            mergeMap(
              (offerId) =>
                forkJoin({
                  offerId: of(offerId),
                  locations: this.api.getOfferLocations(offerId).pipe(catchError(() => of(null))),
                  detail: this.offerDetail
                    .getOfferDetail(offerId)
                    .pipe(catchError(() => of(null))),
                }),
              Redemption.LOCATION_FETCH_CONCURRENCY,
            ),
            toArray(),
            map<
              { offerId: string; locations: unknown; detail: OfferDetailApi | null }[],
              DraftCatalogue
            >((results) => {
              const branchesByOffer = new Map<string, DraftBranch[]>();
              const windowsByOffer = new Map<string, OfferWindow>();
              for (const { offerId, locations, detail } of results) {
                if (locations !== null) {
                  branchesByOffer.set(offerId, this.toDraftBranches(locations));
                }
                const window = this.toOfferWindow(detail);
                if (window) windowsByOffer.set(offerId, window);
              }
              return { offers: liveOffers, branchesByOffer, windowsByOffer };
            }),
          );
        }),
        finalize(() => {
          this.uploading.set(false);
          this.previewBranchesLoading.set(new Set<string>());
        }),
      )
      .subscribe({
        next: (catalogue) => this.previewCatalogue.set(catalogue),
        error: (err: HttpErrorResponse) => {
          console.error('Failed to load live data for the upload preview', err);
          this.showError('redemption.toast.uploadFailed', err);
        },
      });
  }

  
  private toOfferWindow(detail: OfferDetailApi | null): OfferWindow | null {
    if (!detail) return null;

    const toDay = (value: { $date: string } | string | undefined): Date | null => {
      const iso = typeof value === 'string' ? value : value?.$date;
      if (!iso) return null;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return null;
      return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    };

    const start = toDay(detail.startDate);
    const end = toDay(detail.endDate);
    return start || end ? { start, end } : null;
  }

  private toDraftBranches(locations: unknown): DraftBranch[] {
    return asLocationArray(locations)
      .map((l) => {
        const raw = l as unknown as Record<string, unknown>;
        const id = String(l.locationId ?? raw['_id'] ?? raw['id'] ?? '');
        const name = this.localized(l.locationName, l.locationNameAr);
        const city = this.localized(l.city, l.cityAr);
        return { branchId: id, label: branchLabel(name, city) || id };
      })
      .filter((b) => !!b.branchId);
  }

  onPreviewPatch(patch: DraftPatch): void {
    if (this.previewServerErrors().has(patch.id)) {
      this.previewServerErrors.update((map) => {
        const next = new Map(map);
        next.delete(patch.id);
        return next;
      });
    }

    this.previewDrafts.update((drafts) =>
      drafts.map((draft) => {
        if (draft.id !== patch.id) return draft;

        const next = { ...draft, [patch.field]: patch.value } as RedemptionDraftRow;

        if (patch.field === 'offerId') {
          next.branchId = null;
          next.branchText = '';
          const offer = this.previewCatalogue().offers.find((o) => o.offerId === patch.value);
          next.offerText = offer?.title ?? '';
        }

        if (patch.field === 'branchId') {
          const branches = next.offerId
            ? this.previewCatalogue().branchesByOffer.get(next.offerId)
            : undefined;
          next.branchText = branches?.find((b) => b.branchId === patch.value)?.label ?? '';
        }

        if (patch.field === 'transactionType') {
          if (patch.value === 'COLLECTIVE') next.transactionDate = null;
          else {
            next.startDate = null;
            next.endDate = null;
          }
        }

        return next;
      }),
    );

    if (patch.field === 'offerId' && typeof patch.value === 'string' && patch.value) {
      this.ensureBranchesLoaded(patch.value);
    }
  }

  private ensureBranchesLoaded(offerId: string): void {
    const catalogue = this.previewCatalogue();
    if (catalogue.branchesByOffer.has(offerId) && catalogue.windowsByOffer.has(offerId)) return;
    if (this.previewBranchesLoading().has(offerId)) return;

    this.previewBranchesLoading.update((set) => new Set(set).add(offerId));

    forkJoin({
      locations: this.api.getOfferLocations(offerId).pipe(catchError(() => of(null))),
      detail: this.offerDetail.getOfferDetail(offerId).pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() =>
          this.previewBranchesLoading.update((set) => {
            const next = new Set(set);
            next.delete(offerId);
            return next;
          }),
        ),
      )
      .subscribe({
        next: ({ locations, detail }) =>
          this.previewCatalogue.update((c) => {
            const branchesByOffer = new Map(c.branchesByOffer);
            if (locations !== null) {
              branchesByOffer.set(offerId, this.toDraftBranches(locations));
            }
            const windowsByOffer = new Map(c.windowsByOffer);
            const window = this.toOfferWindow(detail);
            if (window) windowsByOffer.set(offerId, window);
            return { offers: c.offers, branchesByOffer, windowsByOffer };
          }),
        error: (err: HttpErrorResponse) =>
          console.error('Failed to load details for offer', offerId, err),
      });
  }

  onPreviewRemoveRow(id: string): void {
    this.previewDrafts.update((drafts) => drafts.filter((d) => d.id !== id));
    this.previewServerErrors.update((map) => {
      if (!map.has(id)) return map;
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  cancelPreview(): void {
    if (this.uploading()) return;
    this.previewVisible.set(false);
    this.previewDrafts.set([]);
    this.previewServerErrors.set(new Map());
    this.previewFileName.set('');
  }

  submitPreview(): void {
    const drafts = this.previewDrafts();
    if (!drafts.length || this.previewInvalidCount() > 0 || this.uploading()) return;

    this.previewServerErrors.set(new Map());
    this.uploading.set(true);
    this.submitBulk(drafts);
  }

  private submitBulk(drafts: RedemptionDraftRow[]): void {
    if (!drafts.length) {
      this.uploading.set(false);
      this.uploadErrors.set([{ row: 0, message: this.i18n.t('redemption.upload.emptyFile') }]);
      return;
    }

    this.api
      .uploadBulkRedemptions(drafts.map(draftToPayload))
      .pipe(finalize(() => this.uploading.set(false)))
      .subscribe({
        next: (res) => this.applyBulkResult(drafts, res),
        error: (err: HttpErrorResponse) => {
          const message = extractApiErrorMessage(err);
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

  private applyBulkResult(drafts: RedemptionDraftRow[], res: BulkUploadResponse | null): void {
    const results = res?.results ?? [];

    if (!results.length) {
      const failed = res?.failedCount ?? 0;
      if (failed > 0) {
        this.messageService.add({
          severity: 'error',
          summary: this.i18n.t('redemption.toast.uploadFailed'),
          detail: this.i18n.t('redemption.toast.genericErrorDetail'),
          life: 8000,
          closable: true,
        });
        return;
      }
      this.finishBulkSuccess(res?.insertedCount ?? drafts.length);
      return;
    }

    const failures = new Map<string, string>();
    const insertedIds = new Set<string>();

    for (const row of results) {
      const draft = drafts[row.index];
      if (!draft) continue;
      if (row.success) insertedIds.add(draft.id);
      else {
        failures.set(
          draft.id,
          row.error?.trim() || this.i18n.t('redemption.toast.genericErrorDetail'),
        );
      }
    }

    const inserted = res?.insertedCount ?? insertedIds.size;

    if (!failures.size) {
      this.finishBulkSuccess(inserted || drafts.length);
      return;
    }

    this.previewDrafts.update((rows) => rows.filter((r) => !insertedIds.has(r.id)));
    this.previewServerErrors.set(failures);

    if (inserted > 0) this.loadRedemptions(1, this.pageSize());

    this.messageService.add({
      severity: 'error',
      summary: this.i18n.t(
        inserted > 0
          ? 'redemption.toast.uploadPartialSummary'
          : 'redemption.toast.uploadRejectedSummary',
      ),
      detail: this.i18n
        .t(
          inserted > 0
            ? 'redemption.toast.uploadPartialDetail'
            : 'redemption.toast.uploadRejectedDetail',
        )
        .replace('{{inserted}}', String(inserted))
        .replace('{{failed}}', String(failures.size)),
      life: 10000,
      closable: true,
    });
  }

  private finishBulkSuccess(count: number): void {
    this.previewVisible.set(false);
    this.previewDrafts.set([]);
    this.previewServerErrors.set(new Map());
    this.previewFileName.set('');
    this.messageService.add({
      severity: 'success',
      summary: this.i18n.t('redemption.toast.uploadSuccessSummary'),
      detail: this.i18n
        .t('redemption.toast.uploadSuccessDetail')
        .replace('{{count}}', String(count)),
      life: 5000,
    });
    this.loadRedemptions(1, this.pageSize());
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
