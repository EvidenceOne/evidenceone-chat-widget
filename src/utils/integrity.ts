/**
 * Brand-integrity verification — runtime check against build-time SHA-256
 * hashes of the EvidenceOne logo SVG and trigger-button label.
 *
 * The `__INJECT_*` placeholders in BRAND_HASHES are replaced at build time by
 * the `brandIntegrity()` hook in stencil.config.ts. If the build hook fails to
 * substitute (e.g. dev mode), the slot stays a non-digest sentinel and
 * verifyBrand() fails closed, so the widget refuses to authenticate.
 *
 * What this catches: partial bundle patches that swap the logo SVG bytes
 * but leave the hash constants untouched, and post-mount DOM tampering
 * caught by the MutationObserver in eo-chat-header.
 *
 * What this does NOT catch: a partner who forks the package and rebuilds
 * the whole bundle with recomputed hashes. That requires server-side
 * verification at /partner/register against an allowlist of EvidenceOne
 * build hashes — out of scope for this repo.
 */

export const BRAND_HASHES = {
  logo: '__INJECT_LOGO_HASH__' as string,
  trigger: '__INJECT_TRIGGER_HASH__' as string,
} as const;

/**
 * A correctly built bundle has each BRAND_HASHES slot replaced by a 64-char
 * lowercase SHA-256 hex digest. Anything else — most importantly the unreplaced
 * `__INJECT_*` sentinel from a dev build — is not a valid digest and must fail
 * closed.
 *
 * Do NOT guard by keeping the sentinel literals in an array here: the build
 * hook does a global text replace of the sentinel across the whole chunk, so a
 * sentinel-valued array would itself be rewritten to the real hashes and then
 * reject every valid build. Match on shape instead.
 */
const SUBSTITUTED_HASH = /^[0-9a-f]{64}$/;

/** The canonical trigger-button label. Treated as a hashable constant. */
export const BRAND_TRIGGER_TEXT = 'Consultar EvidenceOne';

let brandOk = true;

/** Read by the root component before opening the drawer. False after any verifyBrand() failure. */
export function isBrandIntact(): boolean {
  return brandOk;
}

/** Latches brand-broken state. Used by runtime DOM-tampering observers. Idempotent and cannot be undone at runtime. */
export function markBrandBroken(): void {
  brandOk = false;
}

/**
 * Verify that `content` hashes to the expected build-time fingerprint.
 * Side effect: a failure latches `brandOk` to false (cannot be un-failed at runtime).
 */
export async function verifyBrand(
  content: string,
  key: keyof typeof BRAND_HASHES,
): Promise<boolean> {
  const expected = BRAND_HASHES[key];
  if (!expected || !SUBSTITUTED_HASH.test(expected)) {
    brandOk = false;
    return false;
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Old browsers — fail closed.
    brandOk = false;
    return false;
  }

  const actual = await sha256Hex(content);
  if (actual !== expected) {
    brandOk = false;
    return false;
  }
  return true;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
