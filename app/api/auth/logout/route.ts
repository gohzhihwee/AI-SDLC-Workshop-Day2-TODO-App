import { NextResponse } from 'next/server';
import { clearLoginState, clearRegisterState } from '@/lib/webauthn-state';
import { deleteSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  await deleteSession();
  await clearLoginState();
  await clearRegisterState();
  return NextResponse.json({ ok: true });
}
