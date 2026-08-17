import { afterEach, describe, expect, it } from 'vitest';
import { repairHostCustomEvent } from './custom-event-repair';

const NativeCustomEvent = window.CustomEvent;

/** The exact IE11-era polyfill observed on the partner page (drops `composed`). */
function installLegacyPolyfill() {
  function CustomEventPolyfill(event: string, params?: CustomEventInit) {
    const p = params || { bubbles: false, cancelable: false, detail: undefined };
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, p.bubbles ?? false, p.cancelable ?? false, p.detail);
    return evt;
  }
  CustomEventPolyfill.prototype = window.Event.prototype;
  window.CustomEvent = CustomEventPolyfill as unknown as typeof CustomEvent;
}

afterEach(() => {
  window.CustomEvent = NativeCustomEvent;
});

describe('repairHostCustomEvent', () => {
  it('leaves a healthy native constructor untouched and reports healthy', () => {
    expect(repairHostCustomEvent()).toBe('healthy');
    expect(window.CustomEvent).toBe(NativeCustomEvent);
  });

  it('restores composed support when the legacy polyfill is installed', () => {
    installLegacyPolyfill();
    expect(new CustomEvent('probe', { composed: true }).composed).toBe(false);

    expect(repairHostCustomEvent()).toBe('repaired');

    const evt = new CustomEvent('probe', { composed: true, bubbles: true, detail: { comms: true } });
    expect(evt.composed).toBe(true);
    expect(evt.bubbles).toBe(true);
    expect(evt.detail).toEqual({ comms: true });
  });

  it('repaired events cross an open shadow boundary', () => {
    installLegacyPolyfill();
    repairHostCustomEvent();

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    shadow.appendChild(inner);
    document.body.appendChild(host);

    let received: unknown = null;
    host.addEventListener('eoProbe', (e) => (received = (e as CustomEvent).detail));
    inner.dispatchEvent(new CustomEvent('eoProbe', { bubbles: true, composed: true, detail: 'crossed' }));

    document.body.removeChild(host);
    expect(received).toBe('crossed');
  });
});

describe('bundle init warning (global script)', () => {
  it('emits eoEnvironmentWarning on document when repaired, without console noise', async () => {
    const { default: runGlobal, ENVIRONMENT_WARNING_EVENT } = await import('../global/app');
    installLegacyPolyfill();

    const warnings: string[] = [];
    const warnSpy = console.warn;
    console.warn = (msg: string) => warnings.push(msg);
    let detail: { issue: string; outcome: string } | null = null;
    const onWarning = (e: Event) => (detail = (e as CustomEvent).detail);
    document.addEventListener(ENVIRONMENT_WARNING_EVENT, onWarning);

    try {
      runGlobal();
    } finally {
      console.warn = warnSpy;
      document.removeEventListener(ENVIRONMENT_WARNING_EVENT, onWarning);
    }

    expect(detail).toEqual({ issue: 'legacy-customevent-polyfill', outcome: 'repaired' });
    // console.warn is reserved for the unrepairable case (partner action needed).
    expect(warnings).toEqual([]);
  });

  it('stays silent on a healthy page', async () => {
    const { default: runGlobal } = await import('../global/app');
    const warnings: string[] = [];
    const warnSpy = console.warn;
    console.warn = (msg: string) => warnings.push(msg);

    try {
      runGlobal();
    } finally {
      console.warn = warnSpy;
    }

    expect(warnings).toEqual([]);
  });
});
