import { mapFormModeToOfferMode, mapOfferModeToFormMode } from './createOffer';

describe('offerMode mapping', () => {
  it('sends the new payload values', () => {
    expect(mapFormModeToOfferMode('In-Store')).toBe('in-store');
    expect(mapFormModeToOfferMode('Digital')).toBe('digital');
    expect(mapFormModeToOfferMode('In-Store & Digital')).toBe('in-store, digital');
    expect(mapFormModeToOfferMode(null)).toBe('in-store');
  });

  it('reads new and legacy values back', () => {
    expect(mapOfferModeToFormMode('in-store, digital')).toBe('In-Store & Digital');
    expect(mapOfferModeToFormMode('digital')).toBe('Digital');
    expect(mapOfferModeToFormMode('in-store')).toBe('In-Store');
    expect(mapOfferModeToFormMode('both')).toBe('In-Store & Digital');
    expect(mapOfferModeToFormMode('online')).toBe('Digital');
    expect(mapOfferModeToFormMode('in store')).toBe('In-Store');
    expect(mapOfferModeToFormMode(null)).toBe('In-Store');
  });
});
