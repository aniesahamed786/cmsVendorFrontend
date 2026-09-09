import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = new Date('2026-09-09T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('returns empty for missing or unparseable input', () => {
    expect(timeAgo('', false, now)).toBe('');
    expect(timeAgo('not-a-date', false, now)).toBe('');
  });

  it('buckets by minute, hour and day', () => {
    expect(timeAgo(ago(10_000), false, now)).toBe('this minute');
    expect(timeAgo(ago(5 * 60_000), false, now)).toBe('5m ago');
    expect(timeAgo(ago(3 * 3_600_000), false, now)).toBe('3h ago');
    expect(timeAgo(ago(7 * 86_400_000), false, now)).toBe('7d ago');
  });

  it('keeps Latin digits in Arabic', () => {
    expect(timeAgo(ago(7 * 86_400_000), true, now)).toMatch(/7/);
  });
});
