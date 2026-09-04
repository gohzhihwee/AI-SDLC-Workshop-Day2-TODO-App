'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { Priority, RecurrencePattern, ReminderMinutes, Tag, Template, Todo } from '@/lib/db';
import { calculateProgress } from '@/lib/subtasks';
import { applyFilters, DEFAULT_FILTER_STATE, hasActiveFilters, type FilterState } from '@/lib/filters';
import { deletePreset, loadPresets, savePreset, type FilterPreset } from '@/lib/presets';
import {
  formatReminderLabel,
  formatSingaporeDateTime,
  formatSingaporeDateTimeLocal,
  getSingaporeNow,
  parseDateTimeLocal,
  parseSingaporeDate,
} from '@/lib/timezone';

type TodoFormState = {
  title: string;
  dueDate: string;
  priority: Priority;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  reminderMinutes: '' | ReminderMinutes;
  selectedTagIds: number[];
};

type TemplateDraft = {
  name: string;
  description: string;
  category: string;
};

type TemplateSource = {
  title: string;
  priority: Priority;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  reminderMinutes: '' | ReminderMinutes;
  dueDate: string;
  subtasks: Array<{ title: string; position?: number }>;
};

type UserResponse = {
  user: {
    userId: number;
    username: string;
  };
};

type TodoResponse = { todo: Todo; recurringTodo?: Todo | null };
type TodosResponse = { todos: Todo[] };
type TagsResponse = { tags: Tag[] };
type TemplatesResponse = { templates: Template[] };
type TodoSubtask = NonNullable<Todo['subtasks']>[number];

const reminderOptions: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];
const defaultForm: TodoFormState = {
  title: '',
  dueDate: '',
  priority: 'medium',
  isRecurring: false,
  recurrencePattern: 'daily',
  reminderMinutes: '',
  selectedTagIds: [],
};

const priorityOrder: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const priorityBadgeClass: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
};

function sortTodos(items: Todo[]): Todo[] {
  return [...items].sort((left, right) => {
    const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftDue = left.due_date ? parseSingaporeDate(left.due_date).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.due_date ? parseSingaporeDate(right.due_date).getTime() : Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return parseSingaporeDate(right.created_at).getTime() - parseSingaporeDate(left.created_at).getTime();
  });
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed');
  }

  return data;
}

function getProgress(todo: Todo) {
  const { completed, total, percent } = calculateProgress(todo.subtasks ?? []);
  return { total, completed, percentage: percent };
}

