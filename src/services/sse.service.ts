import { SSEEvent } from '../models/types';

export class SSEService {
  /**
   * Parses a single SSE line into an event.
   * Returns null for non-data lines, empty lines, and malformed JSON.
   */
  static parseLine(line: string): SSEEvent | null {
    if (!line.startsWith('data:')) return null;
    // Handle both "data: " (with space) and "data:" (without)
    const raw = line.slice(5).trim();
    if (!raw) return null;
    if (raw === '[DONE]') return { type: 'end' };
    try {
      return JSON.parse(raw) as SSEEvent;
    } catch {
      return null;
    }
  }

  /**
   * Async generator that reads a ReadableStream<Uint8Array> and yields SSEEvents.
   * Buffers partial lines across chunk boundaries.
   *
   * When `signal` is provided and aborted, the in-flight reader is canceled
   * and the generator returns cleanly.
   */
  static async *streamEvents(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<SSEEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // If the signal aborts while we're mid-read, cancel the reader so
    // the pending `reader.read()` promise resolves immediately.
    const onAbort = () => {
      reader.cancel().catch(() => {
        /* reader may already be released — swallow */
      });
    };
    signal?.addEventListener('abort', onAbort);

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = SSEService.parseLine(line.trim());
          if (event) yield event;
        }
      }

      // Flush any remaining content in the buffer (only if not aborted)
      if (!signal?.aborted && buffer.trim()) {
        const event = SSEService.parseLine(buffer.trim());
        if (event) yield event;
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      try {
        reader.releaseLock();
      } catch {
        /* already released via cancel() */
      }
    }
  }
}
