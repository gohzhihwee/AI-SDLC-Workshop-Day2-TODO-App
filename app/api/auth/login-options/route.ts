import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatorDB, userDB } from '@/lib/db';
import { setLoginState } from '@/lib/webauthn-state';
import { getRelyingPartyOrigin } from '@/lib/webauthn-rp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { username } = (await request.json()) as { username?: string };
    const trimmed = username?.trim() ?? '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const user = userDB.getByUsername(trimmed);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const authenticators = authenticatorDB.listByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json({ error: 'No passkeys registered for this user' }, { status: 404 });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRelyingPartyOrigin(request).rpID,
      allowCredentials: authenticators.map((authenticator) => ({
        id: authenticator.credential_id,
        type: 'public-key' as const,
      })),
      userVerification: 'preferred',
    });

    await setLoginState({
      challenge: options.challenge,
      userId: user.id,
      username: user.username,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return NextResponse.json(options);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create login options' }, { status: 400 });
  }
}
