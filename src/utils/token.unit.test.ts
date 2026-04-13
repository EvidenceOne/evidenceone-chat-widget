import { describe, expect, it } from 'vitest';
import { isTokenExpired } from './token';

// Helper — builds a base64-encoded JWT with a given payload
function makeJWT(payload: object): string {
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}

describe('isTokenExpired', () => {
  it('returns false for a valid token with time remaining beyond buffer', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(true);
  });

  it('returns true within the 60-second buffer (expires in 30s)', () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(true);
  });

  it('returns true for a malformed token (not three parts)', () => {
    expect(isTokenExpired('notajwt')).toBe(true);
  });

  it('returns true for a token with non-base64 payload', () => {
    expect(isTokenExpired('header.!!!.signature')).toBe(true);
  });

  it('returns true for a token missing the exp claim', () => {
    expect(isTokenExpired(makeJWT({ sub: 'user' }))).toBe(true);
  });

  it('returns true for an empty string', () => {
    expect(isTokenExpired('')).toBe(true);
  });
});
