import { AuthStatus, ChatStatus, Message, MessageSource, SSEEvent } from '../models/types';

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

    case 'sources': {
      const sources = extractSources(event);
      if (sources.length === 0) return messages;
      return messages.map(m => (m.id === assistantId ? { ...m, sources } : m));
    }

    case 'status':
    case 'metrics':
    case 'visual_result':
    default:
      return messages;
  }
}

/**
 * Pure function — Functional Core.
 * Normalizes a `sources` SSE event into the message model. The exact payload
 * shape is unconfirmed (spec §3.3), so this tolerates the plausible variants:
 * the list under `sources` or `content`, as an array or a JSON string; items
 * as `{ title?, url|link|href }` objects or plain strings. Anything it cannot
 * understand yields [] — absence of sources must never break the chat.
 *
 * Only http(s) URLs survive (a javascript: URL from a compromised stream must
 * not become a clickable link); URL-less items are kept as plain citations.
 */
export function extractSources(event: SSEEvent): MessageSource[] {
  const raw = event.sources ?? event.content;
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const out: MessageSource[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text) out.push(isHttpUrl(text) ? { title: text, url: text } : { title: text });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const candidate = [o.url, o.link, o.href].find(
        (v): v is string => typeof v === 'string' && isHttpUrl(v),
      );
      const title =
        typeof o.title === 'string' && o.title.trim() ? o.title.trim() : candidate;
      if (title) out.push(candidate ? { title, url: candidate } : { title });
    }
  }
  return out;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
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
