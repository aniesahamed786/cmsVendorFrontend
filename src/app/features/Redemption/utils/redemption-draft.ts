import { RecordRedemptionPayload } from '../models/redemption.model';

export interface RedemptionDraftRow {
  id: string;
  sourceRow: number;
  transactionType: 'SINGLE' | 'COLLECTIVE';
  membershipId: string;
  mobileNumber: string;
  offerId: string | null;
  offerText: string;
  branchId: string | null;
  branchText: string;
  transactionDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  totalAmountIncVat: string;
  totalAmountPaid: string;
  currency: string;
  discountAmount: string;
}

export type DraftField =
  | 'transactionType'
  | 'membershipId'
  | 'mobileNumber'
  | 'offerId'
  | 'branchId'
  | 'transactionDate'
  | 'startDate'
  | 'endDate'
  | 'totalAmountIncVat'
  | 'totalAmountPaid'
  | 'currency'
  | 'discountAmount';

export type DraftErrors = Partial<Record<DraftField, string>>;

export interface DraftOffer {
  offerId: string;
  title: string;
}

export interface DraftBranch {
  branchId: string;
  label: string;
}

export interface OfferWindow {
  start: Date | null;
  end: Date | null;
}

export interface DraftCatalogue {
  offers: DraftOffer[];
  branchesByOffer: Map<string, DraftBranch[]>;
  windowsByOffer: Map<string, OfferWindow>;
}

export interface DraftMessages {
  required: string;
  notANumber: string;
  negativeAmount: string;
  invalidMembershipId: string;
  invalidDate: string;
  startDateRequired: string;
  endDateRequired: string;
  endBeforeStart: string;
  unknownOffer: string;
  unknownBranch: string;
  outsideOfferWindow: string;
}

export type DateFormatter = (date: Date) => string;

export type DraftLabels = Record<
  | 'membershipId'
  | 'offer'
  | 'branch'
  | 'transactionDate'
  | 'startDate'
  | 'endDate'
  | 'totalAmountIncVat'
  | 'totalAmountPaid'
  | 'currency'
  | 'discountAmount',
  string
>;

function fill(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (out, [key, value]) => out.split(`{{${key}}}`).join(value),
    template,
  );
}

