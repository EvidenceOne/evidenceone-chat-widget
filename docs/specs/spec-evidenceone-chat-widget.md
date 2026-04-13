# Spec: @evidenceone/chat-widget — B2B Web Component (v2 — Final)

## Resumo

New StencilJS web component published as NPM package. Partners install `@evidenceone/chat-widget` (or load via CDN), place `<evidenceone-chat>` where they want a button, and the component handles everything: register doctor, create session, open drawer, stream chat responses. Shadow DOM locks EvidenceOne branding. Mode locked to Case Brasil. Doctor data passed as props, API key authenticates the partner. Token stored in memory only. Dependencies: `marked` (markdown) + `dompurify` (XSS prevention).

Stack: StencilJS, TypeScript strict, Shadow DOM, native fetch + ReadableStream (SSE), marked + DOMPurify.

---

## 1. Objetivo e Contexto

**Objetivo:** Deliver an NPM package that partners install to embed EvidenceOne's Case Brasil chat as a drawer in their systems. Zero backend work required from the partner — install, pass props, position button.

**Contexto:** The NestJS server has all partner endpoints ready: `POST /v1/partner/register` (upsert doctor), `POST /v1/partner/session` (create session + JWT), `POST /v1/partner/chat` (SSE stream). Doctor Assistant AI (DAAI) is the first partner. Their `@doctorassistant/daai-component` uses StencilJS + Shadow DOM — same architecture pattern.

**O que NAO muda:**
- NestJS server — all partner endpoints final
- Agent microservice — stays as-is
- EvidenceOne_Client (Next.js) — separate project, separate spec

---

## 2. Fundacao

### 2.1 Project Structure

```
evidenceone-chat-widget/
├── src/
│   ├── components/
│   │   ├── evidenceone-chat/          # Root component (the tag partner uses)
│   │   ├── eo-drawer/                 # Overlay panel (slides from right)
│   │   ├── eo-chat/                   # Chat container
│   │   ├── eo-message-list/           # Scrollable message list
│   │   ├── eo-message-bubble/         # Individual bubble (user/assistant)
│   │   ├── eo-chat-input/             # Textarea + send button
│   │   ├── eo-chat-header/            # Logo + close + new session
│   │   └── eo-loading/                # Streaming indicator
│   ├── services/
│   │   ├── auth.service.ts            # Register + session + token management
│   │   ├── chat.service.ts            # POST /v1/partner/chat (SSE)
│   │   └── sse.service.ts             # SSE parsing from ReadableStream
│   ├── models/
│   │   └── types.ts                   # Props, events, message types
│   ├── utils/
│   │   └── token.ts                   # JWT decode, expiry check (no verify — server verifies)
│   └── assets/
│       └── EvidenceOne logo + icons (inlined SVG)
├── stencil.config.ts
├── package.json
└── README.md
```

### 2.2 Tech

