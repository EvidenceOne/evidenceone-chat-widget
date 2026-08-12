import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it("resolves 'light' regardless of system preference", () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it("resolves 'dark' regardless of system preference", () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it("'auto' follows the system preference", () => {
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('dark');
  });

  it('falls back to light for unknown or missing values', () => {
    // Stencil passes raw attribute strings — bad input must not break theming
    expect(resolveTheme('DARK', true)).toBe('light');
    expect(resolveTheme('', true)).toBe('light');
    expect(resolveTheme(undefined, true)).toBe('light');
    expect(resolveTheme(null, true)).toBe('light');
  });
});
