import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const { tagId } = (await request.json()) as { tagId?: number };
  const attached = tagDB.attachToTodo(session.userId, Number(id), Number(tagId));
  if (!attached) {
    return NextResponse.json({ error: 'Todo or tag not found' }, { status: 404 });
  }

  return NextResponse.json({ todo: todoDB.getById(session.userId, Number(id)) });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const { tagId } = (await request.json()) as { tagId?: number };
  const detached = tagDB.detachFromTodo(session.userId, Number(id), Number(tagId));
  if (!detached) {
    return NextResponse.json({ error: 'Todo or tag not found' }, { status: 404 });
  }

  return NextResponse.json({ todo: todoDB.getById(session.userId, Number(id)) });
}
