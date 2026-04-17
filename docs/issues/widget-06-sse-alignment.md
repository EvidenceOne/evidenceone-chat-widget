# Issue: SSE Alignment — Event Names and Field Fix

## Description
Align the chat widget SSE handling with the Agent contract (`API_CONTRACT.md`). Update event type names from translated names (token/done/progress) to native names (delta/end/status), fix the `SSEEvent.data` → `SSEEvent.content` field mismatch, and remove mode from the chat request.

## Context
- **Spec:** `EvidenceOne_Client/docs/specs/spec-sse-streaming-alignment.md`
- **Contract:** `EvidenceOne_Client/docs/API_CONTRACT.md`
- **Dependencies:** NestJS Server issue (012-sse-streaming-alignment) must be deployed first

## Files to Modify

### `src/models/types.ts`
- Update `SSEEventType` union: `'progress'`→`'status'`, `'token'`→`'delta'`, `'done'`→`'end'`
- Add `'metrics'` to the union
- Fix `SSEEvent.data` → `SSEEvent.content` (align with actual JSON field from server)
- Remove `content` and `final_response` from union (agent no longer emits these)

```typescript
export type SSEEventType = 'status' | 'delta' | 'visual_result' | 'metrics' | 'error' | 'end';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;    // FIXED: was 'data' — now matches the actual JSON field
  message?: string;
  code?: string;
}
```

### `src/utils/chat-state.ts`
- Rename switch cases: `'token'`→`'delta'`, `'done'`→`'end'`, `'progress'`→`'status'`
- Remove `'content'` and `'final_response'` cases
- Read `event.content` instead of `event.data`
- Add `'metrics'` as ignored case

```typescript
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
          ? { ...m, content: m.content || 'Erro ao processar resposta.', isStreaming: false }
          : m,
      );
    case 'end':
      return messages.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m,
      );
    case 'status':
    case 'metrics':
    default:
      return messages;
  }
}
```

### `src/services/chat.service.ts`
- Remove `mode: 'case_br'` from request body — agent decides autonomously

```typescript
body: JSON.stringify({ message }),
```

### `src/components/eo-chat/eo-chat.tsx`
- Update `event.type === 'done'` check to `event.type === 'end'` in the stream loop

### Test files
- `src/services/sse.service.unit.test.ts` — update test event types
- `src/utils/chat-state.unit.test.ts` — update switch case tests
- `src/services/chat.service.unit.test.ts` — update request body assertion (no mode)

## Acceptance Criteria
- [ ] `SSEEventType` uses native names: status, delta, end, metrics, error, visual_result
- [ ] `SSEEvent` interface uses `content` field (not `data`)
- [ ] `applySSEEvent` handles `delta` (append), `end` (stop streaming), `error` (mark error)
- [ ] `applySSEEvent` ignores `status` and `metrics`
- [ ] Chat request body does not include `mode`
- [ ] `eo-chat.tsx` stream loop checks `event.type === 'end'` (not `'done'`)
- [ ] All unit tests pass
- [ ] Widget builds successfully

## Testing Notes
- Run `npm test` — all unit tests pass
- Run `npm run build` — widget compiles
- Manual test: send a message, verify tokens stream and accumulate
- Verify the `data` → `content` fix doesn't break existing functionality (check that tokens actually accumulate — this was likely a latent bug)
