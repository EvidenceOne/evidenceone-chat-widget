import { AuthStatus, ChatStatus, Message, SSEEvent } from '../models/types';

/**
 * Pure function — Functional Core.
 * Applies an SSE event to the current messages array, producing a new array.
 * Only the target assistant message is modified.
 *
 * Event types come from the Agent contract:
 *   delta         — append incremental text chunk (event.content)
 *   error         — stop streaming + surface error in bubble
 *   end           — stop streaming cleanly
 *   status        — observational, ignored
 *   metrics       — observational, ignored
 *   visual_result — not rendered by this widget, ignored
 */
export function applySSEEvent(
  messages: Message[],
  assistantId: string,
  event: SSEEvent,
): Message[] {
  switch (event.type) {
    case 'delta': {
      const chunk = event.content ?? '';
      if (!chunk) return messages;
      return messages.map(m =>
        m.id === assistantId ? { ...m, content: m.content + chunk } : m,
      );
    }

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

    case 'end':
      return messages.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m,
      );

    case 'status':
    case 'metrics':
    case 'visual_result':
    default:
      return messages;
  }
}

/**
 * Pure function — Functional Core.
 * The input is locked while a message is in flight and on every auth state
 * where the chat is not usable ('consent' included — the opt-in screen gates
 * the chat). 'idle' keeps the input enabled so the empty state doesn't flash
 * disabled before auth starts.
 */
export function isInputDisabled(chatStatus: ChatStatus, authStatus: AuthStatus): boolean {
  return (
    chatStatus === 'streaming' ||
    chatStatus === 'loading' ||
    authStatus === 'loading' ||
    authStatus === 'error' ||
    authStatus === 'blocked' ||
    authStatus === 'consent'
  );
}

/**
 * Pure function — Functional Core.
 * "Nova conversa" is offered only while the chat is usable — never from
 * blocked/error/consent, which would be an escape hatch around those gates.
 */
export function canStartNewSession(authStatus: AuthStatus): boolean {
  return authStatus === 'ready';
}
