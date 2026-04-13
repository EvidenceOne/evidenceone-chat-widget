import { SSEEvent } from '../models/types';
import { SSEService } from './sse.service';

export class ChatService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Sends a message to the chat endpoint and yields SSEEvents from the stream.
   * Mode is hardcoded to 'case_br' — partners cannot change this.
   */
  async *sendMessage(token: string, message: string): AsyncGenerator<SSEEvent> {
    const res = await fetch(`${this.apiUrl}/partner/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, mode: 'case_br' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message || `Chat failed: ${res.status}`);
    }

    if (!res.body) throw new Error('No response body');

    yield* SSEService.streamEvents(res.body);
  }
}
