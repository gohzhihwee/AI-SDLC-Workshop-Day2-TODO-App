import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const todo = templateDB.useTemplate(session.userId, Number(id));
    if (!todo) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to use template' }, { status: 400 });
  }
}
