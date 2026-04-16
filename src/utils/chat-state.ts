import { Message, SSEEvent } from '../models/types';

/**
 * Pure function — Functional Core.
 * Applies an SSE event to the current messages array, producing a new array.
 * Only the target assistant message is modified.
 */
export function applySSEEvent(
  messages: Message[],
  assistantId: string,
  event: SSEEvent,
): Message[] {
  switch (event.type) {
    case 'token': {
      const chunk = event.data ?? '';
      if (!chunk) return messages;
      return messages.map(m =>
        m.id === assistantId ? { ...m, content: m.content + chunk } : m,
      );
    }

    case 'content':
      return messages.map(m =>
        m.id === assistantId ? { ...m, content: event.data ?? m.content } : m,
      );

    case 'final_response':
      return messages.map(m =>
        m.id === assistantId
          ? { ...m, content: event.data ?? m.content, isStreaming: false }
          : m,
      );

    case 'error':
      return messages.map(m =>
        m.id === assistantId
          ? {
              ...m,
              content: m.content || 'Erro ao processar resposta.',
              isStreaming: false,
            }
          : m,
      );

    case 'done':
      return messages.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m,
      );

    case 'progress':
    default:
      return messages;
  }
}
