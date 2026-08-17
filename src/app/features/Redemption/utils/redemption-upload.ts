import { RecordRedemptionPayload } from '../models/redemption.model';
import { REF_COL, REF_SHEET, TemplateOffer, uniqueTitles } from './redemption-template';

const COL = {
  membershipId: 1,
  mobileNumber: 2,
  transactionType: 3,
  offer: 4,
  branch: 5,
  transactionDate: 6,
  startDate: 7,
  endDate: 8,
  totalAmountIncVat: 9,
  totalAmountPaid: 10,
  currency: 11,
  discountAmount: 12,
} as const;

const FIRST_DATA_ROW = 2;

export interface RedemptionUploadError {
  row: number;
  message: string;
}

export interface ResolvedRedemptionRow {
  row: number;
  payload: RecordRedemptionPayload;
  offer: { offerId: string; title: string; raw?: unknown };
  branch?: { branchId: string; label: string; raw?: unknown };
}

export interface RedemptionUploadResult {
  payloads: RecordRedemptionPayload[];
  rows: ResolvedRedemptionRow[];
  errors: RedemptionUploadError[];
  rowsRead: number;
  usedEmbeddedIds: boolean;
}

export interface UploadMessages {
  missingSheet: string;
  emptyFile: string;
  unknownOffer: string;
  unknownBranch: string;
  required: string;
  notANumber: string;
  negativeAmount: string;
  invalidDate: string;
  invalidMembershipId: string;
  startDateRequired: string;
  endDateRequired: string;
  endBeforeStart: string;
  invalidTransactionType: string;
  offerNoLongerActive: string;
  branchNoLongerAvailable: string;
}

function t(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (out, [key, value]) => out.split(`{{${key}}}`).join(value),
    template,
  );
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();

  const obj = value as Record<string, unknown>;
  if (typeof obj['text'] === 'string') return (obj['text'] as string).trim();
  if (obj['result'] !== undefined) return cellText(obj['result']);
  if (Array.isArray(obj['richText'])) {
    return (obj['richText'] as { text?: string }[])
      .map((r) => r.text ?? '')
      .join('')
      .trim();
  }
  return String(value).trim();
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value: unknown, raw: string, endOfDay = false): string | null {
  let year: number;
  let month: number;
  let day: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    year = value.getUTCFullYear();
    month = value.getUTCMonth();
    day = value.getUTCDate();
  } else {
    if (!raw) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]) - 1;
      day = Number(iso[3]);
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  }

  const ms = endOfDay
    ? Date.UTC(year, month, day, 23, 59, 59, 0)
    : Date.UTC(year, month, day, 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

interface OfferRef {
  offerId: string;
  title: string;
  raw?: unknown;
}

interface BranchRef {
  branchId: string;
  label: string;
  raw?: unknown;
}

interface Catalogue {
  offerByTitle: Map<string, OfferRef>;
  branchesByOffer: Map<string, Map<string, BranchRef>>;
}

function emptyCatalogue(): Catalogue {
  return { offerByTitle: new Map(), branchesByOffer: new Map() };
}

function addTitle(map: Map<string, OfferRef>, title: string, ref: OfferRef, force: boolean): void {
  const key = title.trim().toLowerCase();
  if (!key) return;
  if (force || !map.has(key)) map.set(key, ref);
}

function addBranch(catalogue: Catalogue, offerId: string, ref: BranchRef): void {
  let map = catalogue.branchesByOffer.get(offerId);
  if (!map) {
    map = new Map();
    catalogue.branchesByOffer.set(offerId, map);
  }
  map.set(ref.label.trim().toLowerCase(), ref);
  const bare = ref.label.split('—')[0]?.trim().toLowerCase();
  if (bare && !map.has(bare)) map.set(bare, ref);
}

function catalogueFromRefSheet(sheet: {
  eachRow: (cb: (row: RowLike, n: number) => void) => void;
}): Catalogue {
  const catalogue = emptyCatalogue();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const offerId = cellText(row.getCell(REF_COL.offerId).value);
    const offerTitle = cellText(row.getCell(REF_COL.offerTitle).value);
    if (!offerId || !offerTitle) return;

    const offerRaw = parseJson(cellText(row.getCell(REF_COL.offerJson).value));
    const offerRef: OfferRef = { offerId, title: offerTitle, raw: offerRaw };
    addTitle(catalogue.offerByTitle, offerTitle, offerRef, false);

    const branchId = cellText(row.getCell(REF_COL.branchId).value);
    const label = cellText(row.getCell(REF_COL.branchLabel).value);
    if (branchId && label) {
      addBranch(catalogue, offerId, {
        branchId,
        label,
        raw: parseJson(cellText(row.getCell(REF_COL.branchJson).value)),
      });
    } else if (!catalogue.branchesByOffer.has(offerId)) {
      catalogue.branchesByOffer.set(offerId, new Map());
    }
  });

  return catalogue;
}

