import { describe, expect, it } from 'vitest';
import { calculateProgress } from '@/lib/subtasks';

function subtask(completed: boolean) {
  return { completed };
}

describe('calculateProgress', () => {
  it('returns all zeros for an empty list', () => {
    expect(calculateProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('returns 0% when all subtasks are incomplete', () => {
    const result = calculateProgress([subtask(false), subtask(false), subtask(false)]);
    expect(result).toEqual({ completed: 0, total: 3, percent: 0 });
  });

  it('rounds a partial completion (3 of 7) to the nearest percent', () => {
    const subtasks = [
      subtask(true),
      subtask(true),
      subtask(true),
      subtask(false),
      subtask(false),
      subtask(false),
      subtask(false),
    ];
    const result = calculateProgress(subtasks);
    expect(result).toEqual({ completed: 3, total: 7, percent: 43 });
  });

  it('returns 100% when all subtasks are complete', () => {
    const subtasks = [subtask(true), subtask(true), subtask(true)];
    const result = calculateProgress(subtasks);
    expect(result).toEqual({ completed: 3, total: 3, percent: 100 });
  });

  it('rounds 1/3 down to 33%', () => {
    const result = calculateProgress([subtask(true), subtask(false), subtask(false)]);
    expect(result.percent).toBe(33);
  });

  it('rounds 2/3 up to 67%', () => {
    const result = calculateProgress([subtask(true), subtask(true), subtask(false)]);
    expect(result.percent).toBe(67);
  });

  it('handles a single incomplete subtask', () => {
    expect(calculateProgress([subtask(false)])).toEqual({ completed: 0, total: 1, percent: 0 });
  });

  it('handles a single complete subtask', () => {
    expect(calculateProgress([subtask(true)])).toEqual({ completed: 1, total: 1, percent: 100 });
  });
});
