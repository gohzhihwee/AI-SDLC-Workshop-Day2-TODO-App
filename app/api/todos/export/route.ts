import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { formatSingaporeDate, formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';

export const runtime = 'nodejs';

function escapeCsv(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format');
  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
  }

  const filenameDate = formatSingaporeDate(getSingaporeNow());
  const todos = todoDB.exportByUserId(session.userId);
  if (format === 'json') {
    return new NextResponse(
      JSON.stringify(
        {
          version: 1,
          exported_at: formatSingaporeDateTime(getSingaporeNow()),
          todos: todos.map(({ id, ...todo }) => {
            void id;
            return todo;
          }),
        },
        null,
        2,
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="todos-${filenameDate}.json"`,
        },
      },
    );
  }

  const lines = [
    'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder',
    ...todos.map((todo) =>
      [
        todo.id,
        escapeCsv(todo.title),
        todo.completed,
        escapeCsv(todo.due_date),
        todo.priority,
        todo.is_recurring,
        escapeCsv(todo.recurrence_pattern),
        escapeCsv(todo.reminder_minutes),
      ].join(','),
    ),
  ];

  return new NextResponse(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="todos-${filenameDate}.csv"`,
    },
  });
}
