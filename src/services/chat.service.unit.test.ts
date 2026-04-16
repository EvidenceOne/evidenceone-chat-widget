import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService, TokenRejectedError } from './chat.service';

function makeStreamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return { ok: true, body } as unknown as Response;
}

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService('https://api.test.com');
    vi.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('POSTs to /partner/chat with Authorization header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(makeStreamResponse(['data: [DONE]\n\n']));

      const gen = service.sendMessage('tok_abc', 'olá');
      for await (const _event of gen) {
        /* drain */
      }

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.test.com/partner/chat');
      expect(opts!.method).toBe('POST');
      const headers = opts!.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer tok_abc');
    });

    it('hardcodes mode "case_br" in the request body', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(makeStreamResponse(['data: [DONE]\n\n']));

      const gen = service.sendMessage('tok', 'qualquer');
      for await (const _event of gen) {
        /* drain */
      }

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body.mode).toBe('case_br');
      expect(body.message).toBe('qualquer');
    });

    it('passes AbortSignal through to fetch', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(makeStreamResponse(['data: [DONE]\n\n']));

      const ctrl = new AbortController();
      const gen = service.sendMessage('tok', 'hi', ctrl.signal);
      for await (const _event of gen) {
        /* drain */
      }

      expect(fetchSpy.mock.calls[0][1]!.signal).toBe(ctrl.signal);
    });

    it('throws TokenRejectedError on HTTP 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Token expirado' }),
      } as Response);

      const gen = service.sendMessage('tok', 'hi');
      await expect(gen.next()).rejects.toBeInstanceOf(TokenRejectedError);
    });

    it('throws TokenRejectedError on HTTP 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      } as Response);

      const gen = service.sendMessage('tok', 'hi');
      await expect(gen.next()).rejects.toBeInstanceOf(TokenRejectedError);
    });

    it('throws generic Error for other non-ok responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'server down' }),
      } as Response);

      const gen = service.sendMessage('tok', 'hi');
      await expect(gen.next()).rejects.toThrow('server down');
      // Not a TokenRejectedError — caller should NOT silent-retry on 500
      try {
        const gen2 = service.sendMessage('tok', 'hi');
        await gen2.next();
      } catch (err) {
        expect(err).not.toBeInstanceOf(TokenRejectedError);
      }
    });

    it('throws when response body is null', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
      } as Response);

      const gen = service.sendMessage('tok', 'hi');
      await expect(gen.next()).rejects.toThrow('Resposta sem corpo');
    });

    it('yields SSE events parsed from the stream', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeStreamResponse([
          'data: {"type":"token","data":"olá"}\n\n',
          'data: {"type":"token","data":" mundo"}\n\n',
          'data: [DONE]\n\n',
        ]),
      );

      const events = [];
      for await (const event of service.sendMessage('tok', 'hi')) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'token', data: 'olá' },
        { type: 'token', data: ' mundo' },
        { type: 'done' },
      ]);
    });
  });
});
