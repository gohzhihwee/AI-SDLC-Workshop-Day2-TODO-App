import type { NextRequest } from 'next/server';

export function getRelyingPartyOrigin(request: NextRequest): { origin: string; rpID: string } {
  const configuredOrigin = process.env.RP_ORIGIN;
  const configuredRpId = process.env.RP_ID;
  if (configuredOrigin && configuredRpId) {
    return { origin: configuredOrigin, rpID: configuredRpId };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RP_ORIGIN and RP_ID are required in production');
  }

  const originHeader = request.headers.get('origin');
  const origin = originHeader ?? request.nextUrl.origin;
  const hostname = new URL(origin).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('Unsupported WebAuthn origin');
  }
  const rpID = hostname;
  return { origin, rpID };
}
