import { REF_COL, REF_SHEET, TemplateOffer, uniqueTitles } from './redemption-template';
import {
  DraftBranch,
  DraftCatalogue,
  RedemptionDraftRow,
  emptyDraftCatalogue,
} from './redemption-draft';

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

export interface FileMessages {
  missingSheet: string;
  emptyFile: string;
}

export interface RedemptionUploadResult {
  drafts: RedemptionDraftRow[];
  catalogue: DraftCatalogue;
  fileErrors: RedemptionUploadError[];
  rowsRead: number;
  usedEmbeddedIds: boolean;
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

function toLocalDate(value: unknown, raw: string): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

interface OfferRef {
  offerId: string;
  title: string;
}

interface NameIndex {
  offerByTitle: Map<string, OfferRef>;
  branchesByOffer: Map<string, Map<string, DraftBranch>>;
}

function emptyIndex(): NameIndex {
  return { offerByTitle: new Map(), branchesByOffer: new Map() };
}

function addTitle(map: Map<string, OfferRef>, title: string, ref: OfferRef, force: boolean): void {
  const key = title.trim().toLowerCase();
  if (!key) return;
  if (force || !map.has(key)) map.set(key, ref);
}

function addBranch(index: NameIndex, offerId: string, ref: DraftBranch): void {
  let map = index.branchesByOffer.get(offerId);
  if (!map) {
    map = new Map();
    index.branchesByOffer.set(offerId, map);
  }
  map.set(ref.label.trim().toLowerCase(), ref);
  const bare = ref.label.split('—')[0]?.trim().toLowerCase();
  if (bare && !map.has(bare)) map.set(bare, ref);
}

function toCatalogue(index: NameIndex): DraftCatalogue {
  const offers = new Map<string, string>();
  for (const ref of index.offerByTitle.values()) {
    if (!offers.has(ref.offerId)) offers.set(ref.offerId, ref.title);
  }

  const branchesByOffer = new Map<string, DraftBranch[]>();
  for (const [offerId, branches] of index.branchesByOffer) {
    const unique = new Map<string, DraftBranch>();
    for (const branch of branches.values()) unique.set(branch.branchId, branch);
    branchesByOffer.set(offerId, [...unique.values()]);
  }

  return {
    offers: [...offers].map(([offerId, title]) => ({ offerId, title })),
    branchesByOffer,
    windowsByOffer: new Map(),
  };
}

interface RowLike {
  getCell(col: number): { value: unknown };
}

function indexFromRefSheet(sheet: {
  eachRow: (cb: (row: RowLike, n: number) => void) => void;
}): NameIndex {
  const index = emptyIndex();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const offerId = cellText(row.getCell(REF_COL.offerId).value);
    const offerTitle = cellText(row.getCell(REF_COL.offerTitle).value);
    if (!offerId || !offerTitle) return;

    addTitle(index.offerByTitle, offerTitle, { offerId, title: offerTitle }, false);

    const branchId = cellText(row.getCell(REF_COL.branchId).value);
    const label = cellText(row.getCell(REF_COL.branchLabel).value);
    if (branchId && label) {
      addBranch(index, offerId, { branchId, label });
    } else if (!index.branchesByOffer.has(offerId)) {
      index.branchesByOffer.set(offerId, new Map());
    }
  });

  return index;
}

function indexFromOffers(offers: TemplateOffer[]): NameIndex {
  const index = emptyIndex();
  const titles = uniqueTitles(offers);

  offers.forEach((offer, i) => {
    addTitle(index.offerByTitle, titles[i], { offerId: offer.offerId, title: titles[i] }, true);
    for (const branch of offer.branches) {
      addBranch(index, offer.offerId, { branchId: branch.id, label: branch.label });
    }
  });
  offers.forEach((offer, i) => {
    addTitle(index.offerByTitle, offer.title, { offerId: offer.offerId, title: titles[i] }, false);
  });

  return index;
}


export async function parseRedemptionUpload(
  file: File | ArrayBuffer,
  loadFallbackOffers: () => Promise<TemplateOffer[]>,
  messages: FileMessages,
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
      drafts: [],
      catalogue: emptyDraftCatalogue(),
      fileErrors: [{ row: 0, message: messages.missingSheet }],
      rowsRead: 0,
      usedEmbeddedIds: false,
    };
  }

  const refSheet = workbook.getWorksheet(REF_SHEET);
  const usedEmbeddedIds = !!refSheet;
  const index = refSheet
    ? indexFromRefSheet(
        refSheet as unknown as { eachRow: (cb: (row: RowLike, n: number) => void) => void },
      )
    : indexFromOffers(await loadFallbackOffers());

  const drafts: RedemptionDraftRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < FIRST_DATA_ROW) return;

    const get = (col: number) => cellText(row.getCell(col).value);

    const membershipId = get(COL.membershipId);
    const offerText = get(COL.offer);
    const branchText = get(COL.branch);
    const dateRaw = get(COL.transactionDate);
    const startRaw = get(COL.startDate);
    const endRaw = get(COL.endDate);
    const totalAmountIncVat = get(COL.totalAmountIncVat);
    const totalAmountPaid = get(COL.totalAmountPaid);
    const currency = get(COL.currency);
    const discountAmount = get(COL.discountAmount);

    const isBlank =
      !membershipId &&
      !offerText &&
      !branchText &&
      !dateRaw &&
      !startRaw &&
      !endRaw &&
      !totalAmountIncVat &&
      !totalAmountPaid &&
      !discountAmount;
    if (isBlank) return;

    const typeRaw = get(COL.transactionType).trim().toUpperCase();
    const transactionType = typeRaw === 'COLLECTIVE' ? 'COLLECTIVE' : 'SINGLE';

    const offerRef = index.offerByTitle.get(offerText.toLowerCase());
    const offerId = offerRef?.offerId ?? null;

    const branchRef = offerId
      ? index.branchesByOffer.get(offerId)?.get(branchText.toLowerCase())
      : undefined;

    drafts.push({
      id: `row-${rowNumber}`,
      sourceRow: rowNumber,
      transactionType,
      membershipId,
      mobileNumber: get(COL.mobileNumber),
      offerId,
      offerText,
      branchId: branchRef?.branchId ?? null,
      branchText,
      transactionDate:
        transactionType === 'COLLECTIVE'
          ? null
          : toLocalDate(row.getCell(COL.transactionDate).value, dateRaw),
      startDate:
        transactionType === 'COLLECTIVE'
          ? toLocalDate(row.getCell(COL.startDate).value, startRaw)
          : null,
      endDate:
        transactionType === 'COLLECTIVE'
          ? toLocalDate(row.getCell(COL.endDate).value, endRaw)
          : null,
      totalAmountIncVat,
      totalAmountPaid,
      currency,
      discountAmount,
    });
  });

  const fileErrors: RedemptionUploadError[] = drafts.length
    ? []
    : [{ row: 0, message: messages.emptyFile }];

  return {
    drafts,
    catalogue: toCatalogue(index),
    fileErrors,
    rowsRead: drafts.length,
    usedEmbeddedIds,
  };
}

export function referencedOfferIds(drafts: RedemptionDraftRow[]): string[] {
  return Array.from(new Set(drafts.map((d) => d.offerId).filter((id): id is string => !!id)));
}
