import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTER_STATE, hasActiveFilters, type FilterState } from '@/lib/filters';
import type { Todo } from '@/lib/db';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    user_id: 1,
    title: 'Untitled',
    completed: false,
    due_date: null,
    priority: 'medium',
    is_recurring: false,
    recurrence_pattern: null,
    reminder_minutes: null,
    last_notification_sent: null,
    created_at: '2025-01-01T00:00:00+08:00',
    updated_at: null,
    subtasks: [],
    tags: [],
    ...overrides,
  };
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...DEFAULT_FILTER_STATE, ...overrides };
}

describe('applyFilters — search', () => {
  const todos = [
    makeTodo({ id: 1, title: 'Buy milk' }),
    makeTodo({ id: 2, title: 'Write memo', subtasks: [{ id: 10, todo_id: 2, title: 'Draft outline', completed: false, position: 0, created_at: '' }] }),
  ];

  it('matches on todo title, case-insensitively, with partial match', () => {
    const result = applyFilters(todos, filters({ search: 'MILK' }));
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('matches on subtask title', () => {
    const result = applyFilters(todos, filters({ search: 'outline' }));
    expect(result.map((t) => t.id)).toEqual([2]);
  });

  it('returns no results when nothing matches', () => {
    const result = applyFilters(todos, filters({ search: 'nonexistent' }));
    expect(result).toEqual([]);
  });

  it('returns all todos for an empty query', () => {
    const result = applyFilters(todos, filters({ search: '' }));
    expect(result).toHaveLength(2);
  });

  it('treats a whitespace-only query the same as empty', () => {
    const result = applyFilters(todos, filters({ search: '   ' }));
    expect(result).toHaveLength(2);
  });
});

describe('applyFilters — priority', () => {
  const todos = [
    makeTodo({ id: 1, priority: 'high' }),
    makeTodo({ id: 2, priority: 'medium' }),
    makeTodo({ id: 3, priority: 'low' }),
  ];

  it.each(['high', 'medium', 'low'] as const)('filters to only %s priority', (priority) => {
    const result = applyFilters(todos, filters({ priority }));
    expect(result.every((t) => t.priority === priority)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('returns all todos when priority is "all"', () => {
    const result = applyFilters(todos, filters({ priority: 'all' }));
    expect(result).toHaveLength(3);
  });
});

describe('applyFilters — tag', () => {
  const tag = { id: 1, user_id: 1, name: 'Work', color: '#000', created_at: '' };
  const todos = [
    makeTodo({ id: 1, tags: [tag] }),
    makeTodo({ id: 2, tags: [] }),
  ];

  it('matches a todo that has the selected tag', () => {
    const result = applyFilters(todos, filters({ tagId: 1 }));
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('excludes a todo without the selected tag', () => {
    const result = applyFilters(todos, filters({ tagId: 1 }));
    expect(result.map((t) => t.id)).not.toContain(2);
  });

  it('returns all todos when tagId is "all"', () => {
    const result = applyFilters(todos, filters({ tagId: 'all' }));
    expect(result).toHaveLength(2);
  });
});

describe('applyFilters — completion', () => {
  const todos = [
    makeTodo({ id: 1, completed: false }),
    makeTodo({ id: 2, completed: true }),
  ];

  it('filters to incomplete only', () => {
    const result = applyFilters(todos, filters({ completion: 'incomplete' }));
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  it('filters to completed only', () => {
    const result = applyFilters(todos, filters({ completion: 'completed' }));
    expect(result.map((t) => t.id)).toEqual([2]);
  });

  it('returns all todos for "all"', () => {
    const result = applyFilters(todos, filters({ completion: 'all' }));
    expect(result).toHaveLength(2);
  });
});

describe('applyFilters — due date range', () => {
  const todos = [
    makeTodo({ id: 1, due_date: '2025-06-01T00:00:00+08:00' }),
    makeTodo({ id: 2, due_date: '2025-06-15T00:00:00+08:00' }),
    makeTodo({ id: 3, due_date: '2025-06-30T00:00:00+08:00' }),
    makeTodo({ id: 4, due_date: null }),
  ];

  it('applies only a "from" bound', () => {
    const result = applyFilters(todos, filters({ dueDateFrom: '2025-06-15' }));
    expect(result.map((t) => t.id)).toEqual([2, 3]);
  });

  it('applies only a "to" bound', () => {
    const result = applyFilters(todos, filters({ dueDateTo: '2025-06-15' }));
    expect(result.map((t) => t.id)).toEqual([1, 2]);
  });

  it('applies both bounds', () => {
    const result = applyFilters(todos, filters({ dueDateFrom: '2025-06-02', dueDateTo: '2025-06-16' }));
    expect(result.map((t) => t.id)).toEqual([2]);
  });

  it('excludes todos with a null due_date', () => {
    const result = applyFilters(todos, filters({ dueDateFrom: '2025-01-01' }));
    expect(result.map((t) => t.id)).not.toContain(4);
  });

  it('returns an empty result when from is after to', () => {
    const result = applyFilters(todos, filters({ dueDateFrom: '2025-06-30', dueDateTo: '2025-06-01' }));
    expect(result).toEqual([]);
  });
});

describe('applyFilters — combined', () => {
  const tag = { id: 1, user_id: 1, name: 'Work', color: '#000', created_at: '' };
  const todos = [
    makeTodo({ id: 1, title: 'Team meeting', priority: 'high', tags: [tag], completed: false, due_date: '2025-06-10T00:00:00+08:00' }),
    makeTodo({ id: 2, title: 'Team meeting', priority: 'low', tags: [tag], completed: false, due_date: '2025-06-10T00:00:00+08:00' }),
    makeTodo({ id: 3, title: 'Team meeting', priority: 'high', tags: [], completed: false, due_date: '2025-06-10T00:00:00+08:00' }),
    makeTodo({ id: 4, title: 'Team meeting', priority: 'high', tags: [tag], completed: true, due_date: '2025-06-10T00:00:00+08:00' }),
    makeTodo({ id: 5, title: 'Team meeting', priority: 'high', tags: [tag], completed: false, due_date: '2025-01-01T00:00:00+08:00' }),
    makeTodo({ id: 6, title: 'Unrelated', priority: 'high', tags: [tag], completed: false, due_date: '2025-06-10T00:00:00+08:00' }),
  ];

  it('applies every dimension as a strict AND intersection', () => {
    const result = applyFilters(
      todos,
      filters({
        search: 'meeting',
        priority: 'high',
        tagId: 1,
        completion: 'incomplete',
        dueDateFrom: '2025-06-01',
        dueDateTo: '2025-06-30',
      }),
    );
    expect(result.map((t) => t.id)).toEqual([1]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the all-default state', () => {
    expect(hasActiveFilters(DEFAULT_FILTER_STATE)).toBe(false);
  });

  it('is true when search is set', () => {
    expect(hasActiveFilters(filters({ search: 'x' }))).toBe(true);
  });

  it('is true when priority is set', () => {
    expect(hasActiveFilters(filters({ priority: 'high' }))).toBe(true);
  });

  it('is true when tagId is set', () => {
    expect(hasActiveFilters(filters({ tagId: 1 }))).toBe(true);
  });

  it('is true when completion is set', () => {
    expect(hasActiveFilters(filters({ completion: 'completed' }))).toBe(true);
  });

  it('is true when dueDateFrom is set', () => {
    expect(hasActiveFilters(filters({ dueDateFrom: '2025-01-01' }))).toBe(true);
  });

  it('is true when dueDateTo is set', () => {
    expect(hasActiveFilters(filters({ dueDateTo: '2025-01-01' }))).toBe(true);
  });
});
