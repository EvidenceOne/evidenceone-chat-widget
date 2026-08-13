import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    markConsentRequired: vi.fn(),
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
  cmp.eoFeedback = { emit: vi.fn() } as unknown as typeof cmp.eoFeedback;
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

describe("blocked-screen retry ('Tentar novamente')", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function retry(cmp: EvidenceOneChat): void {
    (cmp as unknown as { handleRetry: () => void }).handleRetry();
  }

  it('still-incomplete client data re-blocks with eoBlocked — no server round-trip', async () => {
    const auth = makeAuthMock({ cachedToken: null, consent: { required: false } });
    const cmp = makeComponent(auth);
    cmp.partnerToken = undefined; // client_provided mode with missing doctor-* props
    cmp.authStatus = 'blocked';

    retry(cmp);
    expect(cmp.authStatus).toBe('loading'); // spinner hold before the re-check settles
    await vi.advanceTimersByTimeAsync(600);

    expect(cmp.authStatus).toBe('blocked');
    expect(cmp.eoBlocked.emit).toHaveBeenCalledWith({
      missing: ['email', 'name', 'crm', 'phone'],
    });
    // The generic error screen must NOT appear: incomplete data never
    // reaches the server (its shape validation is not a 422).
    expect(auth.ensureValidToken).not.toHaveBeenCalled();
    expect(cmp.eoError.emit).not.toHaveBeenCalled();
  });

  it('resolvable identity forces a fresh server re-auth (never a silent no-op)', async () => {
    const auth = makeAuthMock({ cachedToken: null, consent: { required: false } });
    const cmp = makeComponent(auth);
    cmp.authStatus = 'blocked';

    retry(cmp);
    await vi.advanceTimersByTimeAsync(600);

    expect(auth.clearToken).toHaveBeenCalled();
    expect(auth.ensureValidToken).toHaveBeenCalledOnce();
    expect(cmp.authStatus).toBe('ready');
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
    // Back to idle so eo-consent unmounts (its document-level focus trap must
    // not stay armed behind the closed drawer). The gate persists in
    // AuthService.consent — the reopen test below re-derives 'consent'.
    expect(cmp.authStatus).toBe('idle');
  });

  it('reopening after a dismissal re-enters consent from the stored state', async () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const cmp = makeComponent(auth);
    cmp.authStatus = 'consent';
    cmp.isOpen = true;

    close(cmp);
    await resolveSession(cmp);

    expect(cmp.authStatus).toBe('consent');
  });

  it('does NOT log a decline while an acceptance is in flight', () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const consent = makeConsentMock();
    const cmp = makeComponent(auth, consent);
    cmp.authStatus = 'consent';
    cmp.consentSaving = true;
    cmp.isOpen = true;

    close(cmp);

    expect(consent.decline).not.toHaveBeenCalled();
    expect(cmp.authStatus).toBe('idle');
    expect(cmp.eoClose.emit).toHaveBeenCalledOnce();
  });

  it('each consent presentation starts with clean error/saving flags', async () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: true } });
    const cmp = makeComponent(auth);
    // Stale flags from an earlier presentation (e.g. a late accept failure)
    cmp.consentError = true;
    cmp.consentSaving = true;

    await resolveSession(cmp);

    expect(cmp.authStatus).toBe('consent');
    expect(cmp.consentError).toBe(false);
    expect(cmp.consentSaving).toBe(false);
  });

  it("chat-side CONSENT_REQUIRED flips to 'consent' and syncs in-memory state — token untouched", () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: false } });
    const cmp = makeComponent(auth);
    cmp.authStatus = 'ready';

    (cmp as unknown as { handleConsentRequired: () => void }).handleConsentRequired();

    expect(cmp.authStatus).toBe('consent');
    expect(auth.markConsentRequired).toHaveBeenCalledOnce();
    expect(auth.clearToken).not.toHaveBeenCalled();
  });

  it('re-emits bubble votes as the public eoFeedback with the sessionId attached', () => {
    const auth = makeAuthMock({ cachedToken: futureJWT(), consent: { required: false } });
    const cmp = makeComponent(auth);

    cmp.onMessageFeedback(
      new CustomEvent('eoMessageFeedback', { detail: { messageIndex: 2, vote: 'down' } }),
    );

    expect(cmp.eoFeedback.emit).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'sid_test',
      messageIndex: 2,
      vote: 'down',
    });
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
