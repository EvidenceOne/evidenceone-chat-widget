import { SSEEvent } from '../models/types';
import { SSEService } from './sse.service';

/**
 * Thrown when the chat endpoint rejects the session token (401/403).
 * `<eo-chat>` catches this specifically to trigger a silent one-shot re-auth
 * instead of surfacing a generic error to the user.
 */
export class TokenRejectedError extends Error {
  constructor(message = 'Token rejeitado pelo servidor') {
    super(message);
    this.name = 'TokenRejectedError';
  }
}

export class ChatService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Sends a message to the chat endpoint and yields SSEEvents from the stream.
   * Mode is hardcoded to 'case_br' — partners cannot change this.
   * Pass an AbortSignal to cancel an in-flight stream (e.g. on drawer close).
   *
   * @throws TokenRejectedError if the server returns 401/403 — caller should re-auth and retry once.
   * @throws Error for any other non-ok response or network failure.
   */
  async *sendMessage(
    token: string,
    message: string,
    signal?: AbortSignal,
  ): AsyncGenerator<SSEEvent> {
    const res = await fetch(`${this.apiUrl}/partner/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, mode: 'case_br' }),
      signal,
    });

    if (res.status === 401 || res.status === 403) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new TokenRejectedError(err.message || 'Token rejeitado');
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `Chat failed: ${res.status}`);
    }

    if (!res.body) throw new Error('Resposta sem corpo');

    yield* SSEService.streamEvents(res.body, signal);
  }
}
