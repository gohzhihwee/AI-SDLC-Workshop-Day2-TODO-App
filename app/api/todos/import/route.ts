import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { db, tagDB } from '@/lib/db';
import { formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';

export const runtime = 'nodejs';

const importTodoSchema = z.object({
  title: z.string().trim().min(1),
  completed: z.boolean(),
  due_date: z.string().nullable(),
  priority: z.enum(['high', 'medium', 'low']),
  is_recurring: z.boolean(),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable(),
  reminder_minutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(120),
    z.literal(1440),
    z.literal(2880),
    z.literal(10080),
  ]).nullable(),
  last_notification_sent: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  subtasks: z.array(
    z.object({
      title: z.string().trim().min(1),
      completed: z.boolean(),
      position: z.number().int(),
      created_at: z.string(),
    }),
  ),
  tags: z.array(
    z.object({
      name: z.string().trim().min(1),
      color: z.string().min(1),
    }),
  ),
})
  .refine((todo) => todo.reminder_minutes === null || todo.due_date !== null, { message: 'Reminders require a due date' })
  .refine((todo) => !todo.is_recurring || (todo.due_date !== null && todo.recurrence_pattern !== null), {
    message: 'Recurring todos require a due date and recurrence pattern',
  });

const importSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  todos: z.array(importTodoSchema),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }
    const payload = importSchema.parse(body);
    const importTransaction = db.transaction(() => {
      for (const todo of payload.todos) {
        const result = db
          .prepare(
            `INSERT INTO todos
            (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            session.userId,
            todo.title,
            todo.completed ? 1 : 0,
            todo.due_date,
            todo.priority,
            todo.is_recurring ? 1 : 0,
            todo.recurrence_pattern,
            todo.reminder_minutes,
            todo.last_notification_sent,
            todo.updated_at ?? formatSingaporeDateTime(getSingaporeNow()),
          );
        const todoId = Number(result.lastInsertRowid);

        for (const [position, subtask] of todo.subtasks.entries()) {
          db.prepare('INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, ?, ?, ?)').run(
            todoId,
            subtask.title,
            subtask.completed ? 1 : 0,
            position,
            subtask.created_at,
          );
        }

        for (const tag of todo.tags) {
          const existing = tagDB.findByNameCaseInsensitive(session.userId, tag.name);
          const tagId =
            existing?.id ??
            Number(
              db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(session.userId, tag.name, tag.color)
                .lastInsertRowid,
            );
          db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
        }
      }
    });

    importTransaction();
    return NextResponse.json({ imported: payload.todos.length });
  } catch {
    return NextResponse.json({ error: 'Failed to import todos. Please check the file format.' }, { status: 400 });
  }
}