function formatDueDate(value: string | null) {
  return value ? formatSingaporeDateTimeLocal(value).replace('T', ' ') : 'No due date';
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse['user'] | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');
  const [todoForm, setTodoForm] = useState<TodoFormState>(defaultForm);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetError, setPresetError] = useState('');
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [templateSourceTodo, setTemplateSourceTodo] = useState<Todo | null>(null);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('#3B82F6');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTodoDraft, setEditingTodoDraft] = useState<TodoFormState>(defaultForm);
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});
  const [draftSubtasks, setDraftSubtasks] = useState<Array<{ title: string; position: number }>>([]);
  const [draftSubtaskInput, setDraftSubtaskInput] = useState('');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({ name: '', description: '', category: '' });

  const loadApp = async () => {
    setLoading(true);
    setError('');

    try {
      const [me, todosData, tagsData, templatesData] = await Promise.all([
        requestJson<UserResponse>('/api/auth/me'),
        requestJson<TodosResponse>('/api/todos'),
        requestJson<TagsResponse>('/api/tags'),
        requestJson<TemplatesResponse>('/api/templates'),
      ]);
      setUser(me.user);
      setTodos(todosData.todos);
      setTags(tagsData.tags);
      setTemplates(templatesData.templates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load app');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    void loadApp();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPresets(loadPresets());
  }, []);

  const debouncedSearch = useDebounce(filters.search, 300);
  const debouncedFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);

  const { permission, requestPermission } = useNotifications(Boolean(user), (items) => {
    const titles = items.map((item) => item.title).join(', ');
    setBanner(`Reminder: ${titles}`);
  });

  const filteredTodos = useMemo(() => applyFilters(todos, debouncedFilters), [todos, debouncedFilters]);
  const now = getSingaporeNow();
  const overdueTodos = useMemo(
    () => sortTodos(filteredTodos.filter((todo) => !todo.completed && todo.due_date && parseSingaporeDate(todo.due_date).getTime() < now.getTime())),
    [filteredTodos, now],
  );
  const pendingTodos = useMemo(
    () =>
      sortTodos(
        filteredTodos.filter(
          (todo) => !todo.completed && (!todo.due_date || parseSingaporeDate(todo.due_date).getTime() >= now.getTime()),
        ),
      ),
    [filteredTodos, now],
  );
  const completedTodos = useMemo(
    () => sortTodos(filteredTodos.filter((todo) => todo.completed)),
    [filteredTodos],
  );

  const handleLogout = async () => {
    await requestJson('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const handleCreateTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = todoForm.title.trim();
    if (!title) {
      setError('Title is required');
      return;
    }

    const tempId = -Math.floor(Math.random() * 1000000);
    const tempTodo: Todo = {
      id: tempId,
      user_id: user?.userId ?? 0,
      title,
      completed: false,
      due_date: todoForm.dueDate ? parseDateTimeLocal(todoForm.dueDate) : null,
      priority: todoForm.priority,
      is_recurring: todoForm.isRecurring,
      recurrence_pattern: todoForm.isRecurring ? todoForm.recurrencePattern : null,
      reminder_minutes: todoForm.reminderMinutes || null,
      last_notification_sent: null,
      created_at: formatSingaporeDateTime(getSingaporeNow()),
      updated_at: formatSingaporeDateTime(getSingaporeNow()),
      subtasks: [],
      tags: tags.filter((tag) => todoForm.selectedTagIds.includes(tag.id)),
    };

    setTodos((current) => [tempTodo, ...current]);
    setTodoForm(defaultForm);
    setDraftSubtasks([]);
    setDraftSubtaskInput('');

    try {
      const data = await requestJson<TodoResponse>('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          due_date: tempTodo.due_date,
          priority: todoForm.priority,
          is_recurring: todoForm.isRecurring,
          recurrence_pattern: todoForm.isRecurring ? todoForm.recurrencePattern : null,
          reminder_minutes: todoForm.reminderMinutes || null,
          tagIds: todoForm.selectedTagIds,
        }),
      });
      setTodos((current) => current.map((todo) => (todo.id === tempId ? data.todo : todo)));
      setBanner('Todo created');
    } catch (createError) {
      setTodos((current) => current.filter((todo) => todo.id !== tempId));
      setError(createError instanceof Error ? createError.message : 'Unable to create todo');
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    const previous = todos;
    setTodos((current) => current.map((item) => (item.id === todo.id ? { ...item, completed: !item.completed } : item)));

    try {
      const data = await requestJson<TodoResponse>(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      setTodos((current) => {
        const updated = current.map((item) => (item.id === todo.id ? data.todo : item));
        return data.recurringTodo ? [data.recurringTodo, ...updated] : updated;
      });
    } catch (toggleError) {
      setTodos(previous);
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update todo');
    }
  };

  const handleDeleteTodo = async (todoId: number) => {
    const previous = todos;
    setTodos((current) => current.filter((todo) => todo.id !== todoId));

    try {
      await requestJson(`/api/todos/${todoId}`, { method: 'DELETE' });
    } catch (deleteError) {
      setTodos(previous);
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete todo');
    }
  };

  const startEditingTodo = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTodoDraft({
      title: todo.title,
      dueDate: todo.due_date ? formatSingaporeDateTimeLocal(todo.due_date) : '',
      priority: todo.priority,
      isRecurring: todo.is_recurring,
      recurrencePattern: todo.recurrence_pattern ?? 'daily',
      reminderMinutes: (todo.reminder_minutes as ReminderMinutes | null) ?? '',
      selectedTagIds: (todo.tags ?? []).map((tag) => tag.id),
    });
  };

  const saveEditingTodo = async () => {
    if (!editingTodoId) {
      return;
    }

    try {
      const data = await requestJson<TodoResponse>(`/api/todos/${editingTodoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTodoDraft.title,
          due_date: editingTodoDraft.dueDate ? parseDateTimeLocal(editingTodoDraft.dueDate) : null,
          priority: editingTodoDraft.priority,
          is_recurring: editingTodoDraft.isRecurring,
          recurrence_pattern: editingTodoDraft.isRecurring ? editingTodoDraft.recurrencePattern : null,
          reminder_minutes: editingTodoDraft.reminderMinutes || null,
          tagIds: editingTodoDraft.selectedTagIds,
        }),
      });
      setTodos((current) => current.map((todo) => (todo.id === editingTodoId ? data.todo : todo)));
      setEditingTodoId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save todo');
    }
  };

  const handleAddSubtask = async (todoId: number) => {
    const title = subtaskInputs[todoId]?.trim();
    if (!title) {
      return;
    }

    try {
      const data = await requestJson<{ subtask: TodoSubtask }>(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      setTodos((current) =>
        current.map((todo) => (todo.id === todoId ? { ...todo, subtasks: [...(todo.subtasks ?? []), data.subtask] } : todo)),
      );
      setSubtaskInputs((current) => ({ ...current, [todoId]: '' }));
    } catch (subtaskError) {
      setError(subtaskError instanceof Error ? subtaskError.message : 'Unable to add subtask');
    }
  };

  const handleToggleSubtask = async (todoId: number, subtaskId: number, completed: boolean) => {
    const previous = todos;
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              subtasks: (todo.subtasks ?? []).map((subtask) => (subtask.id === subtaskId ? { ...subtask, completed } : subtask)),
            }
          : todo,
      ),
    );

    try {
      const data = await requestJson<{ subtask: TodoSubtask }>(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      setTodos((current) =>
        current.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: (todo.subtasks ?? []).map((subtask) => (subtask.id === subtaskId ? data.subtask : subtask)),
              }
            : todo,
        ),
      );
    } catch (subtaskError) {
      setTodos(previous);
      setError(subtaskError instanceof Error ? subtaskError.message : 'Unable to update subtask');
    }
  };

  const handleDeleteSubtask = async (todoId: number, subtaskId: number) => {
    try {
      await requestJson(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
      setTodos((current) =>
        current.map((todo) =>
          todo.id === todoId ? { ...todo, subtasks: (todo.subtasks ?? []).filter((subtask) => subtask.id !== subtaskId) } : todo,
        ),
      );
    } catch (subtaskError) {
      setError(subtaskError instanceof Error ? subtaskError.message : 'Unable to delete subtask');
    }
  };

  const handleCreateTag = async () => {
    try {
      const data = await requestJson<{ tag: Tag }>('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      });
      setTags((current) => [...current, data.tag].sort((left, right) => left.name.localeCompare(right.name)));
      setNewTagName('');
      setNewTagColor('#3B82F6');
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'Unable to create tag');
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTagId) {
      return;
    }

    try {
      const data = await requestJson<{ tag: Tag }>(`/api/tags/${editingTagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTagName, color: editingTagColor }),
      });
      setTags((current) => current.map((tag) => (tag.id === editingTagId ? data.tag : tag)));
      await loadApp();
      setEditingTagId(null);
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'Unable to update tag');
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      await requestJson(`/api/tags/${tagId}`, { method: 'DELETE' });
      await loadApp();
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'Unable to delete tag');
    }
  };

  const handleAttachTag = async (todoId: number, tagId: number) => {
    const data = await requestJson<TodoResponse>(`/api/todos/${todoId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    });
    setTodos((current) => current.map((todo) => (todo.id === todoId ? data.todo : todo)));
  };

  const handleDetachTag = async (todoId: number, tagId: number) => {
    const data = await requestJson<TodoResponse>(`/api/todos/${todoId}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    });
    setTodos((current) => current.map((todo) => (todo.id === todoId ? data.todo : todo)));
  };

  const buildTemplatePayload = (source: TemplateSource) => ({
    name: templateDraft.name.trim(),
    description: templateDraft.description.trim() || null,
    category: templateDraft.category.trim() || null,
    title_template: source.title,
    priority: source.priority,
    is_recurring: source.isRecurring,
    recurrence_pattern: source.isRecurring ? source.recurrencePattern : null,
    reminder_minutes: source.reminderMinutes || null,
    due_date_offset_minutes: source.dueDate
      ? Math.round((parseSingaporeDate(parseDateTimeLocal(source.dueDate)).getTime() - getSingaporeNow().getTime()) / 60000)
      : null,
    subtasks_json: JSON.stringify((source.subtasks ?? []).map((subtask, index) => ({ title: subtask.title, position: subtask.position ?? index }))),
  });

  const handleSaveTemplate = async () => {
    const source: TemplateSource = templateSourceTodo
      ? {
          title: templateSourceTodo.title,
          priority: templateSourceTodo.priority,
          isRecurring: templateSourceTodo.is_recurring,
          recurrencePattern: templateSourceTodo.recurrence_pattern ?? 'daily',
          reminderMinutes: templateSourceTodo.reminder_minutes === null ? '' : (templateSourceTodo.reminder_minutes as ReminderMinutes),
          dueDate: templateSourceTodo.due_date ? formatSingaporeDateTimeLocal(templateSourceTodo.due_date) : '',
          subtasks: templateSourceTodo.subtasks ?? [],
        }
      : {
          title: todoForm.title.trim(),
          priority: todoForm.priority,
          isRecurring: todoForm.isRecurring,
          recurrencePattern: todoForm.recurrencePattern,
          reminderMinutes: todoForm.reminderMinutes,
          dueDate: todoForm.dueDate,
          subtasks: draftSubtasks,
        };
    if (!source.title || !templateDraft.name.trim()) {
      setError('Template name and title are required');
      return;
    }

    try {
      const data = await requestJson<{ template: Template }>('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTemplatePayload(source)),
      });
      setTemplates((current) => [data.template, ...current]);
      setBanner('Template saved');
      setSaveTemplateModalOpen(false);
      setTemplateSourceTodo(null);
      setTemplateDraft({ name: '', description: '', category: '' });
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : 'Unable to create template');
    }
  };

  const handleSaveDraftTemplate = () => {
    setTemplateSourceTodo(null);
    setTemplateDraft((current) => ({ ...current, name: current.name || `${todoForm.title.trim()} template` }));
    setSaveTemplateModalOpen(true);
  };

  const handleSaveTodoTemplate = (todo: Todo) => {
    setTemplateSourceTodo(todo);
    setTemplateDraft((current) => ({ ...current, name: current.name || `${todo.title} template` }));
    setSaveTemplateModalOpen(true);
  };

  const handleUseTemplate = async (templateId: number) => {
    try {
      const data = await requestJson<TodoResponse>(`/api/templates/${templateId}/use`, {
        method: 'POST',
      });
      setTodos((current) => [data.todo, ...current]);
      setBanner('Template used');
      setTemplateModalOpen(false);
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : 'Unable to use template');
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this template?')) {
      return;
    }

    try {
      await requestJson(`/api/templates/${templateId}`, { method: 'DELETE' });
      setTemplates((current) => current.filter((template) => template.id !== templateId));
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : 'Unable to delete template');
    }
  };

  const handleQuickUseTemplate = (event: ChangeEvent<HTMLSelectElement>) => {
    const templateId = Number(event.target.value);
    event.target.value = '';
    if (templateId) {
      void handleUseTemplate(templateId);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      await requestJson('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      await loadApp();
      setBanner('Todos imported');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import todos');
    } finally {
      event.target.value = '';
    }
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      return;
    }

    setPresetError('');
    try {
      const nextPresets = savePreset({
        id: crypto.randomUUID(),
        name,
        filters,
        createdAt: formatSingaporeDateTime(getSingaporeNow()),
      });
      setPresets(nextPresets);
      setPresetName('');
      setPresetModalOpen(false);
    } catch (saveError) {
      setPresetError(saveError instanceof Error ? saveError.message : 'Could not save preset');
    }
  };

  const handleDeletePreset = (id: string) => {
    setPresets(deletePreset(id));
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    // Fall back any dimension referencing a tag that no longer exists rather
    // than silently applying a filter that matches nothing.
    const tagStillExists = preset.filters.tagId === 'all' || tags.some((tag) => tag.id === preset.filters.tagId);
    setFilters({
      ...preset.filters,
      tagId: tagStillExists ? preset.filters.tagId : 'all',
    });
    if (!tagStillExists) {
      setBanner(`Preset "${preset.name}" referenced a deleted tag; tag filter reset to All tags.`);
    }
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTER_STATE);
  };

  const renderTodoCard = (todo: Todo) => {
    const progress = getProgress(todo);
    const availableTags = tags.filter((tag) => !(todo.tags ?? []).some((item) => item.id === tag.id));
    const isEditing = editingTodoId === todo.id;

    return (
      <article key={todo.id} data-testid={`todo-card-${todo.id}`} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {isEditing ? <span className="sr-only">{todo.title}</span> : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  data-testid={`edit-todo-title-${todo.id}`}
                  value={editingTodoDraft.title}
                  onChange={(event) => setEditingTodoDraft((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    data-testid={`edit-todo-due-date-${todo.id}`}
                    type="datetime-local"
                    value={editingTodoDraft.dueDate}
                    onChange={(event) =>
                      setEditingTodoDraft((current) => ({
                        ...current,
                        dueDate: event.target.value,
                        reminderMinutes: event.target.value ? current.reminderMinutes : '',
                      }))
                    }
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  />
                  <select
                    data-testid={`edit-todo-priority-${todo.id}`}
                    value={editingTodoDraft.priority}
                    onChange={(event) => setEditingTodoDraft((current) => ({ ...current, priority: event.target.value as Priority }))}
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h3 className={`text-lg font-semibold ${todo.completed ? 'line-through opacity-70' : ''}`}>{todo.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{formatDueDate(todo.due_date)}</p>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityBadgeClass[todo.priority]}`}>{todo.priority}</span>
              {todo.is_recurring && todo.recurrence_pattern ? (
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  🔄 {todo.recurrence_pattern}
                </span>
              ) : null}
              {todo.reminder_minutes ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  🔔 {formatReminderLabel(todo.reminder_minutes)}
                </span>
              ) : null}
              {(todo.tags ?? []).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => void handleDetachTag(todo.id, tag.id)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name} ×
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              data-testid={`toggle-todo-${todo.id}`}
              type="button"
              onClick={() => void handleToggleTodo(todo)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
            >
              {todo.completed ? 'Mark active' : 'Complete'}
            </button>
            {isEditing ? (
              <>
                <button type="button" onClick={() => void saveEditingTodo()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  Save
                </button>
                <button type="button" onClick={() => setEditingTodoId(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  data-testid={`edit-todo-${todo.id}`}
                  type="button"
                  onClick={() => startEditingTodo(todo)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                >
                  Edit
                </button>
                <button
                  data-testid={`delete-todo-${todo.id}`}
                  type="button"
                  onClick={() => void handleDeleteTodo(todo.id)}
                  className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveTodoTemplate(todo)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                >
                  Save as template
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/50">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingTodoDraft.isRecurring}
                onChange={(event) => setEditingTodoDraft((current) => ({ ...current, isRecurring: event.target.checked }))}
              />
              Recurring
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={editingTodoDraft.recurrencePattern}
                onChange={(event) =>
                  setEditingTodoDraft((current) => ({ ...current, recurrencePattern: event.target.value as RecurrencePattern }))
                }
                disabled={!editingTodoDraft.isRecurring}
                className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-slate-700"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <select
                value={editingTodoDraft.reminderMinutes}
                onChange={(event) =>
                  setEditingTodoDraft((current) => ({
                    ...current,
                    reminderMinutes: event.target.value ? (Number(event.target.value) as ReminderMinutes) : '',
                  }))
                }
                disabled={!editingTodoDraft.dueDate}
                className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-slate-700"
              >
                <option value="">No reminder</option>
                {reminderOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatReminderLabel(minutes)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = editingTodoDraft.selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setEditingTodoDraft((current) => ({
                          ...current,
                          selectedTagIds: selected
                            ? current.selectedTagIds.filter((id) => id !== tag.id)
                            : [...current.selectedTagIds, tag.id],
                        }))
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-slate-900' : 'border-slate-300 dark:border-slate-700'}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {progress.total > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{`${progress.completed}/${progress.total} subtasks`}</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full ${progress.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {(todo.subtasks ?? []).map((subtask) => (
            <div key={subtask.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/40">
              <label className="flex flex-1 items-center gap-3">
                <input
                  data-testid={`toggle-subtask-${subtask.id}`}
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={(event) => void handleToggleSubtask(todo.id, subtask.id, event.target.checked)}
                />
                <span className={subtask.completed ? 'line-through opacity-70' : ''}>{subtask.title}</span>
              </label>
              <button type="button" onClick={() => void handleDeleteSubtask(todo.id, subtask.id)} className="text-red-600 dark:text-red-300">
                Delete
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              data-testid={`subtask-input-${todo.id}`}
              value={subtaskInputs[todo.id] ?? ''}
              onChange={(event) => setSubtaskInputs((current) => ({ ...current, [todo.id]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAddSubtask(todo.id);
                }
              }}
              placeholder="Add subtask"
              className="flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
            />
            <button
              data-testid={`add-subtask-${todo.id}`}
              type="button"
              onClick={() => void handleAddSubtask(todo.id)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
            >
              Add
            </button>
          </div>
        </div>

        {availableTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void handleAttachTag(todo.id, tag.id)}
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700"
              >
                + {tag.name}
              </button>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  if (loading) {
    return <main className="p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold">Todo App</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">Welcome{user ? `, ${user.username}` : ''}. Singapore time now: {formatSingaporeDateTimeLocal(getSingaporeNow()).replace('T', ' ')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/calendar" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
                Calendar
              </Link>
              <button
                data-testid="enable-notifications-button"
                type="button"
                onClick={() => void requestPermission()}
                disabled={permission === 'granted'}
                className={
                  permission === 'granted'
                    ? 'rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600'
                }
              >
                {permission === 'granted' ? '🔔 Notifications On' : '🔔 Enable Notifications'}
              </button>
              <button data-testid="open-tags-modal" type="button" onClick={() => setTagModalOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
                Manage Tags
              </button>
              <button data-testid="open-templates-modal" type="button" onClick={() => setTemplateModalOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
                Templates
              </button>
              <button type="button" onClick={() => void handleLogout()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                Logout
              </button>
            </div>
          </div>

          {banner ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{banner}</div> : null}
          {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Create Todo</h2>
                <button type="button" onClick={handleSaveDraftTemplate} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                  Save as Template
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCreateTodo}>
                <input
                  data-testid="todo-title-input"
                  value={todoForm.title}
                  onChange={(event) => setTodoForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="What needs to be done?"
                  className="w-full rounded-2xl border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700"
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2 text-sm">
                    <span>Due date</span>
                    <input
                      data-testid="todo-due-date-input"
                      type="datetime-local"
                      value={todoForm.dueDate}
                      onChange={(event) =>
                        setTodoForm((current) => ({
                          ...current,
                          dueDate: event.target.value,
                          reminderMinutes: event.target.value ? current.reminderMinutes : '',
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>Priority</span>
                    <select
                      data-testid="todo-priority-select"
                      value={todoForm.priority}
                      onChange={(event) => setTodoForm((current) => ({ ...current, priority: event.target.value as Priority }))}
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>Reminder</span>
                    <select
                      data-testid="todo-reminder-select"
                      value={todoForm.reminderMinutes}
                      disabled={!todoForm.dueDate}
                      onChange={(event) =>
                        setTodoForm((current) => ({
                          ...current,
                          reminderMinutes: event.target.value ? (Number(event.target.value) as ReminderMinutes) : '',
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-slate-700"
                    >
                      <option value="">No reminder</option>
                      {reminderOptions.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {formatReminderLabel(minutes)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/40">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      data-testid="todo-recurring-checkbox"
                      type="checkbox"
                      checked={todoForm.isRecurring}
                      onChange={(event) => setTodoForm((current) => ({ ...current, isRecurring: event.target.checked }))}
                    />
                    Recurring todo
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span>Pattern</span>
                      <select
                        data-testid="todo-recurrence-select"
                        value={todoForm.recurrencePattern}
                        disabled={!todoForm.isRecurring}
                        onChange={(event) =>
                          setTodoForm((current) => ({ ...current, recurrencePattern: event.target.value as RecurrencePattern }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-slate-700"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <div className="space-y-2 text-sm">
                      <span>Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const selected = todoForm.selectedTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              data-testid={`draft-tag-${tag.id}`}
                              onClick={() =>
                                setTodoForm((current) => ({
                                  ...current,
                                  selectedTagIds: selected
                                    ? current.selectedTagIds.filter((id) => id !== tag.id)
                                    : [...current.selectedTagIds, tag.id],
                                }))
                              }
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-300 dark:border-slate-700'}`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={templateDraft.name}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Template name"
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                  />
                  <input
                    value={templateDraft.description}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Template description"
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                  />
                  <input
                    value={templateDraft.category}
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))}
                    placeholder="Template category"
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Template subtasks</span>
                  {draftSubtasks.map((subtask) => (
                    <div key={subtask.position} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/40">
                      <span>{subtask.title}</span>
                      <button
                        type="button"
                        onClick={() => setDraftSubtasks((current) => current.filter((item) => item.position !== subtask.position))}
                        className="text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      data-testid="draft-subtask-input"
                      value={draftSubtaskInput}
                      onChange={(event) => setDraftSubtaskInput(event.target.value)}
                      placeholder="Add a template subtask"
                      className="flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const title = draftSubtaskInput.trim();
                        if (!title) return;
                        setDraftSubtasks((current) => [...current, { title, position: current.length }]);
                        setDraftSubtaskInput('');
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <button data-testid="create-todo-button" type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white">
                  Create Todo
                </button>
                <select data-testid="use-template-select" defaultValue="" onChange={handleQuickUseTemplate} className="rounded-2xl border border-slate-300 px-3 py-3 dark:border-slate-700">
                  <option value="">Use Template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.category ? ` (${template.category})` : ''}
                    </option>
                  ))}
                </select>
              </form>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Search & Filters</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Applied in order: search → priority → tag → completion → date range.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- direct file download from API route, not page navigation */}
                  <a data-testid="export-json" href="/api/todos/export?format=json" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                    Export JSON
                  </a>
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- direct file download from API route, not page navigation */}
                  <a data-testid="export-csv" href="/api/todos/export?format=csv" className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                    Export CSV
                  </a>
                  <label className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                    Import JSON
                    <input data-testid="import-json" type="file" accept="application/json" className="hidden" onChange={handleImport} />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    data-testid="search-input"
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search todos and subtasks..."
                    className="w-full rounded-xl border border-slate-300 bg-transparent px-9 py-2 dark:border-slate-700"
                  />
                  {filters.search ? (
                    <button
                      type="button"
                      data-testid="clear-search"
                      aria-label="Clear search"
                      onClick={() => setFilters((current) => ({ ...current, search: '' }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <select
                  data-testid="filter-priority"
                  value={filters.priority}
                  onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as FilterState['priority'] }))}
                  className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                >
                  <option value="all">All priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                {tags.length ? (
                  <select
                    data-testid="filter-tag"
                    value={tags.some((tag) => tag.id === filters.tagId) ? filters.tagId : 'all'}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        tagId: event.target.value === 'all' ? 'all' : Number(event.target.value),
                      }))
                    }
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  >
                    <option value="all">All tags</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="advanced-toggle"
                  onClick={() => setAdvancedOpen((current) => !current)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${advancedOpen ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}
                >
                  {advancedOpen ? '▼ Advanced' : '▶ Advanced'}
                </button>
                {hasActiveFilters(filters) ? (
                  <>
                    <button
                      type="button"
                      data-testid="clear-all-filters"
                      onClick={handleClearFilters}
                      className="text-sm font-medium text-red-600"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      data-testid="open-save-filter"
                      onClick={() => setPresetModalOpen(true)}
                      className="text-sm font-medium text-green-600"
                    >
                      💾 Save Filter
                    </button>
                  </>
                ) : null}
              </div>

              {advancedOpen ? (
                <div data-testid="advanced-panel" className="mt-4 grid gap-4 md:grid-cols-3">
                  <select
                    data-testid="filter-completion"
                    value={filters.completion}
                    onChange={(event) => setFilters((current) => ({ ...current, completion: event.target.value as FilterState['completion'] }))}
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  >
                    <option value="all">All todos</option>
                    <option value="incomplete">Incomplete Only</option>
                    <option value="completed">Completed Only</option>
                  </select>
                  <input
                    data-testid="filter-date-from"
                    type="date"
                    value={filters.dueDateFrom ?? ''}
                    onChange={(event) => setFilters((current) => ({ ...current, dueDateFrom: event.target.value || null }))}
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  />
                  <input
                    data-testid="filter-date-to"
                    type="date"
                    value={filters.dueDateTo ?? ''}
                    onChange={(event) => setFilters((current) => ({ ...current, dueDateTo: event.target.value || null }))}
                    className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700"
                  />
                  {filters.dueDateFrom && filters.dueDateTo && filters.dueDateFrom > filters.dueDateTo ? (
                    <p className="text-xs text-amber-600 md:col-span-3">From date is after To date — no todos can match.</p>
                  ) : null}
                </div>
              ) : null}

              {presets.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <span key={preset.id} data-testid={`preset-pill-${preset.id}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm dark:border-slate-700">
                      <button type="button" onClick={() => handleApplyPreset(preset)} className="font-medium">
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id)}
                        aria-label={`Delete preset ${preset.name}`}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            <section data-testid="overdue-section" className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
              {overdueTodos.length ? (
                <>
                  <h2 className="mb-4 text-xl font-semibold text-red-600 dark:text-red-400">Overdue ({overdueTodos.length})</h2>
                  <div className="space-y-4">{overdueTodos.map(renderTodoCard)}</div>
                </>
              ) : null}
            </section>
            <section data-testid="pending-section" className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
              {pendingTodos.length ? (
                <>
                  <h2 className="mb-4 text-xl font-semibold">Pending ({pendingTodos.length})</h2>
                  <div className="space-y-4">{pendingTodos.map(renderTodoCard)}</div>
                </>
              ) : null}
            </section>
            <section data-testid="completed-section" className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
              {completedTodos.length ? (
                <>
                  <h2 className="mb-4 text-xl font-semibold">Completed ({completedTodos.length})</h2>
                  <div className="space-y-4">{completedTodos.map(renderTodoCard)}</div>
                </>
              ) : null}
            </section>
            {!overdueTodos.length && !pendingTodos.length && !completedTodos.length ? (
              <section className="rounded-3xl bg-white p-6 text-center shadow-sm dark:bg-slate-900">
                {todos.length === 0 ? (
                  <p data-testid="empty-no-todos" className="text-sm text-slate-500 dark:text-slate-400">You have no todos yet.</p>
                ) : (
                  <p data-testid="empty-no-matches" className="text-sm text-slate-500 dark:text-slate-400">No todos match your filters.</p>
                )}
              </section>
            ) : null}
          </div>
        </section>

        {presetModalOpen ? (
          <div data-testid="save-filter-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Save Filter</h2>
                <button type="button" onClick={() => setPresetModalOpen(false)}>
                  Close
                </button>
              </div>
              <p data-testid="save-filter-preview" className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                {[
                  filters.search.trim() ? `Search: "${filters.search.trim()}"` : null,
                  filters.priority !== 'all' ? `Priority: ${filters.priority}` : null,
                  filters.tagId !== 'all' ? `Tag: ${tags.find((tag) => tag.id === filters.tagId)?.name ?? filters.tagId}` : null,
                  filters.completion !== 'all' ? `Completion: ${filters.completion}` : null,
                  filters.dueDateFrom || filters.dueDateTo ? `Date: ${filters.dueDateFrom ?? '…'} to ${filters.dueDateTo ?? '…'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No active filters'}
              </p>
              {presetError ? <p className="mb-3 text-sm text-red-600">{presetError}</p> : null}
              <div className="flex gap-3">
                <input
                  data-testid="preset-name-input"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Preset name"
                  className="flex-1 rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                />
                <button type="button" data-testid="confirm-save-preset" onClick={handleSavePreset} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {tagModalOpen ? (
          <div data-testid="tags-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Manage Tags</h2>
                <button type="button" onClick={() => setTagModalOpen(false)}>
                  Close
                </button>
              </div>

              <div className="space-y-3 mb-6">
                {tags.map((tag) => (
                  <div key={tag.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_auto_auto_auto]">
                    {editingTagId === tag.id ? (
                      <>
                        <input value={editingTagName} onChange={(event) => setEditingTagName(event.target.value)} className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" />
                        <input value={editingTagColor} onChange={(event) => setEditingTagColor(event.target.value)} type="color" className="h-11 rounded-xl border border-slate-300 bg-transparent px-1 dark:border-slate-700" />
                        <button type="button" onClick={() => void handleUpdateTag()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingTagId(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span>{tag.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTagId(tag.id);
                            setEditingTagName(tag.name);
                            setEditingTagColor(tag.color);
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDeleteTag(tag.id)} className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
                          Delete
                        </button>
                        <div />
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Tag name" className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" />
                <input value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} type="color" className="h-11 rounded-xl border border-slate-300 bg-transparent px-1 dark:border-slate-700" />
                <button data-testid="create-tag-button" type="button" onClick={() => void handleCreateTag()} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {templateModalOpen ? (
          <div data-testid="templates-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-6 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Templates</h2>
                <div className="flex items-center gap-3">
                  <select data-testid="template-category-filter" defaultValue="all" onChange={(event) => setTemplateCategoryFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
                    <option value="all">All categories</option>
                    {[...new Set(templates.map((template) => template.category).filter((category): category is string => Boolean(category)))].sort().map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setTemplateModalOpen(false)}>Close</button>
                </div>
              </div>

              <div className="space-y-3">
                {templates.filter((template) => templateCategoryFilter === 'all' || template.category === templateCategoryFilter).length ? (
                  templates.filter((template) => templateCategoryFilter === 'all' || template.category === templateCategoryFilter).map((template) => (
                    <div key={template.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.category ? <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{template.category}</span> : null}
                        </div>
                        {template.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{template.description}</p> : null}
                        <p className="text-sm text-slate-600 dark:text-slate-300">{template.title_template}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2 py-1 font-semibold ${priorityBadgeClass[template.priority]}`}>{template.priority}</span>
                          {template.is_recurring && template.recurrence_pattern ? <span className="rounded-full bg-purple-100 px-2 py-1 font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">🔄 {template.recurrence_pattern}</span> : null}
                          {template.reminder_minutes ? <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">🔔 {formatReminderLabel(template.reminder_minutes)}</span> : null}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button data-testid={`use-template-${template.id}`} type="button" onClick={() => void handleUseTemplate(template.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
                          Use
                        </button>
                        <button type="button" onClick={() => void handleDeleteTemplate(template.id)} className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No templates yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {saveTemplateModalOpen ? (
          <div data-testid="save-template-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
            <div className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Save as Template</h2>
                <button type="button" onClick={() => setSaveTemplateModalOpen(false)}>Close</button>
              </div>
              <input data-testid="template-name-input" value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Template name" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" />
              <textarea data-testid="template-description-input" value={templateDraft.description} onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description (optional)" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" />
              <input data-testid="template-category-input" value={templateDraft.category} onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category (optional)" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700" />
              <button data-testid="save-template-button" type="button" disabled={!templateDraft.name.trim()} onClick={() => void handleSaveTemplate()} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                Save Template
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
