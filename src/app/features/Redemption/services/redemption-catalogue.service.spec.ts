import { describe, expect, it } from 'vitest';
import { offerDayUtc } from './redemption-catalogue.service';

describe('offerDayUtc', () => {
  it('preserves a Riyadh calendar date when midnight is the previous UTC day', () => {
    const result = offerDayUtc('2026-10-30T21:00:00.000Z');

    expect(result?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('preserves an ISO date-only value', () => {
    const result = offerDayUtc({ $date: '2026-10-31' });

    expect(result?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('returns null for missing or invalid values', () => {
    expect(offerDayUtc(undefined)).toBeNull();
    expect(offerDayUtc('not-a-date')).toBeNull();
  });
});
