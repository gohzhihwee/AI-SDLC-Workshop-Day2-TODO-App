import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { name, color } = (await request.json()) as { name?: string; color?: string };
    const tag = tagDB.update(session.userId, Number(id), { name: name ?? '', color: color ?? '#3B82F6' });
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update tag' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = tagDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
