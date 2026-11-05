import { describe, expect, it } from 'vitest';
import {
  DraftLabels,
  DraftMessages,
  RedemptionDraftRow,
  draftToPayload,
  emptyDraftCatalogue,
  validateDraft,
} from './redemption-draft';

const messages: DraftMessages = {
  required: '{{field}} is required',
  notANumber: '{{field}} must be a number',
  negativeAmount: '{{field}} cannot be negative',
  invalidMembershipId: 'Invalid membership ID',
  invalidDate: 'Invalid date',
  futureDate: '{{field}} cannot be in the future',
  startDateRequired: 'Start date is required',
  endDateRequired: 'End date is required',
  endBeforeStart: 'End date cannot be before start date',
  unknownOffer: 'Unknown offer {{value}}',
  unknownBranch: 'Unknown branch {{value}}',
  outsideOfferWindow: '{{field}} is outside {{start}} and {{end}}',
};

const labels: DraftLabels = {
  membershipId: 'Membership ID',
  offer: 'Offer',
  branch: 'Branch',
  transactionDate: 'Transaction date',
  startDate: 'Start date',
  endDate: 'End date',
  totalAmountIncVat: 'Invoice amount',
  totalAmountPaid: 'Paid amount',
  currency: 'Currency',
  discountAmount: 'Discount',
};

function collectiveDraft(overrides: Partial<RedemptionDraftRow> = {}): RedemptionDraftRow {
  return {
    id: 'row-2',
    sourceRow: 2,
    transactionType: 'COLLECTIVE',
    membershipId: '',
    mobileNumber: '',
    badgeNumber: '',
    offerId: null,
    offerText: '',
    branchId: null,
    branchText: '',
    transactionDate: null,
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 0, 31),
    totalAmountIncVat: '100',
    totalAmountPaid: '80',
    currency: 'sar',
    discountAmount: '20.00',
    ...overrides,
  };
}

describe('collective redemption drafts', () => {
  it('accepts a collective row without an offer', () => {
    const errors = validateDraft(collectiveDraft(), emptyDraftCatalogue(), messages, labels);

    expect(errors.offerId).toBeUndefined();
    expect(errors).toEqual({});
  });

  it('omits offerId from an offerless collective payload', () => {
    const payload = draftToPayload(collectiveDraft());

    expect(payload.transactionType).toBe('COLLECTIVE');
    expect(payload).not.toHaveProperty('offerId');
  });

  it('still rejects an offer name that cannot be resolved', () => {
    const errors = validateDraft(
      collectiveDraft({ offerText: 'Deleted offer' }),
      emptyDraftCatalogue(),
      messages,
      labels,
    );

    expect(errors.offerId).toBe('Unknown offer Deleted offer');
  });

  it('still requires an offer for a single row', () => {
    const errors = validateDraft(
      collectiveDraft({
        transactionType: 'SINGLE',
        membershipId: '123',
        transactionDate: new Date(2026, 0, 15),
        startDate: null,
        endDate: null,
      }),
      emptyDraftCatalogue(),
      messages,
      labels,
    );

    expect(errors.offerId).toBe('Offer is required');
  });
});
