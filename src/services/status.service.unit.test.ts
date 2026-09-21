import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiUnreachableError, MaintenanceError, StatusService } from './status.service';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new StatusService('https://api.test/v1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStatus', () => {
    it('asks GET {apiUrl}/status without credentials and reads the envelope', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, { data: { maintenance: true, since: '2026-09-18T13:02:11.000Z', source: 'manual' } }));

      await expect(service.getStatus()).resolves.toEqual({ maintenance: true });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test/v1/status');
      expect((init as RequestInit).headers).toBeUndefined();
    });

    it('reads the operational state', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { data: { maintenance: false, since: null, source: null } }));

      await expect(service.getStatus()).resolves.toEqual({ maintenance: false });
    });

    it('rejects on a non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(503, {}));

      await expect(service.getStatus()).rejects.toThrow();
    });

    it('rejects when the body is not the status envelope (e.g. a proxy page)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      } as unknown as Response);

      await expect(service.getStatus()).rejects.toThrow();
    });

    it('propagates a network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(service.getStatus()).rejects.toThrow(TypeError);
    });

    it('gives up after 8 seconds, so a hanging request still counts as a failed check', async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            (init as RequestInit).signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      );

      const pending = service.getStatus();
      const assertion = expect(pending).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(8_000);

      await assertion;
    });
  });

  describe('isMaintenanceBody', () => {
    it('recognizes the body of a request blocked by maintenance', () => {
      expect(StatusService.isMaintenanceBody({ error: 'MAINTENANCE' })).toBe(true);
    });

    it('is false for any other error body, so an ordinary 503 stays an ordinary error', () => {
      expect(StatusService.isMaintenanceBody({ error: 'Queue service unavailable' })).toBe(false);
      expect(StatusService.isMaintenanceBody({ error: { code: 'MAINTENANCE' } })).toBe(false);
      expect(StatusService.isMaintenanceBody({})).toBe(false);
      expect(StatusService.isMaintenanceBody(null)).toBe(false);
    });
  });

  describe('failureOf', () => {
    it('is a MaintenanceError for the maintenance body', () => {
      expect(StatusService.failureOf(503, { error: 'MAINTENANCE' })).toBeInstanceOf(MaintenanceError);
    });

    it('is an ApiUnreachableError for a 5xx the API itself did not write (proxy page, empty body)', () => {
      expect(StatusService.failureOf(502, {})).toBeInstanceOf(ApiUnreachableError);
      expect(StatusService.failureOf(503, {})).toBeInstanceOf(ApiUnreachableError);
    });

    it('is null for anything the API answered on its own — callers keep their ordinary error', () => {
      expect(StatusService.failureOf(503, { error: 'Queue service unavailable' })).toBeNull();
      expect(StatusService.failureOf(500, { message: 'server down' })).toBeNull();
      expect(StatusService.failureOf(429, { error: 'Daily limit reached' })).toBeNull();
      expect(StatusService.failureOf(400, {})).toBeNull();
    });
  });

  describe('isUnreachable', () => {
    it('is true for a network failure and for an ApiUnreachableError', () => {
      expect(StatusService.isUnreachable(new TypeError('Failed to fetch'))).toBe(true);
      expect(StatusService.isUnreachable(new ApiUnreachableError(502))).toBe(true);
    });

    it('is false for ordinary errors', () => {
      expect(StatusService.isUnreachable(new Error('Session failed: 400'))).toBe(false);
      expect(StatusService.isUnreachable(new MaintenanceError())).toBe(false);
    });
  });
});
