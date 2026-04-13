/**
 * JWT utilities — client-side only. No signature verification.
 * The server verifies the token on every request.
 */

interface JWTPayload {
  exp: number;
  [key: string]: unknown;
}

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Returns null for any malformed token.
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Pad base64url to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

    if (typeof payload.exp !== 'number') return null;
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is expired or will expire within bufferSeconds.
 * Returns true for any malformed/missing token — triggers re-auth.
 */
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJWT(token);
  if (!payload) return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < bufferSeconds;
}
