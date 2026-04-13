---
name: tdd
description: Where and how to apply TDD in evidenceone-chat-widget — service layer, state logic, and pure functions. Not applicable to component rendering or CSS.
---

# TDD in evidenceone-chat-widget

## Where TDD Applies

| Layer | TDD? | Why |
|-------|------|-----|
| `utils/token.ts` | ✓ | Pure functions — deterministic, zero setup |
| `services/auth.service.ts` | ✓ | Mock `fetch`, test behavior and token state |
| `services/sse.service.ts` | ✓ | Static parsers — deterministic inputs/outputs |
| `services/chat.service.ts` | ✓ | Mock `fetch`, test streaming delegation |
| State logic in `eo-chat` | ✓ | SSE event → message state transitions are pure logic |
| Component rendering | ✗ | Visual output — verify in browser |
| CSS / Shadow DOM | ✗ | Visual output — verify in browser |
| Animation / mobile layout | ✗ | Visual output — verify in browser |

## Cycle

**Red → Green → Refactor**

1. **Red** — write a failing test that describes the behavior you want
2. **Green** — write the minimum code to make it pass
3. **Refactor** — question your Green-phase decisions before moving on

Refactor is not cleanup. Ask: "Would I write this differently from scratch?" If yes, fix it now.

## Test Structure

```typescript
// src/services/auth.service.spec.ts
describe('AuthService', () => {
  describe('ensureValidToken', () => {
    it('returns existing token when not expired', async () => { ... });
    it('re-authenticates when token is expired', async () => { ... });
    it('throws when register endpoint returns 4xx', async () => { ... });
  });
});
```

Order: happy path → edge cases → error paths.

## Mocking Rule

**Mock at the frontier only.** The frontier in this project is `fetch`.

```typescript
// Mock fetch, never mock the class under test
const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ session_token: 'tok', session_id: 'sid', expires_in: 3600 }),
});
```

Never mock `AuthService` methods when testing `AuthService`. Never mock `SSEService` internals when testing `SSEService`.

## Tool

Stencil projects use **Jest** by default (via `@stencil/core/testing`). Use it — don't add Vitest.

```bash
npm test              # run all tests
npm run test.watch    # watch mode during development
```

## Examples by Layer

### Pure functions — `token.ts`

```typescript
describe('isTokenExpired', () => {
  it('returns false for a valid token with time remaining', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJWT({ exp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    const token = makeJWT({ exp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns true within the 60-second buffer', () => {
    const exp = Math.floor(Date.now() / 1000) + 30; // expires in 30s
    const token = makeJWT({ exp });
    expect(isTokenExpired(token)).toBe(true); // buffer=60 catches it
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('not.a.jwt')).toBe(true);
  });
});

// Helper — build a real base64-encoded JWT payload for tests
function makeJWT(payload: object): string {
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}
```

### SSE parser — `sse.service.ts`

```typescript
describe('SSEService.parseLine', () => {
  it('parses a token event', () => {
    const line = 'data: {"type":"token","data":"hello"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'token', data: 'hello' });
  });

  it('parses the [DONE] sentinel', () => {
    expect(SSEService.parseLine('data: [DONE]')).toEqual({ type: 'done' });
  });

  it('returns null for non-data lines', () => {
    expect(SSEService.parseLine('event: message')).toBeNull();
    expect(SSEService.parseLine('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(SSEService.parseLine('data: {broken')).toBeNull();
  });
});
```

### Service with fetch mock — `auth.service.ts`

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService('https://api.test.com', 'key_test');
    global.fetch = vi.fn();
  });

  describe('ensureValidToken', () => {
    it('returns cached token when still valid', async () => {
      // Pre-load a valid token via createSession
      const exp = Math.floor(Date.now() / 1000) + 3600;
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // register
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ session_token: makeJWT({ exp }), session_id: 'sid', expires_in: 3600 }),
        }); // session
      await service.ensureValidToken(mockDoctor);

      // Second call — fetch should NOT be called again
      const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;
      await service.ensureValidToken(mockDoctor);
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
    });

    it('re-authenticates when token is expired', async () => {
      // Two full auth cycles expected
      (global.fetch as jest.Mock)
        .mockResolvedValue({ ok: true, json: async () => ({ session_token: makeJWT({ exp: 0 }), session_id: 'sid', expires_in: 0 }) });

      await service.ensureValidToken(mockDoctor);
      await service.ensureValidToken(mockDoctor);

      // fetch called 4 times: register + session × 2
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});
```

### State logic in `eo-chat`

Extract the message-update logic into a pure function so it's testable without rendering:

```typescript
// eo-chat.tsx
export function applySSEEvent(messages: Message[], assistantId: string, event: SSEEvent): Message[] {
  switch (event.type) {
    case 'token':
      return messages.map(m => m.id === assistantId ? { ...m, content: m.content + (event.data ?? '') } : m);
    case 'content':
    case 'final_response':
      return messages.map(m => m.id === assistantId ? { ...m, content: event.data ?? m.content, isStreaming: false } : m);
    default:
      return messages;
  }
}
```

```typescript
// eo-chat.spec.ts
describe('applySSEEvent', () => {
  const base: Message[] = [{ id: 'a1', role: 'assistant', content: '', isStreaming: true }];

  it('appends token to assistant message', () => {
    const result = applySSEEvent(base, 'a1', { type: 'token', data: 'hello' });
    expect(result[0].content).toBe('hello');
  });

  it('replaces content on final_response', () => {
    const result = applySSEEvent(
      [{ id: 'a1', role: 'assistant', content: 'partial', isStreaming: true }],
      'a1',
      { type: 'final_response', data: 'complete answer' }
    );
    expect(result[0].content).toBe('complete answer');
    expect(result[0].isStreaming).toBe(false);
  });

  it('does not mutate other messages', () => {
    const msgs: Message[] = [
      { id: 'u1', role: 'user', content: 'question' },
      { id: 'a1', role: 'assistant', content: '', isStreaming: true },
    ];
    const result = applySSEEvent(msgs, 'a1', { type: 'token', data: 'x' });
    expect(result[0]).toBe(msgs[0]); // same reference — untouched
  });
});
```

## What NOT to Test

- Does `<eo-message-bubble>` render a `<div>`? No.
- Does the drawer open when `isOpen` is true? No.
- Does the textarea grow to 4 lines? No.
- Does the CSS animation run in ≤300ms? No.

These are verified with `/test-component` in a real browser.
