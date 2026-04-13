# Issue 02: Types, Utils & Services

## Description
Create the data layer: shared TypeScript types, JWT utility, and the three services (auth, SSE, chat). No UI changes. After this issue the auth flow and SSE parsing work end-to-end and can be exercised in unit tests.

## Dependencies
- [ ] Issue 01 (scaffold) must be completed first — services will be instantiated by the root component

## Files to Create/Modify

### New Files
- `src/models/types.ts`
- `src/utils/token.ts`
- `src/services/auth.service.ts`
- `src/services/sse.service.ts`
- `src/services/chat.service.ts`

### Modified Files
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — instantiate AuthService + ChatService, store sessionToken/sessionId in state

## Implementation Details

### `src/models/types.ts`

```typescript
// Doctor data passed as props
export interface DoctorData {
  email: string;
  name: string;
  crm: string;
  phone: string;
  specialty?: string;
}

// Session response from POST /partner/session
export interface SessionResponse {
  session_token: string;
  session_id: string;
  expires_in: number; // seconds
}

// Message in chat history
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

// SSE event from server
export type SSEEventType = 'progress' | 'token' | 'content' | 'final_response' | 'error' | 'done';

export interface SSEEvent {
  type: SSEEventType;
  data?: string;
  message?: string;
  code?: string;
}

// Chat state
export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';
```

### `src/utils/token.ts`

Pure functions only — no fetch, no DOM.

```typescript
interface JWTPayload {
  exp: number; // expiry timestamp (seconds)
  [key: string]: unknown;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// Returns true if token is expired or will expire within bufferSeconds
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < bufferSeconds;
}
```

### `src/services/auth.service.ts`

```typescript
import { DoctorData, SessionResponse } from '../models/types';
import { isTokenExpired } from '../utils/token';

export class AuthService {
  private apiUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private sessionId: string | null = null;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  // Static pure methods (Functional Core)
  static isTokenExpired = isTokenExpired;

  // I/O instance methods
  async register(doctor: DoctorData): Promise<void> {
    const res = await fetch(`${this.apiUrl}/partner/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        email: doctor.email,
        name: doctor.name,
        crm: doctor.crm,
        phone: doctor.phone,
        ...(doctor.specialty && { specialty: doctor.specialty }),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Register failed: ${res.status}`);
    }
  }

  async createSession(crm: string): Promise<SessionResponse> {
    const res = await fetch(`${this.apiUrl}/partner/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ crm }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Session failed: ${res.status}`);
    }
    const data: SessionResponse = await res.json();
    this.token = data.session_token;
    this.sessionId = data.session_id;
    return data;
  }

  async ensureValidToken(doctor: DoctorData): Promise<string> {
    if (this.token && !isTokenExpired(this.token)) {
      return this.token;
    }
    await this.register(doctor);
    const session = await this.createSession(doctor.crm);
    return session.session_token;
  }

  getToken(): string | null { return this.token; }
  getSessionId(): string | null { return this.sessionId; }
}
```

### `src/services/sse.service.ts`

Parses raw ReadableStream from the chat endpoint.

```typescript
import { SSEEvent } from '../models/types';

export class SSEService {
  // Pure static parser (Functional Core)
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

  // Yields SSEEvents from a ReadableStream
  static async *streamEvents(
    stream: ReadableStream<Uint8Array>
  ): AsyncGenerator<SSEEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = SSEService.parseLine(line.trim());
          if (event) yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

### `src/services/chat.service.ts`

```typescript
import { SSEEvent } from '../models/types';
import { SSEService } from './sse.service';

export class ChatService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async *sendMessage(
    token: string,
    message: string
  ): AsyncGenerator<SSEEvent> {
    const res = await fetch(`${this.apiUrl}/partner/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message, mode: 'case_br' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Chat failed: ${res.status}`);
    }

    if (!res.body) throw new Error('No response body');

    yield* SSEService.streamEvents(res.body);
  }
}
```

### Root component updates

In `evidenceone-chat.tsx`, add:
```typescript
@State() sessionToken: string | null = null;
@State() sessionId: string | null = null;

private authService: AuthService;
private chatService: ChatService;

componentWillLoad() {
  // existing prop validation...
  this.authService = new AuthService(this.apiUrl, this.apiKey);
  this.chatService = new ChatService(this.apiUrl);
}
```

## Acceptance Criteria
- [ ] `src/models/types.ts` exports all required interfaces
- [ ] `isTokenExpired` returns true for expired tokens (test with crafted JWTs)
- [ ] `AuthService.ensureValidToken` re-auths when token is expired
- [ ] `SSEService.parseLine` correctly parses `token`, `content`, `final_response`, `error`, `done`, and `[DONE]` lines
- [ ] `SSEService.parseLine` returns null for non-data lines
- [ ] `ChatService.sendMessage` yields SSEEvents from a stream
- [ ] `npm run build` still passes

## Testing Notes
- Unit test `isTokenExpired` with expired and valid JWT payloads (base64 encode manually)
- Unit test `SSEService.parseLine` with fixture strings for each event type
- Integration test auth flow against running NestJS server (manual)
