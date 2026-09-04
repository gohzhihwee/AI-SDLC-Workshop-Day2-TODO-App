import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const subtask = subtaskDB.update(session.userId, Number(id), (await request.json()) as { title?: string; completed?: boolean });
    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json({ subtask });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update subtask' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = subtaskDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
