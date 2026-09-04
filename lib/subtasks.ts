import type { Subtask } from '@/lib/db';

export interface SubtaskProgress {
  completed: number;
  total: number;
  percent: number;
}

/**
 * Pure function shared by the API and UI layers. Given a todo's subtasks,
 * returns how many are complete, the total count, and a rounded completion
 * percentage. Returns 0% for an empty list rather than NaN.
 */
export function calculateProgress(subtasks: Pick<Subtask, 'completed'>[]): SubtaskProgress {
  const total = subtasks.length;
  const completed = subtasks.filter((subtask) => subtask.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
