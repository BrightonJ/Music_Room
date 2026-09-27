import { describe, expect, it } from '@jest/globals';
import { formatDate, formatDateTime, formatIsoDate, fromIsoDate, toIsoDate } from '../dates';

describe('birth dates', () => {
  it('round-trips without shifting the day', () => {
    const date = fromIsoDate('2000-01-15')!;
    expect(date.getDate()).toBe(15);
    expect(toIsoDate(date)).toBe('2000-01-15');
  });

  it('accepts timestamps returned by older backends', () => {
    expect(toIsoDate(fromIsoDate('2000-01-15T00:00:00.000Z')!)).toBe('2000-01-15');
  });

  it('rejects empty or invalid values', () => {
    expect(fromIsoDate(null)).toBeNull();
    expect(fromIsoDate('15/01/2000')).toBeNull();
    expect(formatIsoDate(undefined)).toBe('');
  });

  it('formats for display', () => {
    expect(formatDate(new Date(2000, 0, 5))).toBe('05/01/2000');
    expect(formatDateTime(new Date(2026, 5, 21, 9, 7))).toBe('21/06/2026 09:07');
  });
});
