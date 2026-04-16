import { describe, expect, it } from 'vitest';
import { computeTrapTarget } from './focus-trap';

function makeEvent(key: string, shiftKey = false): KeyboardEvent {
  return { key, shiftKey, preventDefault: () => {} } as unknown as KeyboardEvent;
}

describe('computeTrapTarget', () => {
  const first = { id: 'first' } as unknown as HTMLElement;
  const middle = { id: 'middle' } as unknown as HTMLElement;
  const last = { id: 'last' } as unknown as HTMLElement;
  const focusables = [first, middle, last];

  it('returns null for non-Tab keys', () => {
    expect(computeTrapTarget(makeEvent('Enter'), focusables, first)).toBeNull();
    expect(computeTrapTarget(makeEvent('Escape'), focusables, middle)).toBeNull();
  });

  it('returns null when no focusables exist', () => {
    expect(computeTrapTarget(makeEvent('Tab'), [], null)).toBeNull();
  });

  it('wraps Shift+Tab from first to last', () => {
    expect(computeTrapTarget(makeEvent('Tab', true), focusables, first)).toBe(last);
  });

  it('wraps Tab from last to first', () => {
    expect(computeTrapTarget(makeEvent('Tab'), focusables, last)).toBe(first);
  });

  it('returns null in the middle (browser handles)', () => {
    expect(computeTrapTarget(makeEvent('Tab'), focusables, middle)).toBeNull();
    expect(computeTrapTarget(makeEvent('Tab', true), focusables, middle)).toBeNull();
  });
});
