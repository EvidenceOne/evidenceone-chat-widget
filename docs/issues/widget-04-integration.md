# Issue 04: API Integration & Streaming

## Description
Wire the UI to the real API. On drawer open, trigger register + session. On send, stream tokens into the message list. Handle token expiry (silent re-auth). This is the core flow: button click → auth → chat → streaming response displayed.

## Dependencies
- [ ] Issue 02 (types and services) — AuthService, ChatService, SSEService ready
- [ ] Issue 03 (chat UI) — `<eo-chat>` and all sub-components ready

## Files to Create/Modify

### Modified Files
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — drive auth on drawer open, pass services down
- `src/components/eo-chat/eo-chat.tsx` — receive services as props, implement `handleSend`, stream tokens into messages state

## Implementation Details

### Auth trigger in `<evidenceone-chat>`

When drawer opens, run auth if no valid token:

```typescript
@State() isOpen: boolean = false;
@State() sessionToken: string | null = null;
@State() sessionId: string | null = null;
@State() authStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

private authService: AuthService;
private chatService: ChatService;

private get doctorData(): DoctorData {
  return {
    email: this.doctorEmail,
    name: this.doctorName,
    crm: this.doctorCrm,
    phone: this.doctorPhone,
    specialty: this.doctorSpecialty,
  };
}

private async openDrawer() {
  this.isOpen = true;
  if (this.sessionToken && !AuthService.isTokenExpired(this.sessionToken)) return;

  this.authStatus = 'loading';
  try {
    const token = await this.authService.ensureValidToken(this.doctorData);
    this.sessionToken = token;
    this.sessionId = this.authService.getSessionId();
    this.authStatus = 'ready';
    this.eoReady.emit({ sessionId: this.sessionId! });
  } catch (err) {
    this.authStatus = 'error';
    this.eoError.emit({ code: 'AUTH_FAILED', message: (err as Error).message });
  }
}
```

**Render update** — pass token and services to `<eo-chat>`:
```tsx
<eo-drawer isOpen={this.isOpen} onEoDrawerClose={...}>
  <eo-chat
    authStatus={this.authStatus}
    sessionToken={this.sessionToken}
    authService={this.authService}
    chatService={this.chatService}
    doctorData={this.doctorData}
    onClose={...}
    onNewSession={() => this.handleNewSession()}
  />
</eo-drawer>
```

### Streaming in `<eo-chat>`

**New props:**
```typescript
@Prop() authStatus: 'idle' | 'loading' | 'ready' | 'error';
@Prop() sessionToken: string | null;
@Prop() authService: AuthService;
@Prop() chatService: ChatService;
@Prop() doctorData: DoctorData;
```

**handleSend method:**
```typescript
private async handleSend(text: string) {
  if (!text.trim() || this.status === 'streaming') return;

  // Ensure valid token before sending
  let token: string;
  try {
    token = await this.authService.ensureValidToken(this.doctorData);
  } catch {
    this.status = 'error';
    return;
  }

  // Add user message
  const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
  this.messages = [...this.messages, userMsg];

  // Add empty assistant message (streaming target)
  const assistantId = crypto.randomUUID();
  const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true };
  this.messages = [...this.messages, assistantMsg];
  this.status = 'streaming';

  try {
    for await (const event of this.chatService.sendMessage(token, text)) {
      if (event.type === 'token' && event.data) {
        this.messages = this.messages.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content + event.data }
            : m
        );
      } else if (event.type === 'content' && event.data) {
        this.messages = this.messages.map(m =>
          m.id === assistantId ? { ...m, content: event.data! } : m
        );
      } else if (event.type === 'final_response' && event.data) {
        this.messages = this.messages.map(m =>
          m.id === assistantId ? { ...m, content: event.data!, isStreaming: false } : m
        );
      } else if (event.type === 'error') {
        this.status = 'error';
        this.messages = this.messages.map(m =>
          m.id === assistantId ? { ...m, isStreaming: false, content: m.content || 'Erro ao processar resposta.' } : m
        );
        return;
      } else if (event.type === 'done') {
        break;
      }
    }
  } catch {
    this.status = 'error';
    this.messages = this.messages.map(m =>
      m.id === assistantId ? { ...m, isStreaming: false } : m
    );
    return;
  }

  this.messages = this.messages.map(m =>
    m.id === assistantId ? { ...m, isStreaming: false } : m
  );
  this.status = 'idle';
}
```

### New session flow

```typescript
private handleNewSession() {
  this.messages = [];
  this.status = 'idle';
  // Parent (evidenceone-chat) will re-auth automatically on next send
}
```

In `evidenceone-chat.tsx`:
```typescript
private handleNewSession() {
  // Clear token to force re-auth
  this.sessionToken = null;
  this.sessionId = null;
  this.authStatus = 'idle';
}
```

### Loading state in `<eo-chat>`

Show loading overlay while `authStatus === 'loading'`:
```tsx
{this.authStatus === 'loading' && (
  <div class="eo-auth-loading">
    <eo-loading />
    <span>Conectando...</span>
  </div>
)}
```

### `newSession` prop behavior

If `newSession` prop is `true` on the root component, clear messages and token every time the drawer opens (force fresh session for each open):
```typescript
private async openDrawer() {
  this.isOpen = true;
  if (this.newSession) {
    this.sessionToken = null;
    this.sessionId = null;
  }
  // ... auth logic
}
```

## Acceptance Criteria
- [ ] Drawer opens → register + session called once → token stored in memory
- [ ] Subsequent opens reuse token if not expired
- [ ] Token expired mid-session → silent re-auth → message sends successfully
- [ ] Message sent → user bubble appears immediately
- [ ] Tokens stream in incrementally → assistant bubble updates character by character
- [ ] `final_response` event → streaming stops, content finalizes
- [ ] `error` event from server → error bar shown, retry possible
- [ ] Network error → error state shown
- [ ] "Nova conversa" clears messages and forces new session on next send
- [ ] `newSession` prop forces new session on each drawer open
- [ ] Input disabled during streaming, re-enabled on completion
- [ ] `eoReady` event fires with sessionId after successful auth
- [ ] `eoError` event fires on auth failure
- [ ] `npm run build` passes

## Testing Notes
- Test against running NestJS server at configured apiUrl
- Use browser DevTools Network tab to confirm: register and session called on open, chat called on send
- Confirm no tokens written to localStorage (DevTools → Application → Local Storage → should be empty from our component)
- Simulate slow network: verify streaming tokens appear incrementally, not all at once
- Test token expiry: manually set a very short `expires_in` or mock `isTokenExpired` to return true
