import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, ProfileIncompleteError } from './auth.service';
import { DoctorData } from '../models/types';

// Helper — builds a JWT with a given exp claim
function makeJWT(exp: number): string {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

const mockDoctor: DoctorData = {
  email: 'joao@hospital.com',
  name: 'Dr. João',
  crm: '123456/SP',
  phone: '11999999999',
};

// NestJS ApiResponse envelope for a resolved partner session (201).
function sessionOk(token: string, sid = 'sid_123'): Response {
  return {
    ok: true,
    status: 201,
    json: async () => ({ data: { sessionToken: token, sessionId: sid, expiresIn: 3600 } }),
  } as Response;
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService('https://api.test.com', 'key_test');
    service.setIdentity({ doctor: mockDoctor });
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('posts { doctor } to /partner/session and stores token + sessionId from the data envelope', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sessionOk(token));

      const result = await service.createSession({ doctor: mockDoctor });

      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.com/partner/session');
      expect((opts!.headers as Record<string, string>)['X-API-Key']).toBe('key_test');
      expect(JSON.parse(opts!.body as string)).toEqual({ doctor: mockDoctor });
      expect(result.sessionToken).toBe(token);
      expect(service.getToken()).toBe(token);
      expect(service.getSessionId()).toBe('sid_123');
    });

    it('posts { partnerToken } in gateway mode', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sessionOk(token));

      await service.createSession({ partnerToken: 'opaque-token' });

      expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({ partnerToken: 'opaque-token' });
    });

    it('throws ProfileIncompleteError with the missing fields on 422', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: { code: 'PROFILE_INCOMPLETE', missing: ['crm', 'phone'] } }),
      } as Response);

      await expect(service.createSession({ doctor: mockDoctor })).rejects.toBeInstanceOf(ProfileIncompleteError);
      await expect(service.createSession({ doctor: mockDoctor })).rejects.toMatchObject({ missing: ['crm', 'phone'] });
    });

    it('throws the server error string on other non-ok responses (e.g. 429)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Partner daily query limit exceeded' }),
      } as Response);

      await expect(service.createSession({ doctor: mockDoctor })).rejects.toThrow('Partner daily query limit exceeded');
    });

    it('throws on an invalid data shape (missing sessionToken)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ data: { sessionId: 'sid', expiresIn: 3600 } }),
      } as Response);

      await expect(service.createSession({ doctor: mockDoctor })).rejects.toThrow('Resposta de sessão inválida');
    });
  });

  describe('ensureValidToken', () => {
    it('authenticates in a single round-trip (no /partner/register)', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sessionOk(token));

      const result = await service.ensureValidToken();

      expect(result).toBe(token);
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.test.com/partner/session');
    });

    it('returns the cached token when still valid (no extra fetch)', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sessionOk(token));

      await service.ensureValidToken();
      await service.ensureValidToken();

      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('coalesces concurrent callers onto one round-trip', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sessionOk(token));

      const [t1, t2, t3] = await Promise.all([
        service.ensureValidToken(),
        service.ensureValidToken(),
        service.ensureValidToken(),
      ]);

      expect([t1, t2, t3]).toEqual([token, token, token]);
      expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('clears the in-flight promise after a failure so retries work', async () => {
      const token = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'server down' }) } as Response)
        .mockResolvedValueOnce(sessionOk(token));

      await expect(service.ensureValidToken()).rejects.toThrow('server down');
      const fresh = await service.ensureValidToken();
      expect(fresh).toBe(token);
    });

    it('re-authenticates when the cached token is expired', async () => {
      const expired = makeJWT(0);
      const fresh = makeJWT(Math.floor(Date.now() / 1000) + 3600);
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(sessionOk(expired, 'sid1'))
        .mockResolvedValueOnce(sessionOk(fresh, 'sid2'));

      await service.ensureValidToken();
      const result = await service.ensureValidToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toBe(fresh);
    });

    it('propagates ProfileIncompleteError (blocked) to the caller', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: { code: 'PROFILE_INCOMPLETE', missing: ['gateway_unavailable'] } }),
      } as Response);

      await expect(service.ensureValidToken()).rejects.toBeInstanceOf(ProfileIncompleteError);
    });
  });
});
