import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('returns a 36-char UUID shape with 4 dashes', () => {
    const id = generateId();
    expect(id).toHaveLength(36);
    expect(id.split('-').length).toBe(5);
  });

  it('returns distinct values across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateId());
    expect(seen.size).toBe(1000);
  });

  describe('fallback when crypto.randomUUID is absent', () => {
    const originalCrypto = (globalThis as { crypto?: unknown }).crypto;

    beforeEach(() => {
      // Simulate older Safari: crypto exists but without randomUUID
      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
      });
      vi.restoreAllMocks();
    });

    it('still returns a valid UUID shape via the Math.random fallback', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('still produces distinct values via fallback', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 500; i++) seen.add(generateId());
      expect(seen.size).toBe(500);
    });
  });
});
