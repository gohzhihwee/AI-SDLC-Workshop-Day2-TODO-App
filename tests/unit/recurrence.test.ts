import { describe, expect, it } from 'vitest';
import { calculateNextDueDate } from '@/lib/timezone';

// calculateNextDueDate returns a full Singapore ISO string (e.g.
// 2025-11-11T14:00:00+08:00); these cases assert the local date/time prefix.
function nextDue(current: string, pattern: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  return calculateNextDueDate(current, pattern).slice(0, 16);
}

describe('calculateNextDueDate', () => {
  it('advances a daily todo by one day', () => {
    expect(nextDue('2025-11-10T14:00', 'daily')).toBe('2025-11-11T14:00');
  });

  it('advances a weekly todo by seven days', () => {
    expect(nextDue('2025-11-10T14:00', 'weekly')).toBe('2025-11-17T14:00');
  });

  it('keeps the same day of month when the next month is long enough', () => {
    expect(nextDue('2025-06-15T09:00', 'monthly')).toBe('2025-07-15T09:00');
  });

  it('clamps a monthly todo to the last day of a shorter month', () => {
    expect(nextDue('2025-01-31T09:00', 'monthly')).toBe('2025-02-28T09:00');
  });

  it('clamps a monthly todo to Feb 29 in a leap year', () => {
    expect(nextDue('2024-01-31T09:00', 'monthly')).toBe('2024-02-29T09:00');
  });

  it('rolls a monthly todo over the year boundary', () => {
    expect(nextDue('2025-12-31T09:00', 'monthly')).toBe('2026-01-31T09:00');
  });

  it('advances a yearly todo by one year', () => {
    expect(nextDue('2025-06-15T09:00', 'yearly')).toBe('2026-06-15T09:00');
  });

  it('clamps a yearly leap-day todo to Feb 28 in a non-leap year', () => {
    expect(nextDue('2024-02-29T09:00', 'yearly')).toBe('2025-02-28T09:00');
  });

  it('preserves the time of day across every pattern', () => {
    for (const pattern of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      expect(nextDue('2025-03-05T23:45', pattern).endsWith('T23:45')).toBe(true);
    }
  });
});
