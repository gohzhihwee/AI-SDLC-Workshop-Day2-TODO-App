import Database from 'better-sqlite3';
import path from 'node:path';
import { addSingaporeMinutes, calculateNextDueDate, formatSingaporeDateTime, getSingaporeNow, parseSingaporeDate } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  created_at: string;
}

export interface Session {
  userId: number;
  username: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface TemplateSubtaskInput {
  title: string;
  position: number;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: ReminderMinutes | null;
  last_notification_sent?: string | null;
  tagIds?: number[];
}

export interface UpdateTodoInput extends CreateTodoInput {
  id?: never;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  category?: string | null;
  title_template: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: ReminderMinutes | null;
  due_date_offset_minutes?: number | null;
  subtasks_json?: string | null;
}

export interface ExportTodo extends Omit<Todo, 'id' | 'user_id' | 'subtasks' | 'tags'> {
  subtasks: Array<Omit<Subtask, 'id' | 'todo_id'>>;
  tags: Array<Pick<Tag, 'name' | 'color'>>;
}

const dbPath = path.join(process.cwd(), 'todos.db');
export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  credential_public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  last_notification_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  title_template TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  due_date_offset_minutes INTEGER,
  subtasks_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
`);

type TodoRow = Omit<Todo, 'completed' | 'is_recurring' | 'subtasks' | 'tags'> & {
  completed: number;
  is_recurring: number;
};

type SubtaskRow = Omit<Subtask, 'completed'> & { completed: number };

const validPriorities: Priority[] = ['high', 'medium', 'low'];
const validPatterns: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const validReminders: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];

function mapTodo(row: TodoRow): Todo {
  return {
    ...row,
    completed: Boolean(row.completed),
    is_recurring: Boolean(row.is_recurring),
  };
}

function mapSubtask(row: SubtaskRow): Subtask {
  return {
    ...row,
    completed: Boolean(row.completed),
  };
}

function placeholders(ids: number[]): string {
  return ids.map(() => '?').join(', ');
}

function normalizeTodoInput(input: CreateTodoInput | UpdateTodoInput, enforceFutureDueDate = true) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Title is required');
  }

  const priority = input.priority ?? 'medium';
  if (!validPriorities.includes(priority)) {
    throw new Error('Invalid priority');
  }

  const isRecurring = Boolean(input.is_recurring);
  const recurrencePattern = input.recurrence_pattern ?? null;
  if (isRecurring && !input.due_date) {
    throw new Error('Recurring todos require a due date');
  }

  if (recurrencePattern && !validPatterns.includes(recurrencePattern)) {
    throw new Error('Invalid recurrence pattern');
  }

  const reminderMinutes = input.reminder_minutes ?? null;
  if (reminderMinutes !== null && !validReminders.includes(reminderMinutes)) {
    throw new Error('Invalid reminder value');
  }

  const dueDate = input.due_date ?? null;
  if (dueDate && enforceFutureDueDate) {
    const minimum = addSingaporeMinutes(getSingaporeNow(), 1);
    if (parseSingaporeDate(dueDate).getTime() < minimum.getTime()) {
      throw new Error('Due date must be at least 1 minute in the future');
    }
  }

  return {
    title,
    completed: Boolean(input.completed),
    due_date: dueDate,
    priority,
    is_recurring: isRecurring,
    recurrence_pattern: recurrencePattern,
    reminder_minutes: reminderMinutes,
    last_notification_sent: input.last_notification_sent ?? null,
  };
}

function attachRelations(todos: Todo[]): Todo[] {
  if (todos.length === 0) {
    return todos;
  }

  const ids = todos.map((todo) => todo.id);
  const subtasks = db
    .prepare(`SELECT * FROM subtasks WHERE todo_id IN (${placeholders(ids)}) ORDER BY position ASC, id ASC`)
    .all(...ids) as SubtaskRow[];
  const tags = db
    .prepare(
      `SELECT tt.todo_id, t.id, t.user_id, t.name, t.color, t.created_at
       FROM todo_tags tt
       JOIN tags t ON t.id = tt.tag_id
       WHERE tt.todo_id IN (${placeholders(ids)})
       ORDER BY t.name COLLATE NOCASE ASC`,
    )
    .all(...ids) as Array<Tag & { todo_id: number }>;

  const subtaskMap = new Map<number, Subtask[]>();
  for (const subtask of subtasks) {
    const list = subtaskMap.get(subtask.todo_id) ?? [];
    list.push(mapSubtask(subtask));
    subtaskMap.set(subtask.todo_id, list);
  }

  const tagMap = new Map<number, Tag[]>();
  for (const tag of tags) {
    const list = tagMap.get(tag.todo_id) ?? [];
    list.push({ id: tag.id, user_id: tag.user_id, name: tag.name, color: tag.color, created_at: tag.created_at });
    tagMap.set(tag.todo_id, list);
  }

  return todos.map((todo) => ({
    ...todo,
    subtasks: subtaskMap.get(todo.id) ?? [],
    tags: tagMap.get(todo.id) ?? [],
  }));
}

export const userDB = {
  getById(id: number): User | null {
    return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ?? null;
  },
  getByUsername(username: string): User | null {
    return (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined) ?? null;
  },
  create(username: string): User {
    const trimmed = username.trim();
    if (!trimmed) {
      throw new Error('Username is required');
    }

    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(trimmed);
    return this.getById(Number(result.lastInsertRowid)) as User;
  },
  getOrCreate(username: string): User {
    return this.getByUsername(username) ?? this.create(username);
  },
};

export const authenticatorDB = {
  listByUserId(userId: number): Authenticator[] {
    return db
      .prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY created_at ASC')
      .all(userId) as Authenticator[];
  },
  getByCredentialId(credentialId: string): Authenticator | null {
    return (db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Authenticator | undefined) ?? null;
  },
  create(userId: number, credentialId: string, publicKey: Uint8Array | Buffer, counter: number): Authenticator {
    const result = db
      .prepare(
        'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter) VALUES (?, ?, ?, ?)',
      )
      .run(userId, credentialId, Buffer.from(publicKey), counter);
    return db.prepare('SELECT * FROM authenticators WHERE id = ?').get(Number(result.lastInsertRowid)) as Authenticator;
  },
  updateCounter(id: number, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter, id);
  },
};

export const todoDB = {
  listByUserId(userId: number): Todo[] {
    const rows = db
      .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId) as TodoRow[];
    return attachRelations(rows.map(mapTodo));
  },
  getById(userId: number, id: number): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as TodoRow | undefined;
    if (!row) {
      return null;
    }

    return attachRelations([mapTodo(row)])[0] ?? null;
  },
  create(userId: number, input: CreateTodoInput): Todo {
    const normalized = normalizeTodoInput(input);
    const create = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO todos
          (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          normalized.title,
          normalized.completed ? 1 : 0,
          normalized.due_date,
          normalized.priority,
          normalized.is_recurring ? 1 : 0,
          normalized.recurrence_pattern,
          normalized.reminder_minutes,
          normalized.last_notification_sent,
          formatSingaporeDateTime(getSingaporeNow()),
        );

      const todoId = Number(result.lastInsertRowid);
      for (const tagId of input.tagIds ?? []) {
        db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
      }

      return todoId;
    });

    return this.getById(userId, create()) as Todo;
  },
  update(userId: number, id: number, input: Partial<UpdateTodoInput>): Todo | null {
    const existing = this.getById(userId, id);
    if (!existing) {
      return null;
    }

    const nextDueDate = input.due_date === undefined ? existing.due_date : input.due_date;
    const normalized = normalizeTodoInput(
      {
      title: input.title ?? existing.title,
      completed: input.completed ?? existing.completed,
      due_date: nextDueDate,
      priority: input.priority ?? existing.priority,
      is_recurring: input.is_recurring ?? existing.is_recurring,
      recurrence_pattern: input.recurrence_pattern === undefined ? existing.recurrence_pattern : input.recurrence_pattern,
      reminder_minutes: input.reminder_minutes === undefined ? (existing.reminder_minutes as ReminderMinutes | null) : input.reminder_minutes,
      last_notification_sent:
        input.last_notification_sent === undefined ? existing.last_notification_sent : input.last_notification_sent,
      },
      input.due_date !== undefined,
    );

    db.prepare(
      `UPDATE todos
       SET title = ?, completed = ?, due_date = ?, priority = ?, is_recurring = ?, recurrence_pattern = ?,
           reminder_minutes = ?, last_notification_sent = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      normalized.title,
      normalized.completed ? 1 : 0,
      normalized.due_date,
      normalized.priority,
      normalized.is_recurring ? 1 : 0,
      normalized.recurrence_pattern,
      normalized.reminder_minutes,
      normalized.last_notification_sent,
      formatSingaporeDateTime(getSingaporeNow()),
      id,
      userId,
    );

    if (input.tagIds) {
      db.transaction(() => {
        db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(id);
        for (const tagId of input.tagIds ?? []) {
          db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(id, tagId);
        }
      })();
    }

    return this.getById(userId, id);
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
  listNotificationCandidates(userId: number): Todo[] {
    const now = getSingaporeNow();
    const rows = db
      .prepare(
        'SELECT * FROM todos WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL AND reminder_minutes IS NOT NULL',
      )
      .all(userId) as TodoRow[];

    return attachRelations(rows.map(mapTodo)).filter((todo) => {
      if (!todo.due_date || !todo.reminder_minutes) {
        return false;
      }

      const dueDate = parseSingaporeDate(todo.due_date);
      const reminderStart = addSingaporeMinutes(dueDate, -todo.reminder_minutes);
      if (now.getTime() < reminderStart.getTime() || now.getTime() > dueDate.getTime()) {
        return false;
      }

      if (!todo.last_notification_sent) {
        return true;
      }

      const sentAt = parseSingaporeDate(todo.last_notification_sent);
      return sentAt.getTime() < reminderStart.getTime() || sentAt.getTime() > dueDate.getTime();
    });
  },
  markNotificationsSent(userId: number, todoIds: number[]): void {
    if (todoIds.length === 0) {
      return;
    }

    const sentAt = formatSingaporeDateTime(getSingaporeNow());
    db.transaction(() => {
      for (const todoId of todoIds) {
        db.prepare('UPDATE todos SET last_notification_sent = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
          sentAt,
          sentAt,
          todoId,
          userId,
        );
      }
    })();
  },
  createRecurringInstance(userId: number, todo: Todo): Todo | null {
    if (!todo.is_recurring || !todo.recurrence_pattern || !todo.due_date) {
      return null;
    }

    const dueDate = todo.due_date;
    const recurrencePattern = todo.recurrence_pattern;

    const todoId = db.transaction(() => {
      const nextDueDate = calculateNextDueDate(dueDate, recurrencePattern);
      const result = db
        .prepare(
          `INSERT INTO todos
          (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, updated_at)
          VALUES (?, ?, 0, ?, ?, 1, ?, ?, ?)`,
        )
        .run(
          userId,
          todo.title,
          nextDueDate,
          todo.priority,
          todo.recurrence_pattern,
          todo.reminder_minutes,
          formatSingaporeDateTime(getSingaporeNow()),
        );
      const newTodoId = Number(result.lastInsertRowid);

      for (const tag of todo.tags ?? []) {
        db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(newTodoId, tag.id);
      }

      return newTodoId;
    })();

    return this.getById(userId, todoId);
  },
  exportByUserId(userId: number): ExportTodo[] {
    return this.listByUserId(userId).map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      due_date: todo.due_date,
      priority: todo.priority,
      is_recurring: todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      last_notification_sent: todo.last_notification_sent,
      created_at: todo.created_at,
      updated_at: todo.updated_at,
      subtasks: (todo.subtasks ?? []).map(({ title, completed, position, created_at }) => ({
        title,
        completed,
        position,
        created_at,
      })),
      tags: (todo.tags ?? []).map(({ name, color }) => ({ name, color })),
    }));
  },
};

