/**
 * JWT utilities — client-side only. No signature verification.
 * The server verifies the token on every request.
 */

const EXPIRY_BUFFER_SECONDS = 60;

/**
 * Returns true if the token is expired or will expire within 60 seconds.
 * Returns true for any malformed/missing token — triggers re-auth.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Pad base64url to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

    if (typeof payload.exp !== 'number') return true;

    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp - nowSeconds < EXPIRY_BUFFER_SECONDS;
  } catch {
    return true;
  }
}
