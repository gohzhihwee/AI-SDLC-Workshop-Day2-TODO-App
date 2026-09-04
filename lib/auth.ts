import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { JWTPayload } from 'jose';
import type { Session } from '@/lib/db';

export interface SessionPayload extends Session, JWTPayload {}


export const SESSION_COOKIE_NAME = 'todo-app-session';

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'todo-app-dev-secret');

export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT(session as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    const username = payload.username;

    if (typeof userId !== 'number' || typeof username !== 'string') {
      return null;
    }

    return { userId, username };
  } catch {
    return null;
  }
}

export async function createSession(session: Session): Promise<void> {
  const token = await signSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
