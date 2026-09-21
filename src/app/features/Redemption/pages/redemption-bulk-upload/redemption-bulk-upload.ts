import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { firstValueFrom, forkJoin, from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import { PrimeUIModules } from '../../../../core/prime.import';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { Button } from '../../../../shared/Components/button/button';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import { OfferDetailApi } from '../../../Offers/models/offerList';
import { OfferDetailService } from '../../../Offers/services/offer-detail.service';
import {
  DraftPatch,
  RedemptionUploadPreview,
} from '../../components/redemption-upload-preview/redemption-upload-preview';
import { BulkUploadResponse } from '../../models/redemption.model';
import {
  RedemptionCatalogueService,
  asOfferArray,
  toTemplateOffer,
} from '../../services/redemption-catalogue.service';
import { RedemptionService } from '../../services/redemption.service';
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
import {
  RedemptionUploadError,
  parseRedemptionUpload,
  referencedOfferIds,
} from '../../utils/redemption-upload';

/** Full-page bulk upload: pick a file, review/fix every row, then submit.
 *  Owning the file picker is what makes a reload land on step 1 instead of a blank page. */
@Component({
  selector: 'app-redemption-bulk-upload',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, BackButton, Button, OfferTile, TranslatePipe, RedemptionUploadPreview],
  templateUrl: './redemption-bulk-upload.html',
  styleUrl: './redemption-bulk-upload.scss',
})
export class RedemptionBulkUpload {
  private readonly api = inject(RedemptionService);
  private readonly catalogueApi = inject(RedemptionCatalogueService);
  private readonly offerDetail = inject(OfferDetailService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  private static readonly OFFER_FETCH_CONCURRENCY = 6;

  readonly busy = signal(false);
  readonly skeletonTiles = [0, 1, 2];
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];
  readonly fileName = signal('');
  readonly fileErrors = signal<RedemptionUploadError[]>([]);
  readonly drafts = signal<RedemptionDraftRow[]>([]);
  readonly catalogue = signal<DraftCatalogue>(emptyDraftCatalogue());
  readonly branchesLoading = signal<ReadonlySet<string>>(new Set<string>());
  readonly serverErrors = signal<Map<string, string>>(new Map());

  /** Step 1 until a file parses into rows. */
  readonly hasRows = computed(() => this.drafts().length > 0);

  readonly errors = computed(() => {
    const catalogue = this.catalogue();
    const messages = this.draftMessages();
    const labels = this.draftLabels();
    const map = new Map<string, DraftErrors>();
    for (const draft of this.drafts()) {
      map.set(draft.id, validateDraft(draft, catalogue, messages, labels, this.formatDay));
    }
    return map;
  });

  readonly invalidCount = computed(() => {
    const errors = this.errors();
    return this.drafts().filter((d) => !isDraftValid(errors.get(d.id) ?? {})).length;
  });

  private readonly formatDay = (date: Date): string =>
    date.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  goBack(): void {
    void this.router.navigate(['/redemption']);
  }

  pickFile(input: HTMLInputElement): void {
    if (this.busy()) return;
    input.value = '';
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.busy.set(true);
    this.fileErrors.set([]);
    // A replaced file re-keys every row, so old server rejections can never match again.
    this.serverErrors.set(new Map());
    this.drafts.set([]);
    void this.parseUploadedFile(file);
  }

  clearFileErrors(): void {
    this.fileErrors.set([]);
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
        () =>
          firstValueFrom(this.catalogueApi.loadOfferCatalogue()).then((c) =>
            c.map(toTemplateOffer),
          ),
        {
          missingSheet: this.i18n.t('redemption.upload.missingSheet'),
          emptyFile: this.i18n.t('redemption.upload.emptyFile'),
        },
      );

      if (result.fileErrors.length) {
        this.busy.set(false);
        this.fileErrors.set(result.fileErrors);
        this.messageService.add({
          severity: 'warn',
          summary: this.i18n.t('redemption.toast.uploadInvalidSummary'),
          detail: this.i18n.t('redemption.toast.uploadInvalidDetail'),
          life: 6000,
        });
        return;
      }

