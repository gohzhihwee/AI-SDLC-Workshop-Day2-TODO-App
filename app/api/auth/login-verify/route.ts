import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { consumeLoginState } from '@/lib/webauthn-state';
import { getRelyingPartyOrigin } from '@/lib/webauthn-rp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const state = await consumeLoginState();
    if (!state || !state.userId) {
      return NextResponse.json({ error: 'Login session expired' }, { status: 400 });
    }

    const body = (await request.json()) as { response?: { id?: string }; username?: string };
    const username = body.username?.trim() ?? '';
    const credentialId = body.response?.id ?? '';
    if (!body.response || username !== state.username || !credentialId) {
      return NextResponse.json({ error: 'Invalid login request' }, { status: 400 });
    }

    const authenticator = authenticatorDB.getByCredentialId(credentialId);
    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 });
    }

    if (authenticator.user_id !== state.userId) {
      return NextResponse.json({ error: 'Authenticator/user mismatch' }, { status: 400 });
    }

    const { origin, rpID } = getRelyingPartyOrigin(request);
    const verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: state.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: new Uint8Array(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
    }

    const currentCounter = authenticator.counter ?? 0;
    const nextCounter = verification.authenticationInfo.newCounter ?? 0;
    if (!(currentCounter === 0 && nextCounter === 0) && nextCounter <= currentCounter) {
      return NextResponse.json({ error: 'Authenticator counter did not advance' }, { status: 400 });
    }

    if (!authenticatorDB.updateCounterIfAdvances(authenticator.id, currentCounter, nextCounter)) {
      return NextResponse.json({ error: 'Authenticator counter did not advance' }, { status: 400 });
    }
    const user = userDB.getById(state.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ verified: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login verification failed', error);
    return NextResponse.json({ error: 'Login verification failed' }, { status: 400 });
  }
}