export const subtaskDB = {
  listByTodoId(todoId: number): Subtask[] {
    return (db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC').all(todoId) as SubtaskRow[]).map(
      mapSubtask,
    );
  },
  create(userId: number, todoId: number, title: string): Subtask | null {
    const todo = todoDB.getById(userId, todoId);
    if (!todo) {
      return null;
    }

    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error('Subtask title is required');
    }

    const nextPositionRow = db.prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM subtasks WHERE todo_id = ?').get(todoId) as {
      maxPosition: number;
    };
    const result = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)').run(todoId, trimmed, nextPositionRow.maxPosition + 1);
    const created = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(Number(result.lastInsertRowid)) as SubtaskRow | undefined;
    return created ? mapSubtask(created) : null;
  },
  update(userId: number, id: number, input: { title?: string; completed?: boolean }): Subtask | null {
    const row = db
      .prepare(
        `SELECT s.*
         FROM subtasks s
         JOIN todos t ON t.id = s.todo_id
         WHERE s.id = ? AND t.user_id = ?`,
      )
      .get(id, userId) as SubtaskRow | undefined;
    if (!row) {
      return null;
    }

    const title = input.title === undefined ? row.title : input.title.trim();
    if (!title) {
      throw new Error('Subtask title is required');
    }

    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(
      title,
      input.completed === undefined ? row.completed : input.completed ? 1 : 0,
      id,
    );

    return mapSubtask(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow);
  },
  delete(userId: number, id: number): boolean {
    const result = db
      .prepare(
        `DELETE FROM subtasks
         WHERE id = ?
         AND EXISTS (SELECT 1 FROM todos WHERE todos.id = subtasks.todo_id AND todos.user_id = ?)`,
      )
      .run(id, userId);
    return result.changes > 0;
  },
};

