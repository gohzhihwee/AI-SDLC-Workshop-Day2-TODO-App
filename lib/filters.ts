import type { Priority, Todo } from '@/lib/db';
import { formatSingaporeDate } from '@/lib/timezone';

export interface FilterState {
  search: string;
  priority: Priority | 'all';
  tagId: number | 'all';
  completion: 'all' | 'incomplete' | 'completed';
  dueDateFrom: string | null; // 'YYYY-MM-DD'
  dueDateTo: string | null; // 'YYYY-MM-DD'
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  priority: 'all',
  tagId: 'all',
  completion: 'all',
  dueDateFrom: null,
  dueDateTo: null,
};

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.priority !== 'all' ||
    filters.tagId !== 'all' ||
    filters.completion !== 'all' ||
    filters.dueDateFrom !== null ||
    filters.dueDateTo !== null
  );
}

/**
 * Applies all five filter dimensions to a list of todos with AND logic, in
 * the documented order: search -> priority -> tag -> completion -> date range.
 * Pure and side-effect free so it can run against the debounced search value
 * without triggering a network round-trip.
 */
export function applyFilters(todos: Todo[], filters: FilterState): Todo[] {
  let result = todos;

  const query = filters.search.trim().toLowerCase();
  if (query) {
    result = result.filter((todo) => {
      if (todo.title.toLowerCase().includes(query)) {
        return true;
      }

      return (todo.subtasks ?? []).some((subtask) => subtask.title.toLowerCase().includes(query));
    });
  }

  if (filters.priority !== 'all') {
    result = result.filter((todo) => todo.priority === filters.priority);
  }

  if (filters.tagId !== 'all') {
    result = result.filter((todo) => (todo.tags ?? []).some((tag) => tag.id === filters.tagId));
  }

  if (filters.completion === 'incomplete') {
    result = result.filter((todo) => !todo.completed);
  } else if (filters.completion === 'completed') {
    result = result.filter((todo) => todo.completed);
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    result = result.filter((todo) => {
      if (!todo.due_date) {
        return false;
      }

      const due = formatSingaporeDate(todo.due_date);
      if (filters.dueDateFrom && due < filters.dueDateFrom) {
        return false;
      }

      if (filters.dueDateTo && due > filters.dueDateTo) {
        return false;
      }

      return true;
    });
  }

  return result;
}
