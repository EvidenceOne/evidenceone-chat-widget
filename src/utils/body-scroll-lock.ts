/**
 * Reference-counted body scroll lock.
 * Multiple drawers can coexist — only releases the lock when the last one closes.
 */

let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow ?? '';
    previousOverflow = null;
  }
}

/** Test-only helper */
export function __resetBodyScrollLock(): void {
  lockCount = 0;
  previousOverflow = null;
}