export const tagDB = {
  listByUserId(userId: number): Tag[] {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC').all(userId) as Tag[];
  },
  getById(userId: number, id: number): Tag | null {
    return (db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Tag | undefined) ?? null;
  },
  findByNameCaseInsensitive(userId: number, name: string): Tag | null {
    return (
      db.prepare('SELECT * FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)').get(userId, name.trim()) as Tag | undefined
    ) ?? null;
  },
  create(userId: number, name: string, color = '#3B82F6'): Tag {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tag name is required');
    }

    const result = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(userId, trimmed, color);
    return this.getById(userId, Number(result.lastInsertRowid)) as Tag;
  },
  update(userId: number, id: number, input: { name: string; color: string }): Tag | null {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Tag name is required');
    }

    const result = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(trimmed, input.color, id, userId);
    return result.changes > 0 ? this.getById(userId, id) : null;
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
  attachToTodo(userId: number, todoId: number, tagId: number): boolean {
    const todo = todoDB.getById(userId, todoId);
    const tag = this.getById(userId, tagId);
    if (!todo || !tag) {
      return false;
    }

    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
    return true;
  },
  detachFromTodo(userId: number, todoId: number, tagId: number): boolean {
    const todo = todoDB.getById(userId, todoId);
    const tag = this.getById(userId, tagId);
    if (!todo || !tag) {
      return false;
    }

    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
    return true;
  },
};

