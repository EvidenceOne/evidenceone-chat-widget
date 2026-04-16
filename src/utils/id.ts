/**
 * Generates an identifier for in-memory message keys.
 * Uses `crypto.randomUUID()` when available (Chrome 92+, Firefox 96+, Safari 15.4+).
 * Falls back to a v4-shape UUID derived from Math.random for older browsers.
 *
 * NOT CRYPTOGRAPHIC. Only used for React-style list `key` values and internal id tracking.
 */
export function generateId(): string {
  const g = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (g?.randomUUID) return g.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
