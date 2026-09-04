import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { clearRegisterState, getRegisterState } from '@/lib/webauthn-state';
import { getRelyingPartyOrigin } from '@/lib/webauthn-rp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const state = await getRegisterState();
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

    if (!verification.verified || !verification.registrationInfo || !state.userId) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    const user = userDB.getById(state.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { credential } = verification.registrationInfo;
    const credentialId = credential.id;
    if (!authenticatorDB.getByCredentialId(credentialId)) {
      authenticatorDB.create(user.id, credentialId, Buffer.from(credential.publicKey), credential.counter ?? 0);
    }

    await createSession({ userId: user.id, username: user.username });
    await clearRegisterState();

    return NextResponse.json({ verified: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Registration verification failed' }, { status: 400 });
  }
}
