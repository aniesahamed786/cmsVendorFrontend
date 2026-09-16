import { describe, it, expect } from 'vitest';
import { toOfferDetailsView } from './request-entity-view.mapper';

describe('toOfferDetailsView mode conditioning', () => {
  it('maps in-store to in-store offerMode', () => {
    const view = toOfferDetailsView({ offerMode: 'in-store' });
    expect(view['offerMode']).toBe('in-store');
  });

  it('maps in store to in-store offerMode', () => {
    const view = toOfferDetailsView({ offerMode: 'in store' });
    expect(view['offerMode']).toBe('in-store');
  });

  it('maps digital to digital offerMode', () => {
    const view = toOfferDetailsView({ offerMode: 'digital' });
    expect(view['offerMode']).toBe('digital');
  });

  it('maps online to digital offerMode', () => {
    const view = toOfferDetailsView({ offerMode: 'online' });
    expect(view['offerMode']).toBe('digital');
  });

  it('maps hybrid to in-store, digital offerMode', () => {
    const view = toOfferDetailsView({ offerMode: 'in-store, digital' });
    expect(view['offerMode']).toBe('in-store, digital');
  });

  it('handles array offerMode correctly', () => {
    const inStoreView = toOfferDetailsView({ offerMode: ['in-store'] });
    expect(inStoreView['offerMode']).toBe('in-store');

    const digitalView = toOfferDetailsView({ offerMode: ['digital'] });
    expect(digitalView['offerMode']).toBe('digital');

    const bothView = toOfferDetailsView({ offerMode: ['in-store', 'digital'] });
    expect(bothView['offerMode']).toBe('in-store, digital');
  });

  it('defaults to in-store when offerMode is omitted', () => {
    const view = toOfferDetailsView({});
    expect(view['offerMode']).toBe('in-store');
  });
});
