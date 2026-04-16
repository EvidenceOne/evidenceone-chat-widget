import { beforeEach, describe, expect, it } from 'vitest';
import { __resetBodyScrollLock, lockBodyScroll, unlockBodyScroll } from './body-scroll-lock';

describe('body-scroll-lock', () => {
  beforeEach(() => {
    __resetBodyScrollLock();
    document.body.style.overflow = '';
  });

  it('locks body overflow on first lock', () => {
    lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('keeps lock while nested locks are held', () => {
    lockBodyScroll();
    lockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('releases lock only after matching unlocks', () => {
    lockBodyScroll();
    lockBodyScroll();
    unlockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('');
  });

  it('preserves prior overflow value when lock is released', () => {
    document.body.style.overflow = 'scroll';
    lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('is a no-op when unlocking without a prior lock', () => {
    document.body.style.overflow = 'auto';
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('auto');
  });
});
