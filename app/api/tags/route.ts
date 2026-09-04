import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ tags: tagDB.listByUserId(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { name, color } = (await request.json()) as { name?: string; color?: string };
    const tag = tagDB.create(session.userId, name ?? '', color ?? '#3B82F6');
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create tag' }, { status: 400 });
  }
}