function catalogueFromOffers(offers: TemplateOffer[]): Catalogue {
  const catalogue = emptyCatalogue();
  const titles = uniqueTitles(offers);

  offers.forEach((offer, i) => {
    const ref: OfferRef = { offerId: offer.offerId, title: titles[i], raw: offer.raw };
    addTitle(catalogue.offerByTitle, titles[i], ref, true);
    for (const branch of offer.branches) {
      addBranch(catalogue, offer.offerId, {
        branchId: branch.id,
        label: branch.label,
        raw: branch.raw,
      });
    }
  });
  offers.forEach((offer, i) => {
    addTitle(
      catalogue.offerByTitle,
      offer.title,
      { offerId: offer.offerId, title: titles[i], raw: offer.raw },
      false,
    );
  });

  return catalogue;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface RowLike {
  getCell(col: number): { value: unknown };
}

/**
 * @param file             the uploaded .xlsx
 * @param offers           active offers, in the same order used to build the template
 * @param branchIdsByOffer offerId -> (branch label -> branchId)
 */
export async function parseRedemptionUpload(
  file: File | ArrayBuffer,
  loadFallbackOffers: () => Promise<TemplateOffer[]>,
  messages: UploadMessages,
  labels: Record<
    | 'membershipId'
    | 'offer'
    | 'branch'
    | 'transactionDate'
    | 'totalAmountIncVat'
    | 'totalAmountPaid'
    | 'currency'
    | 'discountAmount',
    string
  >,
): Promise<RedemptionUploadResult> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const sheet =
    workbook.worksheets.find((w) => w.name !== 'Lists' && w.name !== REF_SHEET) ??
    workbook.worksheets[0];
  if (!sheet) {
    return {
      payloads: [],
      rows: [],
      errors: [{ row: 0, message: messages.missingSheet }],
      rowsRead: 0,
      usedEmbeddedIds: false,
    };
  }

  const refSheet = workbook.getWorksheet(REF_SHEET);
  const usedEmbeddedIds = !!refSheet;
  const catalogue = refSheet
    ? catalogueFromRefSheet(
        refSheet as unknown as { eachRow: (cb: (row: RowLike, n: number) => void) => void },
      )
    : catalogueFromOffers(await loadFallbackOffers());

  const payloads: RecordRedemptionPayload[] = [];
  const rows: ResolvedRedemptionRow[] = [];
  const errors: RedemptionUploadError[] = [];
  let rowsRead = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < FIRST_DATA_ROW) return;

    const get = (col: number) => cellText(row.getCell(col).value);

    const membershipRaw = get(COL.membershipId);
    const offerTitle = get(COL.offer);
    const branchText = get(COL.branch);
    const dateRaw = get(COL.transactionDate);
    const startRaw = get(COL.startDate);
    const endRaw = get(COL.endDate);
    const incVatRaw = get(COL.totalAmountIncVat);
    const paidRaw = get(COL.totalAmountPaid);
    const currency = get(COL.currency);
    const discountRaw = get(COL.discountAmount);

    const isBlank =
      !membershipRaw &&
      !offerTitle &&
      !branchText &&
      !dateRaw &&
      !startRaw &&
      !endRaw &&
      !incVatRaw &&
      !paidRaw &&
      !discountRaw;
    if (isBlank) return;

    rowsRead++;
    const rowErrors: string[] = [];

    const typeRaw = get(COL.transactionType).trim().toUpperCase();
    if (typeRaw && typeRaw !== 'SINGLE' && typeRaw !== 'COLLECTIVE') {
      rowErrors.push(t(messages.invalidTransactionType, { value: get(COL.transactionType) }));
    }
    const isCollective = typeRaw === 'COLLECTIVE';

    const membershipText = membershipRaw.replace(/\.0+$/, '');
    const membershipId = Number(membershipText);
    const hasMembership = !!membershipRaw;
    if (!hasMembership) {
      if (!isCollective) rowErrors.push(t(messages.required, { field: labels.membershipId }));
    } else if (!/^\d+$/.test(membershipText) || membershipId <= 0) {
      rowErrors.push(messages.invalidMembershipId);
    }

    const offerRef = catalogue.offerByTitle.get(offerTitle.toLowerCase());
    const offerId = offerRef?.offerId;
    if (!offerTitle) rowErrors.push(t(messages.required, { field: labels.offer }));
    else if (!offerId) rowErrors.push(t(messages.unknownOffer, { value: offerTitle }));

    let branchRef: BranchRef | undefined;
    if (branchText) {
      const branchMap = offerId ? catalogue.branchesByOffer.get(offerId) : undefined;
      branchRef = branchMap?.get(branchText.toLowerCase());
      if (offerId && !branchRef) rowErrors.push(t(messages.unknownBranch, { value: branchText }));
    }

    let transactionDate: string | null = null;
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (isCollective) {
      startDate = toIsoDate(row.getCell(COL.startDate).value, startRaw);
      endDate = toIsoDate(row.getCell(COL.endDate).value, endRaw, true);

      if (!startRaw) rowErrors.push(messages.startDateRequired);
      else if (!startDate) rowErrors.push(messages.invalidDate);

      if (!endRaw) rowErrors.push(messages.endDateRequired);
      else if (!endDate) rowErrors.push(messages.invalidDate);

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        rowErrors.push(messages.endBeforeStart);
      }
    } else {
      transactionDate = toIsoDate(row.getCell(COL.transactionDate).value, dateRaw);
      if (!dateRaw) rowErrors.push(t(messages.required, { field: labels.transactionDate }));
      else if (!transactionDate) rowErrors.push(messages.invalidDate);
    }

    const amount = (raw: string, field: string): number | null => {
      if (!raw) {
        rowErrors.push(t(messages.required, { field }));
        return null;
      }
      const value = toNumber(raw);
      if (value === null) {
        rowErrors.push(t(messages.notANumber, { field }));
        return null;
      }
      if (value < 0) {
        rowErrors.push(t(messages.negativeAmount, { field }));
        return null;
      }
      return value;
    };

    const totalAmountIncVat = amount(incVatRaw, labels.totalAmountIncVat);
    const totalAmountPaid = amount(paidRaw, labels.totalAmountPaid);
    const discountAmount = amount(discountRaw, labels.discountAmount);

    if (!currency) rowErrors.push(t(messages.required, { field: labels.currency }));

    if (rowErrors.length) {
      for (const message of rowErrors) errors.push({ row: rowNumber, message });
      return;
    }

    const mobileNumber = get(COL.mobileNumber);
    const common = {
      offerId: offerId!,
      totalAmountIncVat: totalAmountIncVat!,
      totalAmountPaid: totalAmountPaid!,
      currency: currency.toUpperCase(),
      discountAmount: discountAmount!,
      ...(mobileNumber ? { mobileNumber } : {}),
      ...(branchRef ? { branchId: branchRef.branchId } : {}),
    };

    const payload: RecordRedemptionPayload = isCollective
      ? {
          ...common,
          transactionType: 'COLLECTIVE',
          startDate: startDate!,
          endDate: endDate!,
          ...(hasMembership ? { membershipId } : {}),
        }
      : {
          ...common,
          transactionType: 'SINGLE',
          membershipId,
          transactionDate: transactionDate!,
        };

    payloads.push(payload);
    rows.push({
      row: rowNumber,
      payload,
      offer: offerRef!,
      ...(branchRef ? { branch: branchRef } : {}),
    });
  });

  if (!rowsRead && !errors.length) {
    errors.push({ row: 0, message: messages.emptyFile });
  }

  return { payloads, rows, errors, rowsRead, usedEmbeddedIds };
}

export interface LiveCatalogue {
  activeOfferIds: Set<string>;
  branchIdsByOffer: Map<string, Set<string>>;
}

export function validateAgainstLiveCatalogue(
  rows: ResolvedRedemptionRow[],
  live: LiveCatalogue,
  messages: Pick<UploadMessages, 'offerNoLongerActive' | 'branchNoLongerAvailable'>,
): RedemptionUploadError[] {
  const errors: RedemptionUploadError[] = [];

  for (const entry of rows) {
    const offerId = entry.payload.offerId;

    if (!live.activeOfferIds.has(offerId)) {
      errors.push({
        row: entry.row,
        message: t(messages.offerNoLongerActive, { value: entry.offer.title }),
      });
      continue;
    }

    const branchId = entry.payload.branchId;
    if (!branchId) continue;

    const validBranches = live.branchIdsByOffer.get(offerId);
    if (validBranches && !validBranches.has(branchId)) {
      errors.push({
        row: entry.row,
        message: t(messages.branchNoLongerAvailable, {
          value: entry.branch?.label ?? branchId,
        }),
      });
    }
  }

  return errors;
}

export function referencedOfferIds(rows: ResolvedRedemptionRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.payload.offerId).filter(Boolean)));
}
