import { DoctorData, SessionResponse } from '../models/types';
import { isTokenExpired } from '../utils/token';

export class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private sessionId: string | null = null;

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
      const err = await res.json().catch(() => ({})) as { message?: string };
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
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message || `Session failed: ${res.status}`);
    }

    const data = await res.json() as SessionResponse;
    this.token = data.session_token;
    this.sessionId = data.session_id;
    return data;
  }

  async ensureValidToken(doctor: DoctorData): Promise<string> {
    if (this.token && !isTokenExpired(this.token)) {
      return this.token;
    }
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
}
