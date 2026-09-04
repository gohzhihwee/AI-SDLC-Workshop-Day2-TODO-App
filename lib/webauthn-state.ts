import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { webauthnChallengeDB } from '@/lib/db';

export type WebAuthnState = {
  challenge: string;
  userId?: number;
  username: string;
  expiresAt: number;
};

const registerCookieName = 'todo-app-register-state';
const loginCookieName = 'todo-app-login-state';

function getWebAuthnStateSecret(): Uint8Array {
  const webAuthnSecret = process.env.JWT_SECRET;
  if (!webAuthnSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return new TextEncoder().encode(webAuthnSecret ?? 'todo-app-dev-secret');
}

async function encode(value: WebAuthnState): Promise<string> {
  return new SignJWT({ ...value })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(value.expiresAt / 1000))
    .sign(getWebAuthnStateSecret());
}

async function decode(value: string): Promise<WebAuthnState | null> {
  try {
    const { payload } = await jwtVerify(value, getWebAuthnStateSecret());
    if (
      typeof payload.challenge !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      (payload.userId !== undefined && typeof payload.userId !== 'number')
    ) {
      return null;
    }

    return {
      challenge: payload.challenge,
      userId: payload.userId,
      username: payload.username,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

async function setState(cookieName: string, kind: 'register' | 'login', value: WebAuthnState) {
  webauthnChallengeDB.create(value.challenge, kind, value.userId, value.username, value.expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(cookieName, await encode(value), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  });
}

async function getState(cookieName: string): Promise<WebAuthnState | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName)?.value;
  if (!value) {
    return null;
  }

  const decoded = await decode(value);
  if (!decoded || decoded.expiresAt < Date.now()) {
    return null;
  }

  return decoded;
}

async function clearState(cookieName: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

async function consumeState(cookieName: string, kind: 'register' | 'login'): Promise<WebAuthnState | null> {
  const state = await getState(cookieName);
  if (!state || !webauthnChallengeDB.consume(state.challenge, kind)) {
    return null;
  }
  await clearState(cookieName);
  return state;
}

export function setRegisterState(value: WebAuthnState) {
  return setState(registerCookieName, 'register', value);
}

export function getRegisterState() {
  return getState(registerCookieName);
}

export function clearRegisterState() {
  return clearState(registerCookieName);
}

export function consumeRegisterState() {
  return consumeState(registerCookieName, 'register');
}

export function setLoginState(value: WebAuthnState) {
  return setState(loginCookieName, 'login', value);
}

export function getLoginState() {
  return getState(loginCookieName);
}

export function clearLoginState() {
  return clearState(loginCookieName);
}

export function consumeLoginState() {
  return consumeState(loginCookieName, 'login');
}
