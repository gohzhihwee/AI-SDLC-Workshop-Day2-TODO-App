import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { setRegisterState } from '@/lib/webauthn-state';
import { getRelyingPartyOrigin } from '@/lib/webauthn-rp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { username } = (await request.json()) as { username?: string };
    const trimmed = username?.trim() ?? '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const existingUser = userDB.getByUsername(trimmed);
    if (existingUser && authenticatorDB.listByUserId(existingUser.id).length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const authenticators = existingUser ? authenticatorDB.listByUserId(existingUser.id) : [];
    const { rpID } = getRelyingPartyOrigin(request);
    const options = await generateRegistrationOptions({
      rpName: process.env.RP_NAME ?? 'Todo App',
      rpID,
      userName: trimmed,
      userID: isoUint8Array.fromUTF8String(String(existingUser?.id ?? crypto.randomUUID())),
      excludeCredentials: authenticators.map((authenticator) => ({
        id: authenticator.credential_id,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await setRegisterState({
      challenge: options.challenge,
      userId: existingUser?.id,
      username: trimmed,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('Unable to create registration options', error);
    return NextResponse.json({ error: 'Unable to create registration options' }, { status: 500 });
  }
}
