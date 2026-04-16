import { DoctorData, SessionResponse } from '../models/types';
import { isTokenExpired } from '../utils/token';

export class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  /** Shared promise while an auth round-trip is in flight — prevents duplicate register+session calls on concurrent callers. */
  private inFlightAuth: Promise<string> | null = null;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  // Static pure method (Functional Core) — delegates to token util
  static isTokenExpired = isTokenExpired;

  async register(doctor: DoctorData): Promise<void> {
    const res = await fetch(`${this.apiUrl}/partner/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        email: doctor.email,
        name: doctor.name,
        crm: doctor.crm,
        phone: doctor.phone,
        ...(doctor.specialty && { specialty: doctor.specialty }),
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `Register failed: ${res.status}`);
    }
  }

  async createSession(crm: string): Promise<SessionResponse> {
    const res = await fetch(`${this.apiUrl}/partner/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ crm }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `Session failed: ${res.status}`);
    }

    const data = (await res.json()) as SessionResponse;

    // Runtime validation — protect against a server returning an unexpected shape.
    if (
      !data ||
      typeof data.session_token !== 'string' ||
      typeof data.session_id !== 'string'
    ) {
      throw new Error('Resposta de sessão inválida do servidor');
    }

    this.token = data.session_token;
    this.sessionId = data.session_id;
    return data;
  }

  async ensureValidToken(doctor: DoctorData): Promise<string> {
    if (this.token && !isTokenExpired(this.token)) {
      return this.token;
    }
    // Coalesce concurrent callers onto the same auth promise.
    if (this.inFlightAuth) return this.inFlightAuth;

    this.inFlightAuth = this.doAuth(doctor).finally(() => {
      this.inFlightAuth = null;
    });
    return this.inFlightAuth;
  }

  private async doAuth(doctor: DoctorData): Promise<string> {
    await this.register(doctor);
    const session = await this.createSession(doctor.crm);
    return session.session_token;
  }

  getToken(): string | null {
    return this.token;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Clears the cached token and session id. Next call to `ensureValidToken`
   * will re-register and re-session. Used by:
   *   - the `newSession` prop / "Nova conversa" button
   *   - silent re-auth on 401 responses from the chat endpoint
   */
  clearToken(): void {
    this.token = null;
    this.sessionId = null;
  }
}
