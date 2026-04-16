import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService('https://api.test.com', 'key_test');
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('calls POST /partner/register with X-API-Key and doctor data', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await service.register(mockDoctor);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.com/partner/register');
      expect((opts!.headers as Record<string, string>)['X-API-Key']).toBe('key_test');
      const body = JSON.parse(opts!.body as string);
      expect(body.email).toBe(mockDoctor.email);
      expect(body.crm).toBe(mockDoctor.crm);
    });

    it('throws with server message on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Chave inválida' }),
      } as Response);

      await expect(service.register(mockDoctor)).rejects.toThrow('Chave inválida');
    });

    it('throws generic message when server returns no body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new Error('no body'); },
      } as unknown as Response);

      await expect(service.register(mockDoctor)).rejects.toThrow('Register failed: 500');
    });

    it('omits specialty when not provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await service.register(mockDoctor);
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.specialty).toBeUndefined();
    });

    it('includes specialty when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await service.register({ ...mockDoctor, specialty: 'Cardiologia' });
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.specialty).toBe('Cardiologia');
    });
  });

  describe('createSession', () => {
    it('calls POST /partner/session and stores token and sessionId', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJWT(exp);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ session_token: token, session_id: 'sid_123', expires_in: 3600 }),
      } as Response);

      const result = await service.createSession('123456/SP');

      expect(result.session_token).toBe(token);
      expect(result.session_id).toBe('sid_123');
      expect(service.getToken()).toBe(token);
      expect(service.getSessionId()).toBe('sid_123');
    });

    it('throws with server message on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'CRM não encontrado' }),
      } as Response);

      await expect(service.createSession('123456/SP')).rejects.toThrow('CRM não encontrado');
    });
  });

  describe('ensureValidToken', () => {
    it('returns cached token when still valid (no additional fetch calls)', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJWT(exp);

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) // register
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: token, session_id: 'sid', expires_in: 3600 }),
        } as Response); // session

      await service.ensureValidToken(mockDoctor); // first call — fetches
      const callsAfterFirst = fetchSpy.mock.calls.length;

      const result = await service.ensureValidToken(mockDoctor); // second call — should use cache
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst); // no new fetch calls
      expect(result).toBe(token);
    });

    it('coalesces concurrent callers onto one register + session round-trip', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJWT(exp);

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) // register
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: token, session_id: 'sid', expires_in: 3600 }),
        } as Response); // session

      // Three concurrent callers
      const [t1, t2, t3] = await Promise.all([
        service.ensureValidToken(mockDoctor),
        service.ensureValidToken(mockDoctor),
        service.ensureValidToken(mockDoctor),
      ]);

      expect(t1).toBe(token);
      expect(t2).toBe(token);
      expect(t3).toBe(token);
      // Only ONE register + ONE session, not three
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throws on invalid session response shape (missing token)', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_id: 'sid', expires_in: 3600 }), // no session_token
        } as Response);

      await expect(service.ensureValidToken(mockDoctor)).rejects.toThrow(
        'Resposta de sessão inválida',
      );
    });

    it('clears the in-flight promise after a failed round-trip so retries work', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJWT(exp);

      vi.spyOn(globalThis, 'fetch')
        // First attempt: register OK, session 500
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'server down' }),
        } as Response)
        // Second attempt: both OK
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: token, session_id: 'sid', expires_in: 3600 }),
        } as Response);

      await expect(service.ensureValidToken(mockDoctor)).rejects.toThrow('server down');
      // After failure, a subsequent call should actually retry (not be blocked by a stuck inFlight promise)
      const fresh = await service.ensureValidToken(mockDoctor);
      expect(fresh).toBe(token);
    });

    it('re-authenticates when token is expired', async () => {
      const expiredToken = makeJWT(0); // already expired
      const freshToken = makeJWT(Math.floor(Date.now() / 1000) + 3600);

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) // register #1
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: expiredToken, session_id: 'sid1', expires_in: 0 }),
        } as Response) // session #1 → expired
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response) // register #2
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: freshToken, session_id: 'sid2', expires_in: 3600 }),
        } as Response); // session #2

      await service.ensureValidToken(mockDoctor); // gets expired token
      const result = await service.ensureValidToken(mockDoctor); // re-auths

      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(result).toBe(freshToken);
    });
  });
});
