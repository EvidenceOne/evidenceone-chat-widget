/**
 * Host pages sometimes ship an IE11-era CustomEvent polyfill that overrides
 * `window.CustomEvent` and forwards only bubbles/cancelable/detail — silently
 * dropping `composed`. Stencil's event emitter uses the global constructor, so
 * on such pages every internal widget event dies at the first shadow boundary
 * (observed in production at a partner: the consent "Continuar" click became a
 * silent no-op). This module restores spec-compliant behavior before the
 * widget emits anything.
 *
 * The repair only runs when the global is provably broken, and only restores
 * platform-spec behavior — a page cannot meaningfully depend on `composed`
 * being dropped.
 */

function customEventDropsComposed(): boolean {
  try {
    const probe = new CustomEvent('eo-composed-probe', { composed: true });
    return probe.composed !== true;
  } catch {
    return true;
  }
}

/**
 * Same-realm rebuild on top of `Event`, whose native constructor honors
 * `composed`. Preferred over an iframe-realm grab: no cross-realm event
 * objects, no lifetime questions after iframe removal.
 */
function buildEventBackedCustomEvent(): typeof CustomEvent {
  function EoCustomEvent<T>(type: string, params?: CustomEventInit<T>): CustomEvent<T> {
    const init = params ?? {};
    const evt = new Event(type, init) as CustomEvent<T>;
    Object.defineProperty(evt, 'detail', { value: init.detail ?? null, enumerable: true });
    return evt;
  }
  EoCustomEvent.prototype = Event.prototype;
  return EoCustomEvent as unknown as typeof CustomEvent;
}

/** Pull the pristine constructor out of a fresh same-origin iframe realm. */
function grabNativeCustomEventFromIframe(): typeof CustomEvent | undefined {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    (document.head ?? document.documentElement).appendChild(iframe);
    const native = iframe.contentWindow ? (iframe.contentWindow as Window & typeof globalThis).CustomEvent : undefined;
    iframe.remove();
    return native;
  } catch {
    return undefined;
  }
}

function eventConstructorHonorsComposed(): boolean {
  try {
    return new Event('eo-composed-probe', { composed: true }).composed === true;
  } catch {
    return false;
  }
}

/**
 * - `healthy`: the page's constructor honors `composed`; nothing was touched.
 * - `repaired`: a broken constructor was detected and replaced with a
 *   spec-compliant one.
 * - `unrepairable`: broken, and neither strategy worked in this environment —
 *   the page was left exactly as found; internal widget events may not work.
 */
export type CustomEventRepairOutcome = 'healthy' | 'repaired' | 'unrepairable';

export function repairHostCustomEvent(): CustomEventRepairOutcome {
  if (!customEventDropsComposed()) return 'healthy';

  if (eventConstructorHonorsComposed()) {
    window.CustomEvent = buildEventBackedCustomEvent();
    if (!customEventDropsComposed()) return 'repaired';
  }

  const native = grabNativeCustomEventFromIframe();
  if (native) {
    const previous = window.CustomEvent;
    window.CustomEvent = native;
    // Verify-or-rollback: in an environment where the grabbed constructor
    // doesn't actually work (e.g. a genuinely ancient engine the polyfill was
    // written for), restore what the page had — never leave it worse.
    if (!customEventDropsComposed()) return 'repaired';
    window.CustomEvent = previous;
  }

  return 'unrepairable';
}
