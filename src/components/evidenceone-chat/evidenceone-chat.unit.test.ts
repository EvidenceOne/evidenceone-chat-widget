import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Stencil decorators are compile-time constructs the vitest transform
// executes at runtime — stub them as no-ops so the component class can be
// instantiated as a plain TS class (no rendering happens in these tests).
vi.mock('@stencil/core', () => {
  const noopDecorator = () => () => undefined;
  return {
    Component: noopDecorator,
    Prop: noopDecorator,
    State: noopDecorator,
    Event: noopDecorator,
    Element: noopDecorator,
    Watch: noopDecorator,
    Method: noopDecorator,
    Listen: noopDecorator,
    Host: () => null,
    h: () => null,
    Fragment: () => null,
  };
});

import { ConsentState } from '../../models/types';
import { EvidenceOneChat } from './evidenceone-chat';

// Helper — builds a JWT with a given exp claim (real shape so the static
// AuthService.isTokenExpired check in resolveSession works unmocked)
function makeJWT(exp: number): string {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

const futureJWT = () => makeJWT(Math.floor(Date.now() / 1000) + 3600);

function makeAuthMock(opts: { cachedToken: string | null; consent: ConsentState }) {
  return {
    getToken: vi.fn(() => opts.cachedToken),
    getConsent: vi.fn(() => opts.consent),
    setIdentity: vi.fn(),
    ensureValidToken: vi.fn(async () => 'fresh-token'),
    getSessionId: vi.fn(() => 'sid_test'),
    clearToken: vi.fn(),
    markConsentAccepted: vi.fn(),
  };
}

function makeConsentMock(opts: { acceptFails?: boolean } = {}) {
  return {
    accept: vi.fn(async () => {
      if (opts.acceptFails) throw new Error('network down');
    }),
    decline: vi.fn(),
  };
}

/**
 * Instantiates the component class directly (no rendering) with a mocked
 * AuthService and stubbed emitters — resolveSession/attemptAuth are plain
 * methods, so the consent gate on both auth paths is unit-testable.
 */
function makeComponent(
  auth: ReturnType<typeof makeAuthMock>,
  consent?: ReturnType<typeof makeConsentMock>,
) {
  const cmp = new EvidenceOneChat();
  // partner_gateway mode bypasses the client_provided completeness pre-flight
  cmp.partnerToken = 'opaque-partner-token';
  (cmp as unknown as { authService: unknown }).authService = auth;
  (cmp as unknown as { consentService: unknown }).consentService = consent ?? makeConsentMock();
  cmp.eoReady = { emit: vi.fn() } as unknown as typeof cmp.eoReady;
  cmp.eoBlocked = { emit: vi.fn() } as unknown as typeof cmp.eoBlocked;
  cmp.eoError = { emit: vi.fn() } as unknown as typeof cmp.eoError;
  cmp.eoClose = { emit: vi.fn() } as unknown as typeof cmp.eoClose;
  return cmp;
}

async function resolveSession(cmp: EvidenceOneChat): Promise<void> {
  await (cmp as unknown as { resolveSession: () => Promise<void> }).resolveSession();
}

describe('consent gate in resolveSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fresh-auth path (no cached token)', () => {
    it("lands on 'consent' when the session says consent is required — without emitting eoReady", async () => {
      const auth = makeAuthMock({ cachedToken: null, consent: { required: true } });
      const cmp = makeComponent(auth);

      await resolveSession(cmp);

      expect(auth.ensureValidToken).toHaveBeenCalledOnce();
      expect(cmp.authStatus).toBe('consent');
      expect(cmp.eoReady.emit).not.toHaveBeenCalled();
    });

    it("lands on 'ready' and emits eoReady when consent is not required", async () => {
      const auth = makeAuthMock({ cachedToken: null, consent: { required: false } });
      const cmp = makeComponent(auth);

      await resolveSession(cmp);

      expect(cmp.authStatus).toBe('ready');
      expect(cmp.eoReady.emit).toHaveBeenCalledWith({ sessionId: 'sid_test' });
    });
  });

  describe('cached-token path (drawer reopen)', () => {
    it("lands on 'consent' from the stored consent state — no re-auth, no eoReady", async () => {
      const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
      const cmp = makeComponent(auth);

      await resolveSession(cmp);

      expect(auth.ensureValidToken).not.toHaveBeenCalled();
      expect(cmp.authStatus).toBe('consent');
      expect(cmp.eoReady.emit).not.toHaveBeenCalled();
    });

    it("lands on 'ready' when the stored consent is satisfied", async () => {
      const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: false } });
      const cmp = makeComponent(auth);

      await resolveSession(cmp);

      expect(auth.ensureValidToken).not.toHaveBeenCalled();
      expect(cmp.authStatus).toBe('ready');
    });
  });
});

describe('consent accept/decline wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function accept(cmp: EvidenceOneChat, comms: boolean): Promise<void> {
    await (cmp as unknown as { handleConsentAccept: (comms: boolean) => Promise<void> })
      .handleConsentAccept(comms);
  }

  function close(cmp: EvidenceOneChat): void {
    (cmp as unknown as { handleDrawerClose: () => void }).handleDrawerClose();
  }

  it("accept: awaits the service, marks in-memory consent, lands on 'ready' and emits eoReady", async () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const consent = makeConsentMock();
    const cmp = makeComponent(auth, consent);
    cmp.authStatus = 'consent';

    await accept(cmp, true);

    expect(consent.accept).toHaveBeenCalledWith(auth.getToken(), true);
    expect(auth.markConsentAccepted).toHaveBeenCalledOnce();
    expect(cmp.authStatus).toBe('ready');
    expect(cmp.eoReady.emit).toHaveBeenCalledWith({ sessionId: 'sid_test' });
    expect(cmp.consentSaving).toBe(false);
  });

  it('accept failure: keeps the modal (still consent), flags the error banner, no eoReady', async () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const consent = makeConsentMock({ acceptFails: true });
    const cmp = makeComponent(auth, consent);
    cmp.authStatus = 'consent';

    await accept(cmp, false);

    expect(cmp.authStatus).toBe('consent');
    expect(cmp.consentError).toBe(true);
    expect(cmp.eoReady.emit).not.toHaveBeenCalled();
    expect(auth.markConsentAccepted).not.toHaveBeenCalled();
    expect(cmp.consentSaving).toBe(false);
  });

  it('closing the drawer during consent declines fire-and-forget and emits eoClose', () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const consent = makeConsentMock();
    const cmp = makeComponent(auth, consent);
    cmp.authStatus = 'consent';
    cmp.isOpen = true;

    close(cmp);

    expect(consent.decline).toHaveBeenCalledWith(auth.getToken());
    expect(cmp.isOpen).toBe(false);
    expect(cmp.eoClose.emit).toHaveBeenCalledOnce();
    // Status stays 'consent' — reopening on the same page shows the modal again
    expect(cmp.authStatus).toBe('consent');
  });

  it('closing the drawer outside consent does NOT log a decline', () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: false } });
    const consent = makeConsentMock();
    const cmp = makeComponent(auth, consent);
    cmp.authStatus = 'ready';
    cmp.isOpen = true;

    close(cmp);

    expect(consent.decline).not.toHaveBeenCalled();
    expect(cmp.eoClose.emit).toHaveBeenCalledOnce();
  });
});