export const templateDB = {
  listByUserId(userId: number): Template[] {
    return db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(userId) as Template[];
  },
  getById(userId: number, id: number): Template | null {
    return (db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as Template | undefined) ?? null;
  },
  create(userId: number, input: CreateTemplateInput): Template {
    const name = input.name.trim();
    const titleTemplate = input.title_template.trim();
    if (!name || !titleTemplate) {
      throw new Error('Template name and title are required');
    }

    const priority = input.priority ?? 'medium';
    if (!validPriorities.includes(priority)) {
      throw new Error('Invalid priority');
    }

    if (input.recurrence_pattern && !validPatterns.includes(input.recurrence_pattern)) {
      throw new Error('Invalid recurrence pattern');
    }

    const result = db
      .prepare(
        `INSERT INTO templates
        (user_id, name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_minutes, subtasks_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        name,
        input.description ?? null,
        input.category ?? null,
        titleTemplate,
        priority,
        input.is_recurring ? 1 : 0,
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        input.due_date_offset_minutes ?? null,
        input.subtasks_json ?? null,
      );
    return this.getById(userId, Number(result.lastInsertRowid)) as Template;
  },
  update(userId: number, id: number, input: CreateTemplateInput): Template | null {
    const existing = this.getById(userId, id);
    if (!existing) {
      return null;
    }

    const merged: CreateTemplateInput = {
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      category: input.category === undefined ? existing.category : input.category,
      title_template: input.title_template ?? existing.title_template,
      priority: input.priority ?? existing.priority,
      is_recurring: input.is_recurring ?? existing.is_recurring,
      recurrence_pattern: input.recurrence_pattern === undefined ? existing.recurrence_pattern : input.recurrence_pattern,
      reminder_minutes: input.reminder_minutes === undefined ? (existing.reminder_minutes as ReminderMinutes | null) : input.reminder_minutes,
      due_date_offset_minutes:
        input.due_date_offset_minutes === undefined ? existing.due_date_offset_minutes : input.due_date_offset_minutes,
      subtasks_json: input.subtasks_json === undefined ? existing.subtasks_json : input.subtasks_json,
    };

    db.prepare(
      `UPDATE templates
       SET name = ?, description = ?, category = ?, title_template = ?, priority = ?, is_recurring = ?,
           recurrence_pattern = ?, reminder_minutes = ?, due_date_offset_minutes = ?, subtasks_json = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      merged.name.trim(),
      merged.description ?? null,
      merged.category ?? null,
      merged.title_template.trim(),
      merged.priority,
      merged.is_recurring ? 1 : 0,
      merged.recurrence_pattern ?? null,
      merged.reminder_minutes ?? null,
      merged.due_date_offset_minutes ?? null,
      merged.subtasks_json ?? null,
      id,
      userId,
    );

    return this.getById(userId, id);
  },
  delete(userId: number, id: number): boolean {
    const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
  useTemplate(userId: number, id: number): Todo | null {
    const template = this.getById(userId, id);
    if (!template) {
      return null;
    }

    const parsedSubtasks = template.subtasks_json ? (JSON.parse(template.subtasks_json) as TemplateSubtaskInput[]) : [];
    const now = getSingaporeNow();
    const dueDate =
      template.due_date_offset_minutes === null ? null : formatSingaporeDateTime(addSingaporeMinutes(now, template.due_date_offset_minutes));

    const createTodoFromTemplate = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO todos
          (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          template.title_template,
          dueDate,
          template.priority,
          template.is_recurring ? 1 : 0,
          template.recurrence_pattern,
          template.reminder_minutes,
          formatSingaporeDateTime(now),
        );

      const todoId = Number(result.lastInsertRowid);
      for (const subtask of parsedSubtasks) {
        db.prepare('INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, 0, ?)').run(
          todoId,
          subtask.title,
          subtask.position,
        );
      }

      return todoId;
    });

    return todoDB.getById(userId, createTodoFromTemplate());
  },
};

export const holidayDB = {
  list(): Holiday[] {
    return db.prepare('SELECT id, date, name FROM holidays ORDER BY date ASC').all() as Holiday[];
  },
  listByMonth(month: string): Holiday[] {
    return db
      .prepare('SELECT id, date, name FROM holidays WHERE date LIKE ? ORDER BY date ASC')
      .all(`${month}%`) as Holiday[];
  },
  upsertMany(holidays: Array<{ date: string; name: string }>): void {
    const statement = db.prepare(
      `INSERT INTO holidays (date, name) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET name = excluded.name`,
    );
    db.transaction(() => {
      for (const holiday of holidays) {
        statement.run(holiday.date, holiday.name);
      }
    })();
  },
};
