import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ todo });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  const existing = todoDB.getById(session.userId, todoId);
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Parameters<typeof todoDB.update>[2];
    const todo = todoDB.update(session.userId, todoId, body);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    const createdRecurring =
      !existing.completed && body.completed === true && existing.is_recurring ? todoDB.createRecurringInstance(session.userId, existing) : null;

    return NextResponse.json({ todo, recurringTodo: createdRecurring });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update todo' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = todoDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
