import { cookies } from 'next/headers';

export type WebAuthnState = {
  challenge: string;
  userId?: number;
  username: string;
  expiresAt: number;
};

const registerCookieName = 'todo-app-register-state';
const loginCookieName = 'todo-app-login-state';

function encode(value: WebAuthnState): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(value: string): WebAuthnState | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as WebAuthnState;
  } catch {
    return null;
  }
}

async function setState(cookieName: string, value: WebAuthnState) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encode(value), {
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

  const decoded = decode(value);
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

export function setRegisterState(value: WebAuthnState) {
  return setState(registerCookieName, value);
}

export function getRegisterState() {
  return getState(registerCookieName);
}

export function clearRegisterState() {
  return clearState(registerCookieName);
}

export function setLoginState(value: WebAuthnState) {
  return setState(loginCookieName, value);
}

export function getLoginState() {
  return getState(loginCookieName);
}

export function clearLoginState() {
  return clearState(loginCookieName);
}
