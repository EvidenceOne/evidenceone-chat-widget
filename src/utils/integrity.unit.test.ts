import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest module isolation — re-import the integrity module per test so the
// `brandOk` latch starts fresh.
async function freshIntegrity() {
  vi.resetModules();
  return import('./integrity');
}

describe('verifyBrand', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false and latches brandOk when hashes are still placeholders', async () => {
    const mod = await freshIntegrity();
    const ok = await mod.verifyBrand('any content', 'logo');
    expect(ok).toBe(false);
    expect(mod.isBrandIntact()).toBe(false);
  });

  it('returns false when crypto.subtle is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const mod = await freshIntegrity();
      const ok = await mod.verifyBrand('any content', 'trigger');
      expect(ok).toBe(false);
      expect(mod.isBrandIntact()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    }
  });

  it('markBrandBroken() flips isBrandIntact() to false', async () => {
    const mod = await freshIntegrity();
    expect(mod.isBrandIntact()).toBe(true);
    mod.markBrandBroken();
    expect(mod.isBrandIntact()).toBe(false);
  });

  it('exports the canonical trigger label', async () => {
    const mod = await freshIntegrity();
    expect(mod.BRAND_TRIGGER_TEXT).toBe('Consultar EvidenceOne');
  });
});
