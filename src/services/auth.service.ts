import { ConsentState, IdentityPayload, PartnerSessionData } from '../models/types';
import { isBrandIntact } from '../utils/integrity';
import { isTokenExpired } from '../utils/token';

/**
 * Thrown when the partner session is blocked because the doctor profile is
 * incomplete (server `422 PROFILE_INCOMPLETE`). Carries the missing field names
 * so the host page can react via the `eoBlocked` event.
 */
export class ProfileIncompleteError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super('PROFILE_INCOMPLETE');
    this.name = 'ProfileIncompleteError';
    this.missing = missing;
  }
}

export class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  private identity: IdentityPayload | null = null;
  /**
   * Consent state from the last session response. Deliberately NOT cleared by
   * clearToken(): the state belongs to the doctor + terms version, not the
   * token, so reopening the drawer in the same page keeps gating until a new
   * session response (or markConsentAccepted) says otherwise.
   */
  private consent: ConsentState = { required: false };
  /** Shared promise while an auth round-trip is in flight — prevents duplicate session calls on concurrent callers. */
  private inFlightAuth: Promise<string> | null = null;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  // Static pure method (Functional Core) — delegates to token util
  static isTokenExpired = isTokenExpired;

  /**
   * Static pure method (Functional Core) — normalizes the optional `consent`
   * field of the session response. Absent or malformed (old server without
   * consent support) ⇒ `{ required: false }`, so the widget keeps working
   * against servers that predate the consent feature. `reconsent` is read the
   * same way: a server that does not send it yields `false`, i.e. the
   * first-acceptance copy.
   */
  static normalizeConsent(raw: unknown): ConsentState {
    if (!raw || typeof raw !== 'object') return { required: false };
    const c = raw as { required?: unknown; reconsent?: unknown; termsVersion?: unknown; comms?: unknown };
    return {
      required: c.required === true,
      reconsent: c.reconsent === true,
      termsVersion: typeof c.termsVersion === 'string' ? c.termsVersion : undefined,
      comms: typeof c.comms === 'boolean' ? c.comms : undefined,
    };
  }

  /** Set the identity the next auth round-trip will use (doctor data or a partner token). */
  setIdentity(identity: IdentityPayload): void {
    this.identity = identity;
  }

  /**
   * Resolve a partner session in a single call to `POST /partner/session`. The
   * server resolves the identity (client-provided or via the partner gateway),
   * upserts the doctor, and returns a session JWT. The legacy `/partner/register`
   * step is folded in server-side.
   *
   * @throws ProfileIncompleteError on `422` (blocked — doctor must finish registration)
   * @throws Error on any other non-ok response
   */
  async createSession(payload: IdentityPayload): Promise<PartnerSessionData> {
    // Brand-integrity short-circuit (L4b). Refuse to authenticate against the
    // EvidenceOne API if runtime verification of the logo/trigger label failed.
    if (!isBrandIntact()) {
      throw new Error('Brand integrity check failed — auth blocked');
    }

    // `lookup` is omitted from the JSON when undefined (JSON.stringify drops it).
    const body =
      'partnerToken' in payload
        ? { partnerToken: payload.partnerToken, lookup: payload.lookup }
        : { doctor: payload.doctor };

    const res = await fetch(`${this.apiUrl}/partner/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 422) {
      const parsed = (await res.json().catch(() => ({}))) as { error?: { missing?: string[] } };
      throw new ProfileIncompleteError(parsed.error?.missing ?? []);
    }

    if (!res.ok) {
      const parsed = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(typeof parsed.error === 'string' ? parsed.error : `Session failed: ${res.status}`);
    }

    const parsed = (await res.json()) as { data?: PartnerSessionData };
    const data = parsed.data;

    // Runtime validation — protect against a server returning an unexpected shape.
    if (!data || typeof data.sessionToken !== 'string' || typeof data.sessionId !== 'string') {
      throw new Error('Resposta de sessão inválida do servidor');
    }

    this.token = data.sessionToken;
    this.sessionId = data.sessionId;
    this.consent = AuthService.normalizeConsent(data.consent);
    return data;
  }

  async ensureValidToken(): Promise<string> {
    if (this.token && !isTokenExpired(this.token)) {
      return this.token;
    }
    // Coalesce concurrent callers onto the same auth promise.
    if (this.inFlightAuth) return this.inFlightAuth;

    this.inFlightAuth = this.doAuth().finally(() => {
      this.inFlightAuth = null;
    });
    return this.inFlightAuth;
  }

  private async doAuth(): Promise<string> {
    if (!this.identity) {
      throw new Error('Identidade não configurada');
    }
    const session = await this.createSession(this.identity);
    return session.sessionToken;
  }

  getToken(): string | null {
    return this.token;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  /** Consent state from the last session response ({ required: false } before any). */
  getConsent(): ConsentState {
    return this.consent;
  }

  /**
   * Marks consent as satisfied in memory after a successful
   * `POST /partner/consent` — the session is NOT re-resolved (spec §2.3).
   */
  markConsentAccepted(): void {
    this.consent = { ...this.consent, required: false };
  }

  /**
   * Flips consent back to required — used when chat enforcement reveals stale
   * local state (403 CONSENT_REQUIRED, spec §2.5), so the cached-token reopen
   * path keeps gating consistently with the server.
   */
  markConsentRequired(): void {
    this.consent = { ...this.consent, required: true };
  }

  /**
   * Clears the cached token and session id. Next call to `ensureValidToken`
   * will re-resolve the session. Used by:
   *   - the `newSession` prop / "Nova conversa" button
   *   - silent re-auth on 401 responses from the chat endpoint
   */
  clearToken(): void {
    this.token = null;
    this.sessionId = null;
  }
}
