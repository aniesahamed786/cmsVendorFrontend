import { describe, expect, it } from 'vitest';
import { OfferDetailApi } from './offerList';
import { toEditableOfferData } from './offer-edit.mapper';

function offerWithAvailability(availability: string[]): OfferDetailApi {
  return { availability } as OfferDetailApi;
}

describe('toEditableOfferData', () => {
  it.each([
    [['digital'], 'online'],
    [['online'], 'online'],
    [['in-store'], 'in store'],
    [['instore'], 'in store'],
    [['in-store', 'digital'], 'both'],
    [['hybrid'], 'both'],
  ])('maps availability %j to offer mode %s', (availability, expectedMode) => {
    const editableOffer = toEditableOfferData(offerWithAvailability(availability));

    expect(editableOffer['offerMode']).toBe(expectedMode);
  });
});
