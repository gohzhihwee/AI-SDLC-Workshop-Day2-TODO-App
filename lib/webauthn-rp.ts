import type { NextRequest } from 'next/server';

/**
 * Derives the WebAuthn relying party origin/ID from the browser's actual
 * `Origin` header. `request.nextUrl` normalizes `127.0.0.1` to `localhost`,
 * which breaks WebAuthn's origin/rpID matching when a client navigates via
 * an IP address (e.g. Playwright's `127.0.0.1:3000` base URL).
 */
export function getRelyingPartyOrigin(request: NextRequest): { origin: string; rpID: string } {
  const originHeader = request.headers.get('origin');
  const origin = originHeader ?? request.nextUrl.origin;
  const rpID = new URL(origin).hostname;
  return { origin, rpID };
}