- StencilJS → compiles to native Web Components
- Shadow DOM → style isolation (partner CSS can't break our UI)
- No React, no Tailwind inside — vanilla CSS + TypeScript
- Native `fetch` for HTTP
- `ReadableStream` for SSE (POST body needed, EventSource doesn't support POST)
- `marked` (~8kb) for markdown → HTML
- `dompurify` (~7kb) for XSS sanitization
- TypeScript strict

### 2.3 Distribution

```bash
# npm
npm install @evidenceone/chat-widget

# CDN
<script src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js" type="module"></script>
```

### 2.4 NPM Publishing

**Org:** `@evidenceone` on npmjs.com. Package is PUBLIC — partners install via `npm i` without requesting access.

**Versioning:** Semver. Patch for fixes, minor for features, major for breaking changes to props/events API.

**package.json:**
```json
{
  "name": "@evidenceone/chat-widget",
  "files": ["dist/"],
  "scripts": {
    "prepublishOnly": "npm run build && npm audit --audit-level=high && npm test"
  }
}
```

`"files": ["dist/"]` ensures only compiled output is published — never source code.

**Publish flow (manual for MVP):**
```bash
npm version patch|minor|major
npm publish --access public
# CDN auto-updates via jsdelivr
```

GitHub Actions on tag push is deferred — manual publish is fine for <5 partners.

---

## 3. Features

### 3.1 Root Component — `<evidenceone-chat>`

The tag the partner uses. Renders an inline button. Opens drawer on click.

```typescript
@Component({ tag: 'evidenceone-chat', shadow: true })
export class EvidenceOneChat {
  // Required props
  @Prop() apiKey: string;
  @Prop() apiUrl: string;
  @Prop() doctorEmail: string;
  @Prop() doctorName: string;
  @Prop() doctorCrm: string;
  @Prop() doctorPhone: string;

  // Optional props
  @Prop() doctorSpecialty?: string;
  @Prop() newSession: boolean = false;
  @Prop() hideButton: boolean = false;

  // State
  @State() isOpen: boolean = false;
  @State() sessionToken: string | null = null;
  @State() sessionId: string | null = null;

  // Events
  @Event() eoReady: EventEmitter<{ sessionId: string }>;
  @Event() eoError: EventEmitter<{ code: string; message: string }>;
  @Event() eoClose: EventEmitter<void>;

  // Public methods
  @Method() async show(): Promise<void>;
  @Method() async hide(): Promise<void>;

  componentWillLoad() {
    if (!this.apiKey || !this.apiUrl || !this.doctorEmail ||
        !this.doctorName || !this.doctorCrm || !this.doctorPhone) {
      console.error('[EvidenceOne] Missing required props: apiKey, apiUrl, doctorEmail, doctorName, doctorCrm, doctorPhone');
      return;
    }
  }
}
```

**Usage — inline button:**
```html
<div class="header-actions">
  <evidenceone-chat
    api-key="eo_live_..."
    api-url="https://api.partner-endpoint.com/v1"
    doctor-name="Dr. João"
    doctor-email="joao@hospital.com"
    doctor-crm="123456/SP"
    doctor-phone="21999999999"
  ></evidenceone-chat>
</div>
```

**Usage — custom trigger:**
```html
<evidenceone-chat id="eo" api-key="..." api-url="..." hide-button ...></evidenceone-chat>
<button onclick="document.getElementById('eo').show()">Meu botão</button>
```

**No FAB.** Button is inline where the partner places the tag. Drawer is overlay.

### 3.2 Drawer

- Width: 400px desktop, fullscreen mobile (<768px)
- Position: fixed right, overlay (doesn't push host content)
- Open: ≤300ms slide-in from right
- Close: X button, ESC, click backdrop
- Doesn't alter scroll or layout of host page
- z-index: 999998 (backdrop), 999999 (drawer)
- Minimum viewport: 360px

### 3.3 Chat UI

**Header:**
- "Evidence" (#1d1d1b) + "One." (#51C878) logo
- "Nova conversa" button (creates new session)
- X close button

**Message list:**
- Auto-scroll on new messages
- User bubbles: right-aligned
- Assistant bubbles: left-aligned, markdown rendered via `marked` + sanitized via DOMPurify
- Streaming: tokens appear incrementally

**Input:**
- Textarea, auto-expands (max 4 lines)
- Send button (enabled only with text, disabled during streaming)
- Enter sends, Shift+Enter breaks line

**States:**
- Loading (authenticating)
- Empty (first message)
- Streaming (pulsing indicator, input disabled)
- Error (message + retry button)
- Token expired (silent re-auth)

### 3.4 Auth Flow

1. Button clicked → drawer opens
2. `POST {apiUrl}/partner/register` — `X-API-Key` header, body: `{ email, name, crm, phone, specialty }` — upsert, idempotent
3. `POST {apiUrl}/partner/session` — `X-API-Key` header, body: `{ crm }` — returns `{ session_token, session_id, expires_in }`
4. Token stored in memory (component variable, NEVER localStorage)
5. All chat requests: `Authorization: Bearer {session_token}`
6. Before each request: check expiry → if expired, re-do steps 2-3

### 3.5 SSE Streaming

1. User sends message
2. `POST {apiUrl}/partner/chat` — Bearer token, body: `{ message }`
3. Response: SSE stream via ReadableStream
4. Parse `data: {json}\n\n` lines
5. Event types: `progress` (queued/processing), `token` (incremental text), `content` (full replacement), `final_response`, `error`, `done`
6. `data: [DONE]\n\n` marks stream end
7. Mode always `case_br` (hardcoded)
8. On connection error: show error, user can retry manually

Port SSE parsing logic from EvidenceOne_Client's `useChatStream.ts` — same protocol, vanilla TypeScript.

### 3.6 Markdown + XSS Prevention

Use `marked` (~8kb) for markdown → HTML, piped through `dompurify` (~7kb) before injecting into Shadow DOM.

`marked` removed `{ sanitize: true }` in v4+. The correct approach:
```typescript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function renderMarkdown(text: string): string {
  const rawHtml = marked.parse(text);
  return DOMPurify.sanitize(rawHtml);
}
```

Both are runtime dependencies (`dependencies`, not `devDependencies`). Total added bundle: ~15kb gzipped.

### 3.7 Branding

Locked inside Shadow DOM. Partner CANNOT customize:
- Internal colors, typography, icons, structure

Partner CAN customize:
```css
evidenceone-chat {
  --eo-button-color: #51C878;
  --eo-button-text-color: #FFFFFF;
}
```

Or hide button and use `show()`/`hide()` API.

### 3.8 README

Copy-paste examples for:
- HTML (CDN script tag)
- React (`import + <evidenceone-chat>`)
- Vue (`import + <evidenceone-chat>`)
- Next.js (`dynamic import` with `ssr: false`)

**CORS / Domain Registration:**
"During onboarding, register your domain with EvidenceOne so the API accepts requests from your application."

**CSP Requirements:**
Partners with strict Content Security Policy need:
```
connect-src: {your apiUrl domain}
script-src: cdn.jsdelivr.net (if using CDN distribution)
```

Follow DAAI readme pattern.

---

## 4. Security

### 4.1 API Key Exposure

The `api-key` prop is an HTML attribute — visible in browser inspector. This is the standard trade-off for all client-side B2B components (DAAI included).

**The API key is a partner identifier, not a secret.** Protection is server-side:
- **CORS allowlist:** Server only accepts requests from registered partner domains. Each `business_account` stores `allowed_origins` in the `settings` JSONB. During onboarding, partner registers their domain(s).
- **Rate limiting:** `partner_usage` table enforces daily query limit per partner.
- **Instant revocation:** Admin can revoke a key via `DELETE /v1/admin/accounts/:id/api-keys/:keyId` — rejected immediately on next request.

The contractual obligation (per the product doc) is for the partner to not expose the key in PUBLIC code (e.g., public GitHub repos). In the running application, the key is necessarily visible — inherent to client-side components.

### 4.2 CORS

The server currently accepts all origins (`origin: true`). This is acceptable for MVP — CORS is browser-only and trivially bypassed by any non-browser client (curl, Postman, server-side). The real protection is rate limiting + revocation.

**Future enhancement (not MVP):** Per-partner origin validation via `allowed_origins` in `business_account.settings`. Adds a speed bump for browser-based abuse but doesn't stop determined attackers. Implement if a partner requests it or abuse is detected.

### 4.3 Supply Chain

- 2FA mandatory on the `@evidenceone` npm org account
- `npm audit --audit-level=high` runs before every publish (in `prepublishOnly` script). Fail on high/critical vulnerabilities.
- `package-lock.json` committed to repo. Dependencies locked.
- Minimal dependencies: `marked` + `dompurify` only. Every new dependency is attack surface. Additions require explicit justification.

### 4.4 XSS Prevention

Agent responses are markdown — converted to HTML by `marked`, then sanitized by `dompurify` before injection into Shadow DOM. The Shadow DOM provides an additional isolation layer (partner page can't access our DOM), but XSS from AI-generated content must be prevented at the parser level.

### 4.5 Defense in Depth

If someone extracts the API key and makes requests outside the component:
1. CORS blocks requests from unregistered origins
2. `partner_usage` daily limit caps total queries
3. Admin can revoke the key instantly
4. Session JWT expires after 1h — limits blast radius

The component is a convenience layer. The server is the enforcement layer.

---

## 5. Validation Gates

```bash
npm run build    # StencilJS builds dist/
npm test         # Component tests pass
npm audit        # No high/critical vulnerabilities
```

| Phase | Validation |
|-------|-----------|
| Scaffold | `<evidenceone-chat>` renders inline button in plain HTML. Shadow DOM active. Drawer opens/closes. Missing required props logged to console. |
| API flow | Register + session works against NestJS server. Token stored in memory. Token refresh on expiry. |
| Chat | Message → SSE → tokens render → markdown (marked + DOMPurify) → complete. Mode case_br. |
| Drawer | 400px desktop, full mobile. ESC/click-outside closes. ≤300ms. Host unaffected. |
| Shadow DOM | Page with Bootstrap/Tailwind reset → component styles intact. |
| Security | XSS payload in markdown → sanitized by DOMPurify. npm audit clean. |
| Publish | `npm install @evidenceone/chat-widget` works. CDN script tag works. `dist/` only in package (no source). |

---

## 6. Implementation Phases

| # | Phase | Description | Status | Depends on |
|---|-------|-------------|--------|------------|
| 1 | Project scaffold | StencilJS project, build config, Shadow DOM, inline button, drawer skeleton, `prepublishOnly` script. | pending | — |
| 2 | API integration | auth.service (register + session), token.ts (expiry check), sse.service (ReadableStream parser). | pending | 1 |
| 3 | Chat UI | eo-message-list, eo-message-bubble, eo-chat-input, eo-chat-header, eo-loading. marked + DOMPurify. Branding. | pending | 2 |
| 4 | Polish + publish | Error handling, mobile responsive, animations, new-session prop, hide-button, show()/hide(), CSS vars, events. npm publish, CDN, README with CORS/CSP docs. | pending | 3 |

---

## 7. Decisoes

| Decisao | Escolha | Alternativa descartada | Motivo |
|---------|---------|------------------------|--------|
| Framework | StencilJS (Web Components) | React, iframe | Works in any framework. Shadow DOM. No runtime. DAAI validated. |
| Isolation | Shadow DOM | CSS modules, iframe | True isolation. Partner CSS can't reach inside. |
| Auth | API key + session JWT | Cognito, cookies | Doctor has no Cognito in partner flow. Stateless. |
| API key exposure | Key is partner identifier, not secret. Server-side protection (CORS + rate limit + revocation). | Proxy/server-side key injection | Every B2B client component (DAAI, Stripe, Intercom) exposes the key as an attribute. Server enforcement is the real security. |
| Token storage | In-memory only | localStorage | Security. Partner JS could read storage. In-memory dies with component. Re-auth is cheap. |
| SSE | fetch + ReadableStream | EventSource | EventSource is GET-only. Partner chat is POST. |
| Markdown | `marked` (8kb) + `dompurify` (7kb) | Hand-rolled parser, `{ sanitize: true }` | `marked` removed sanitize option in v4+. DOMPurify is the standard XSS prevention for rendered HTML. Hand-rolled parser would miss edge cases. ~15kb total is acceptable. |
| Button | Inline (partner places tag) | FAB (fixed position) | Partner controls placement. Drawer is overlay. |
| Package | `@evidenceone/chat-widget` (public) | Private/scoped access | Partners install via `npm i` without requesting access. Public package. |
| Publishing | Manual `npm publish` for MVP | GitHub Actions CI/CD | <5 partners. `prepublishOnly` script enforces build + audit + test. CI/CD deferred. |
