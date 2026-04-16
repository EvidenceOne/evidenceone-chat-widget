/**
 * Focus trap utility — pure Functional Core + a small imperative setup.
 * Used by eo-drawer to hold keyboard focus inside the modal until closed.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Pure: list keyboard-focusable descendants of `root` in DOM order.
 *
 * `root` should be the **light-DOM host** (the custom-element) of the modal,
 * NOT its shadowRoot — slotted content lives in the host's light DOM, not the
 * drawer's shadow DOM, so starting from `shadowRoot` would miss it.
 *
 * Traversal recurses into every open shadow root encountered so that focusables
 * inside nested shadow-scoped custom elements are discovered.
 */
export function getFocusableElements(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: ParentNode) => {
    const matches = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    matches.forEach(el => {
      if (el.offsetParent !== null || el === document.activeElement) out.push(el);
    });
    node.querySelectorAll<Element>('*').forEach(child => {
      const sr = (child as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr && sr.mode === 'open') visit(sr);
    });
  };
  visit(root);
  return out;
}

/**
 * Pure: given a Tab event and the current focusables list, decide where focus
 * should go next. Returns the element to focus, or null for "let browser handle".
 */
export function computeTrapTarget(
  e: KeyboardEvent,
  focusables: HTMLElement[],
  active: Element | null,
): HTMLElement | null {
  if (e.key !== 'Tab' || focusables.length === 0) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && active === first) return last;
  if (!e.shiftKey && active === last) return first;
  return null;
}

/**
 * Attach a focus trap to `root`. Returns a teardown function that restores
 * focus to `restoreTo` (typically the element that triggered the modal).
 *
 * Focus is NOT auto-captured from `document.activeElement` because install is
 * deferred by the caller (via rAF, after animation kickoff) — by then focus
 * has already moved, making auto-capture unreliable.
 */
export function setupFocusTrap(
  root: ParentNode,
  restoreTo?: HTMLElement | null,
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    const focusables = getFocusableElements(root);
    const target = computeTrapTarget(e, focusables, document.activeElement);
    if (target) {
      e.preventDefault();
      target.focus();
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);

  // Move focus into the trap on install
  const focusables = getFocusableElements(root);
  if (focusables.length > 0) {
    focusables[0].focus();
  }

  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    restoreTo?.focus?.();
  };
}
