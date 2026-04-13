# Issue 03: Chat UI Components

## Description
Build all visual chat components: header, message list, message bubbles, input, and loading indicator. Wire them into `<eo-chat>` which sits inside the drawer. After this issue the full chat UI renders with hardcoded/mock messages. Branding is final.

## Dependencies
- [ ] Issue 01 (scaffold) — drawer must exist for eo-chat to slot into
- [ ] Issue 02 (types and services) — Message, ChatStatus types required

## Files to Create/Modify

### New Files
- `src/components/eo-chat/eo-chat.tsx`
- `src/components/eo-chat/eo-chat.css`
- `src/components/eo-chat-header/eo-chat-header.tsx`
- `src/components/eo-chat-header/eo-chat-header.css`
- `src/components/eo-message-list/eo-message-list.tsx`
- `src/components/eo-message-list/eo-message-list.css`
- `src/components/eo-message-bubble/eo-message-bubble.tsx`
- `src/components/eo-message-bubble/eo-message-bubble.css`
- `src/components/eo-chat-input/eo-chat-input.tsx`
- `src/components/eo-chat-input/eo-chat-input.css`
- `src/components/eo-loading/eo-loading.tsx`
- `src/components/eo-loading/eo-loading.css`
- `src/assets/logo.ts` — inlined SVG as string constant

### Modified Files
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — slot `<eo-chat>` inside `<eo-drawer>`

## Implementation Details

### `src/assets/logo.ts`
```typescript
// Inline SVG — no img src, no network request
export const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" ...>
  <!-- "Evidence" in #1d1d1b, "One." in #51C878 -->
</svg>
`;
```

### `<eo-chat-header>` Component

**Props:**
```typescript
@Prop() onClose: () => void;
@Prop() onNewSession: () => void;
```

**Render:**
```tsx
<Host>
  <div class="eo-header">
    <span class="eo-logo" innerHTML={LOGO_SVG} />
    <div class="eo-header-actions">
      <button class="eo-btn-new" onClick={this.onNewSession}>
        Nova conversa
      </button>
      <button class="eo-btn-close" aria-label="Fechar" onClick={this.onClose}>
        <!-- X icon SVG -->
      </button>
    </div>
  </div>
</Host>
```

**CSS:** height 56px, border-bottom 1px solid --eo-gray-200, flex align-center justify-between, padding 0 16px.

### `<eo-loading>` Component

**Purpose:** Pulsing dots shown while streaming.

**Render:**
```tsx
<Host>
  <div class="eo-loading">
    <span class="eo-dot" />
    <span class="eo-dot" />
    <span class="eo-dot" />
  </div>
</Host>
```

**CSS:** Three 8px circles animating with `@keyframes pulse` staggered delays.

### `<eo-message-bubble>` Component

**Props:**
```typescript
@Prop() role: 'user' | 'assistant';
@Prop() content: string;
@Prop() isStreaming: boolean = false;
```

**Notes:**
- User bubbles: right-aligned, background `--eo-green`, white text
- Assistant bubbles: left-aligned, background `--eo-gray-100`, dark text
- Assistant content rendered as markdown:
  ```typescript
  private getHtml(): string {
    if (this.role === 'user') return this.content;
    const raw = marked.parse(this.content) as string;
    return DOMPurify.sanitize(raw);
  }
  ```
- Use `innerHTML` via ref for assistant bubbles (sanitized above)
- If `isStreaming`, show `<eo-loading>` after content

### `<eo-message-list>` Component

**Props:**
```typescript
@Prop() messages: Message[] = [];
@Prop() isStreaming: boolean = false;
```

**Auto-scroll:** `componentDidUpdate` scrolls container to bottom:
```typescript
@Element() el: HTMLElement;

componentDidUpdate() {
  const list = this.el.shadowRoot?.querySelector('.eo-message-list');
  if (list) list.scrollTop = list.scrollHeight;
}
```

**Render:**
```tsx
<Host>
  <div class="eo-message-list">
    {this.messages.length === 0 && (
      <div class="eo-empty">Como posso ajudar?</div>
    )}
    {this.messages.map(msg => (
      <eo-message-bubble
        key={msg.id}
        role={msg.role}
        content={msg.content}
        isStreaming={msg.isStreaming}
      />
    ))}
  </div>
