import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

export const runtime = 'nodejs';

type TemplateRequest = Parameters<typeof templateDB.create>[1] & {
  subtasks?: Array<{ title: string; position: number }>;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ templates: templateDB.listByUserId(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TemplateRequest;
    const template = templateDB.create(session.userId, {
      ...body,
      subtasks_json:
        body.subtasks_json ??
        (body.subtasks ? JSON.stringify(body.subtasks.map((subtask, index) => ({ title: subtask.title, position: subtask.position ?? index }))) : null),
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create template' }, { status: 400 });
  }
}
