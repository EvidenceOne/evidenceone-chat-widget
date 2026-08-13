import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let service: ConsentService;

  beforeEach(() => {
    service = new ConsentService('https://api.test.com');
    vi.restoreAllMocks();
  });

  describe('accept', () => {
    it('posts the accepted action with the bearer token and resolves on 201', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      } as Response);

      await service.accept('tok_abc', true);

      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.com/partner/consent');
      expect(opts!.method).toBe('POST');
      expect((opts!.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_abc');
      expect(JSON.parse(opts!.body as string)).toEqual({
        action: 'accepted',
        termsAccepted: true,
        commsAccepted: true,
      });
    });

    it('sends commsAccepted: false when the optional checkbox is unchecked', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      } as Response);

      await service.accept('tok_abc', false);

      expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({
        action: 'accepted',
        termsAccepted: true,
        commsAccepted: false,
      });
    });

    it('throws on a non-ok response — the chat must NOT be released', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'boom' }),
      } as Response);

      await expect(service.accept('tok_abc', false)).rejects.toThrow();
    });

    it('propagates network failures to the caller', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(service.accept('tok_abc', true)).rejects.toThrow('Failed to fetch');
    });
  });

  describe('decline', () => {
    it('posts the declined action with the bearer token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({}),
      } as Response);

      service.decline('tok_abc');
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());

      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.com/partner/consent');
      expect((opts!.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_abc');
      expect(JSON.parse(opts!.body as string)).toEqual({
        action: 'declined',
        termsAccepted: false,
        commsAccepted: false,
      });
    });

    it('is fire-and-forget — a network failure never throws or rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      expect(() => service.decline('tok_abc')).not.toThrow();
      // Flush microtasks — an unhandled rejection here would fail the suite.
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });
});
