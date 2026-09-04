import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { consumeRegisterState } from '@/lib/webauthn-state';
import { getRelyingPartyOrigin } from '@/lib/webauthn-rp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const state = await consumeRegisterState();
    if (!state) {
      return NextResponse.json({ error: 'Registration session expired' }, { status: 400 });
    }

    const body = (await request.json()) as { response?: unknown; username?: string };
    const username = body.username?.trim() ?? '';
    if (!body.response || username !== state.username) {
      return NextResponse.json({ error: 'Invalid registration request' }, { status: 400 });
    }

    const { origin, rpID } = getRelyingPartyOrigin(request);
    const verification = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: state.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const user = state.userId ? userDB.getById(state.userId) : userDB.getByUsername(state.username) ?? userDB.create(state.username);
    if (!user) {
      return NextResponse.json({ error: 'Registration failed' }, { status: 400 });
    }

    if (authenticatorDB.listByUserId(user.id).length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const { credential } = verification.registrationInfo;
    const credentialId = credential.id;
    if (authenticatorDB.getByCredentialId(credentialId)) {
      return NextResponse.json({ error: 'Credential already registered' }, { status: 409 });
    }
    authenticatorDB.create(user.id, credentialId, Buffer.from(credential.publicKey), credential.counter ?? 0);

    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ verified: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Registration verification failed', error);
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
  }
}
