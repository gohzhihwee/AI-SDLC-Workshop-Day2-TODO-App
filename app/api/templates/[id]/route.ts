import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const template = templateDB.update(session.userId, Number(id), (await request.json()) as Parameters<typeof templateDB.update>[2]);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update template' }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = templateDB.delete(session.userId, Number(id));
  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