export function emptyDraftCatalogue(): DraftCatalogue {
  return { offers: [], branchesByOffer: new Map(), windowsByOffer: new Map() };
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function outsideWindow(day: Date, window: OfferWindow): boolean {
  const value = startOfDay(day);
  if (window.start && value < startOfDay(window.start)) return true;
  if (window.end && value > startOfDay(window.end)) return true;
  return false;
}

export function isValidDate(value: Date | null): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function membershipNumber(raw: string): number | null {
  const text = raw.trim().replace(/\.0+$/, '');
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n > 0 ? n : null;
}

export function parseAmount(raw: string): number | null {
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function validateDraft(
  draft: RedemptionDraftRow,
  catalogue: DraftCatalogue,
  messages: DraftMessages,
  labels: DraftLabels,
  formatDate: DateFormatter = (d) => d.toLocaleDateString(),
): DraftErrors {
  const errors: DraftErrors = {};
  const collective = draft.transactionType === 'COLLECTIVE';

  const membershipRaw = draft.membershipId.trim();
  if (!membershipRaw) {
    if (!collective) errors.membershipId = fill(messages.required, { field: labels.membershipId });
  } else if (membershipNumber(membershipRaw) === null) {
    errors.membershipId = messages.invalidMembershipId;
  }

  if (!draft.offerId) {
    errors.offerId = draft.offerText.trim()
      ? fill(messages.unknownOffer, { value: draft.offerText.trim() })
      : fill(messages.required, { field: labels.offer });
  } else if (!catalogue.offers.some((o) => o.offerId === draft.offerId)) {
    errors.offerId = fill(messages.unknownOffer, {
      value: draft.offerText.trim() || draft.offerId,
    });
  }

  if (draft.branchId && draft.offerId) {
    const branches = catalogue.branchesByOffer.get(draft.offerId);
    if (branches && !branches.some((b) => b.branchId === draft.branchId)) {
      errors.branchId = fill(messages.unknownBranch, {
        value: draft.branchText.trim() || draft.branchId,
      });
    }
  }

  if (collective) {
    if (!draft.startDate) errors.startDate = messages.startDateRequired;
    else if (!isValidDate(draft.startDate)) errors.startDate = messages.invalidDate;

    if (!draft.endDate) errors.endDate = messages.endDateRequired;
    else if (!isValidDate(draft.endDate)) errors.endDate = messages.invalidDate;

    if (
      isValidDate(draft.startDate) &&
      isValidDate(draft.endDate) &&
      draft.startDate.getTime() > draft.endDate.getTime()
    ) {
      errors.endDate = messages.endBeforeStart;
    }
  } else if (!draft.transactionDate) {
    errors.transactionDate = fill(messages.required, { field: labels.transactionDate });
  } else if (!isValidDate(draft.transactionDate)) {
    errors.transactionDate = messages.invalidDate;
  }

  const window = draft.offerId ? catalogue.windowsByOffer.get(draft.offerId) : undefined;
  if (window && (window.start || window.end)) {
    const range = {
      start: window.start ? formatDate(window.start) : '—',
      end: window.end ? formatDate(window.end) : '—',
    };

    const windowChecks: [DraftField, Date | null, string][] = collective
      ? [
          ['startDate', draft.startDate, labels.startDate],
          ['endDate', draft.endDate, labels.endDate],
        ]
      : [['transactionDate', draft.transactionDate, labels.transactionDate]];

    for (const [field, value, label] of windowChecks) {
      if (errors[field] || !isValidDate(value)) continue;
      if (outsideWindow(value, window)) {
        errors[field] = fill(messages.outsideOfferWindow, { field: label, ...range });
      }
    }
  }

  const amounts: [DraftField, string, string][] = [
    ['totalAmountIncVat', draft.totalAmountIncVat, labels.totalAmountIncVat],
    ['totalAmountPaid', draft.totalAmountPaid, labels.totalAmountPaid],
    ['discountAmount', draft.discountAmount, labels.discountAmount],
  ];

  for (const [field, raw, label] of amounts) {
    const text = String(raw ?? '').trim();
    if (!text) {
      errors[field] = fill(messages.required, { field: label });
      continue;
    }
    const value = parseAmount(text);
    if (value === null) errors[field] = fill(messages.notANumber, { field: label });
    else if (value < 0) errors[field] = fill(messages.negativeAmount, { field: label });
  }

  if (!draft.currency.trim()) {
    errors.currency = fill(messages.required, { field: labels.currency });
  }

  return errors;
}

export function isDraftValid(errors: DraftErrors): boolean {
  return Object.keys(errors).length === 0;
}

export function toIsoDay(date: Date, endOfDay = false): string {
  const ms = endOfDay
    ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0)
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

export function draftToPayload(draft: RedemptionDraftRow): RecordRedemptionPayload {
  const mobileNumber = draft.mobileNumber.trim();
  const branchId = (draft.branchId ?? '').trim();
  const membershipRaw = draft.membershipId.trim().replace(/\.0+$/, '');

  const common = {
    offerId: draft.offerId!,
    totalAmountIncVat: parseAmount(draft.totalAmountIncVat)!,
    totalAmountPaid: parseAmount(draft.totalAmountPaid)!,
    currency: draft.currency.trim().toUpperCase(),
    discountAmount: parseAmount(draft.discountAmount)!,
    ...(mobileNumber ? { mobileNumber } : {}),
    ...(branchId ? { branchId } : {}),
  };

  if (draft.transactionType === 'COLLECTIVE') {
    return {
      ...common,
      transactionType: 'COLLECTIVE',
      startDate: toIsoDay(draft.startDate!),
      endDate: toIsoDay(draft.endDate!, true),
      ...(membershipRaw ? { membershipId: Number(membershipRaw) } : {}),
    };
  }

  return {
    ...common,
    transactionType: 'SINGLE',
    membershipId: Number(membershipRaw),
    transactionDate: toIsoDay(draft.transactionDate!),
  };
}