</Host>
```

**CSS:** `overflow-y: auto; flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px`

### `<eo-chat-input>` Component

**Props:**
```typescript
@Prop() disabled: boolean = false;
```

**Events:**
```typescript
@Event() eoSendMessage: EventEmitter<string>;
```

**State:**
```typescript
@State() value: string = '';
```

**Behavior:**
- Textarea auto-expands up to 4 lines (`rows=1`, JS height adjust on input)
- Enter → send (if value non-empty and not disabled)
- Shift+Enter → newline
- Send button disabled when `value.trim() === ''` or `disabled === true`

**Render:**
```tsx
<Host>
  <div class="eo-input-area">
    <textarea
      class="eo-textarea"
      placeholder="Escreva sua mensagem..."
      disabled={this.disabled}
      value={this.value}
      onInput={(e) => this.handleInput(e)}
      onKeyDown={(e) => this.handleKeyDown(e)}
      rows={1}
    />
    <button
      class="eo-send-btn"
      disabled={this.disabled || !this.value.trim()}
      onClick={() => this.handleSend()}
    >
      <!-- Send icon SVG -->
    </button>
  </div>
</Host>
```

### `<eo-chat>` Container Component

**Purpose:** Orchestrates header + message list + input. Holds local state for messages during this phase (actual API wiring in Issue 04).

**Props:**
```typescript
@Prop() onClose: () => void;
@Prop() onNewSession: () => void;
```

**State:**
```typescript
@State() messages: Message[] = [];
@State() status: ChatStatus = 'idle';
```

**Render:**
```tsx
<Host>
  <div class="eo-chat">
    <eo-chat-header
      onClose={this.onClose}
      onNewSession={this.onNewSession}
    />
    <eo-message-list
      messages={this.messages}
      isStreaming={this.status === 'streaming'}
    />
    {this.status === 'error' && (
      <div class="eo-error-bar">
        Erro ao conectar. <button onClick={() => this.status = 'idle'}>Tentar novamente</button>
      </div>
    )}
    <eo-chat-input
      disabled={this.status === 'streaming' || this.status === 'loading'}
      onEoSendMessage={(e) => this.handleSend(e.detail)}
    />
  </div>
</Host>
```

**CSS:** `display: flex; flex-direction: column; height: 100%; overflow: hidden`

### Root component update

In `evidenceone-chat.tsx` render:
```tsx
<eo-drawer isOpen={this.isOpen} onEoDrawerClose={...}>
  <eo-chat
    onClose={() => { this.isOpen = false; this.eoClose.emit(); }}
    onNewSession={() => { /* reset — wired in issue 04 */ }}
  />
</eo-drawer>
```

## Styling Reference

Brand colors (from CLAUDE.md):
```css
--eo-green: #51C878;
--eo-dark: #1d1d1b;
--eo-white: #FFFFFF;
--eo-gray-100: #F5F5F5;
--eo-gray-200: #E5E5E5;
--eo-gray-500: #888888;
--eo-gray-800: #333333;
```

## Acceptance Criteria
- [ ] Logo renders correctly: "Evidence" in #1d1d1b, "One." in #51C878
- [ ] Header has "Nova conversa" button and X close button
- [ ] Empty state shows "Como posso ajudar?"
- [ ] User bubbles: right-aligned, green background
- [ ] Assistant bubbles: left-aligned, gray background, markdown rendered
- [ ] Markdown XSS test: `<script>alert(1)</script>` in content → sanitized by DOMPurify, no alert
- [ ] Textarea expands up to 4 lines, no more
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Send button disabled when input is empty or streaming
- [ ] `<eo-loading>` shows pulsing dots
- [ ] `npm run build` passes

## Testing Notes
- Add hardcoded messages array in `eo-chat` with one user and one assistant message to verify rendering
- Test markdown: bold, italic, code block, links in assistant message
- Test XSS: add `<img src=x onerror=alert(1)>` as assistant message content — must be sanitized
- Run `/test-component` to verify in browser
