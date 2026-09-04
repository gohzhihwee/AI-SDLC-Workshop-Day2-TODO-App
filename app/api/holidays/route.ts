import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { holidayDB } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get('month');
  return NextResponse.json({ holidays: month ? holidayDB.listByMonth(month) : holidayDB.list() });
}
