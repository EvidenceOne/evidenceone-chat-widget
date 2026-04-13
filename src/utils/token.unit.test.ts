import { describe, expect, it } from 'vitest';
import { decodeJWT, isTokenExpired } from './token';

// Helper — builds a base64-encoded JWT with a given payload
function makeJWT(payload: object): string {
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}

describe('decodeJWT', () => {
  it('returns the payload for a valid JWT', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = decodeJWT(makeJWT({ exp, sub: 'user' }));
    expect(payload).not.toBeNull();
    expect(payload!.exp).toBe(exp);
  });

  it('returns null for a token that is not three parts', () => {
    expect(decodeJWT('notajwt')).toBeNull();
  });

  it('returns null for a token with non-base64 payload', () => {
    expect(decodeJWT('header.!!!.signature')).toBeNull();
  });

  it('returns null for a token missing the exp claim', () => {
    expect(decodeJWT(makeJWT({ sub: 'user' }))).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJWT('')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for a valid token with time remaining beyond buffer', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(true);
  });

  it('returns true within the default 60-second buffer (expires in 30s)', () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isTokenExpired(makeJWT({ exp }))).toBe(true);
  });

  it('respects a custom bufferSeconds parameter', () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    // With a 10s buffer, 30s remaining is NOT expired
    expect(isTokenExpired(makeJWT({ exp }), 10)).toBe(false);
    // With a 60s buffer, 30s remaining IS expired
    expect(isTokenExpired(makeJWT({ exp }), 60)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('notajwt')).toBe(true);
  });

  it('returns true for an empty string', () => {
    expect(isTokenExpired('')).toBe(true);
  });
});
