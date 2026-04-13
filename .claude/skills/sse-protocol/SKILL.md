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

`apiUrl` is always provided by the partner. Mode is always hardcoded to `case_br` in the request body.

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
  body: JSON.stringify({ message, mode: 'case_br' }),
});
// res.body is a ReadableStream<Uint8Array>
```

### SSE Event Types

| Type | Payload field | Action |
|------|--------------|--------|
| `progress` | `data` (status string) | Show progress indicator |
| `token` | `data` (text chunk) | **Append** to current assistant message |
| `content` | `data` (full text) | **Replace** current assistant message |
| `final_response` | `data` (final text) | Replace content, mark streaming done |
| `error` | `message`, `code` | Show error state, stop streaming |
| `done` | — | End streaming state |
| `[DONE]` | — | Sentinel in raw data line, same as `done` |

### SSE Line Parsing

Each SSE message arrives as `data: {json}\n\n`. Parse like this:

```typescript
static parseLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  const raw = line.slice(6).trim();
  if (raw === '[DONE]') return { type: 'done' };
  try {
    return JSON.parse(raw) as SSEEvent;
  } catch {
    return null;
  }
}
```

### Streaming into Message State

```typescript
// Append incremental token
case 'token':
  messages = messages.map(m =>
    m.id === assistantId ? { ...m, content: m.content + event.data } : m
  );
  break;

// Replace full content
case 'content':
case 'final_response':
  messages = messages.map(m =>
    m.id === assistantId ? { ...m, content: event.data!, isStreaming: false } : m
  );
  break;
```

## Error Handling

- Network error → show error bar, keep messages, allow retry
- `error` event from server → show error bar, finalize incomplete assistant message
- Auth failure → emit `eoError` event, show error state in drawer
- Never silently swallow errors — always surface to user in Portuguese