      this.fileName.set(file.name);
      this.loadLiveCatalogue(result.drafts, result.catalogue);
    } catch (err) {
      console.error('Failed to parse uploaded file', err);
      this.busy.set(false);
      this.messageService.add({
        severity: 'error',
        summary: this.i18n.t('redemption.toast.uploadFailed'),
        detail: this.i18n.t('redemption.toast.genericErrorDetail'),
        life: 6000,
        closable: true,
      });
    }
  }

  /** Shows the parsed rows straight away, then swaps in the live offer/branch data. */
  private loadLiveCatalogue(drafts: RedemptionDraftRow[], fileCatalogue: DraftCatalogue): void {
    this.drafts.set(drafts);
    this.catalogue.set(fileCatalogue);

    const offerIds = referencedOfferIds(drafts);
    this.branchesLoading.set(new Set(offerIds));

    this.api
      .getActiveStoreOffers()
      .pipe(
        switchMap((offers) => {
          const liveOffers = asOfferArray(offers).map((o) => ({
            offerId: o.offerId,
            title: this.catalogueApi.localized(o.offerTitle, o.offerTitleAr),
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
              RedemptionBulkUpload.OFFER_FETCH_CONCURRENCY,
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
                  branchesByOffer.set(offerId, this.catalogueApi.toDraftBranches(locations));
                }
                const window = this.toOfferWindow(detail);
                if (window) windowsByOffer.set(offerId, window);
              }
              return { offers: liveOffers, branchesByOffer, windowsByOffer };
            }),
          );
        }),
        finalize(() => {
          this.busy.set(false);
          this.branchesLoading.set(new Set<string>());
        }),
      )
      .subscribe({
        next: (catalogue) => this.catalogue.set(catalogue),
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

  onPatch(patch: DraftPatch): void {
    if (this.serverErrors().has(patch.id)) {
      this.serverErrors.update((map) => {
        const next = new Map(map);
        next.delete(patch.id);
        return next;
      });
    }

    this.drafts.update((drafts) =>
      drafts.map((draft) => {
        if (draft.id !== patch.id) return draft;

        const next = { ...draft, [patch.field]: patch.value } as RedemptionDraftRow;

        if (patch.field === 'offerId') {
          next.branchId = null;
          next.branchText = '';
          next.offerText = this.catalogue().offers.find((o) => o.offerId === patch.value)?.title ?? '';
        }

        if (patch.field === 'branchId') {
          const branches = next.offerId
            ? this.catalogue().branchesByOffer.get(next.offerId)
            : undefined;
          next.branchText = branches?.find((b) => b.branchId === patch.value)?.label ?? '';
        }

        if (patch.field === 'transactionType') {
          if (patch.value === 'COLLECTIVE') {
            next.transactionDate = null;
            next.membershipId = '';
            next.mobileNumber = '';
            next.badgeNumber = '';
          } else {
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
    const catalogue = this.catalogue();
    if (catalogue.branchesByOffer.has(offerId) && catalogue.windowsByOffer.has(offerId)) return;
    if (this.branchesLoading().has(offerId)) return;

    this.branchesLoading.update((set) => new Set(set).add(offerId));

    forkJoin({
      locations: this.api.getOfferLocations(offerId).pipe(catchError(() => of(null))),
      detail: this.offerDetail.getOfferDetail(offerId).pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() =>
          this.branchesLoading.update((set) => {
            const next = new Set(set);
            next.delete(offerId);
            return next;
          }),
        ),
      )
      .subscribe({
        next: ({ locations, detail }) =>
          this.catalogue.update((c) => {
            const branchesByOffer = new Map(c.branchesByOffer);
            if (locations !== null) {
              branchesByOffer.set(offerId, this.catalogueApi.toDraftBranches(locations));
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

  onRemoveRow(id: string): void {
    this.drafts.update((drafts) => drafts.filter((d) => d.id !== id));
    this.serverErrors.update((map) => {
      if (!map.has(id)) return map;
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  submit(): void {
    const drafts = this.drafts();
    if (!drafts.length || this.busy()) return;

    // The button stays enabled so the click can say *why* it did nothing —
    // a disabled button fires no event and explains itself to nobody.
    if (this.invalidCount() > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.i18n.t('redemption.toast.uploadInvalidSummary'),
        detail: this.i18n.t('redemption.toast.uploadInvalidDetail'),
        life: 5000,
      });
      return;
    }

    this.serverErrors.set(new Map());
    this.busy.set(true);

    this.api
      .uploadBulkRedemptions(drafts.map(draftToPayload))
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (res) => this.applyBulkResult(drafts, res),
        error: (err: HttpErrorResponse) => {
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('redemption.toast.uploadFailed'),
            detail: extractApiErrorMessage(err) ?? this.i18n.t('redemption.toast.genericErrorDetail'),
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
      this.finishSuccess(res?.insertedCount ?? drafts.length);
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
      this.finishSuccess(inserted || drafts.length);
      return;
    }

    // Stay on the page: the rejected rows are still editable.
    this.drafts.update((rows) => rows.filter((r) => !insertedIds.has(r.id)));
    this.serverErrors.set(failures);

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

  /** The list on the redemption page reloads itself on init, so navigating is the refresh. */
  private finishSuccess(count: number): void {
    this.drafts.set([]);
    this.serverErrors.set(new Map());
    this.fileName.set('');
    this.messageService.add({
      severity: 'success',
      summary: this.i18n.t('redemption.toast.uploadSuccessSummary'),
      detail: this.i18n
        .t('redemption.toast.uploadSuccessDetail')
        .replace('{{count}}', String(count)),
      life: 5000,
    });
    this.goBack();
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
