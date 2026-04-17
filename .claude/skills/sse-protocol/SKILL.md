---
name: sse-protocol
description: Server endpoints, auth flow, SSE event types, token rules, and streaming implementation for evidenceone-chat-widget
---

# SSE Protocol & Auth Flow

## Three Server Endpoints

```
POST {apiUrl}/partner/register   → upsert doctor       (X-API-Key header)
POST {apiUrl}/partner/session    → create session + JWT (X-API-Key header)
POST {apiUrl}/partner/chat       → SSE stream           (Authorization: Bearer {token})
```

`apiUrl` is always provided by the partner. The chat request body contains only `{ message }` — the agent decides the mode autonomously, we do not send one.

## Auth Flow

1. Drawer opens → trigger auth
2. `POST /partner/register` with `X-API-Key`, body: `{ email, name, crm, phone, specialty? }` — idempotent upsert
3. `POST /partner/session` with `X-API-Key`, body: `{ crm }` → returns `{ session_token, session_id, expires_in }`
4. Store `session_token` **in memory only** (component instance variable)
5. Before every chat request: check token expiry → if expired, redo steps 2–3 silently
6. All chat requests use `Authorization: Bearer {session_token}`

### Token Rules — Non-Negotiable

- Token lives **only** in a component instance variable
- **Never** write to `localStorage`, `sessionStorage`, `cookies`, or `IndexedDB`
- Re-auth is cheap (two fast POST requests) — do it silently on expiry
- Check expiry with a 60-second buffer so the token doesn't expire mid-request

```typescript
// token.ts — pure functions only
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp - Math.floor(Date.now() / 1000) < bufferSeconds;
  } catch {
    return true; // treat malformed tokens as expired
  }
}
```

## SSE Streaming

Use `fetch` + `ReadableStream` — **not** `EventSource`. EventSource is GET-only; our chat endpoint is POST.

```typescript
const res = await fetch(`${apiUrl}/partner/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ message }),
});
// res.body is a ReadableStream<Uint8Array>
```

### SSE Event Types (native Agent names)

| Type | Payload field | Action |
|------|--------------|--------|
| `delta` | `content` (text chunk) | **Append** to current assistant message |
| `status` | `content` (status string) | Ignore (observational) |
| `metrics` | `content` (token usage info) | Ignore (observational) |
| `visual_result` | `content` | Ignore (widget doesn't render visual blocks) |
| `error` | `message`, `code` | Show error state, stop streaming |
| `end` | — | End streaming state |
| `[DONE]` | — | Raw sentinel — emit as `{ type: 'end' }` |

### SSE Line Parsing

Each SSE message arrives as `data: {json}\n\n`. Parse like this:

```typescript
static parseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data:')) return null;
  const raw = line.slice(5).trim();
  if (!raw) return null;
  if (raw === '[DONE]') return { type: 'end' };
  try {
    return JSON.parse(raw) as SSEEvent;
  } catch {
    return null;
  }
}
```

### Streaming into Message State

```typescript
// Append incremental chunk
case 'delta':
  messages = messages.map(m =>
    m.id === assistantId ? { ...m, content: m.content + event.content } : m
  );
  break;

// Stop streaming cleanly
case 'end':
  messages = messages.map(m =>
    m.id === assistantId ? { ...m, isStreaming: false } : m
  );
  break;

// Error — stop + mark
case 'error':
  messages = messages.map(m =>
    m.id === assistantId ? { ...m, isStreaming: false, error: true } : m
  );
  break;

// Observational — ignore
case 'status':
case 'metrics':
case 'visual_result':
  break;
```

## Error Handling

- Network error → show error bar, keep messages, allow retry
- `error` event from server → show error bar, finalize incomplete assistant message
- Auth failure → emit `eoError` event, show error state in drawer
- Never silently swallow errors — always surface to user in Portuguese
