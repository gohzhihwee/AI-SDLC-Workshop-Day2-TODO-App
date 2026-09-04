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

    const user = userDB.getOrCreate(trimmed);
    const authenticators = authenticatorDB.listByUserId(user.id);
    const { rpID } = getRelyingPartyOrigin(request);
    const options = await generateRegistrationOptions({
      rpName: 'Todo App',
      rpID,
      userName: user.username,
      userID: isoUint8Array.fromUTF8String(String(user.id)),
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
      userId: user.id,
      username: user.username,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return NextResponse.json(options);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create options' }, { status: 400 });
  }
}
