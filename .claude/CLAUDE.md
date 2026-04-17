# EvidenceOne Chat Widget — Claude Code Context

## Project

`@evidenceone/chat-widget` — StencilJS web component for B2B partners to embed EvidenceOne's Case Brasil chat as a drawer. Published on NPM, usable via CDN. Shadow DOM for style isolation.

## Stack

- StencilJS → native Web Components
- TypeScript strict
- Shadow DOM (style isolation)
- Native fetch + ReadableStream (SSE)
- `marked` + `dompurify` (markdown rendering + XSS prevention)
- Vanilla CSS

## File Structure

```
src/
├── components/
│   ├── evidenceone-chat/     # Root component (<evidenceone-chat> tag)
│   ├── eo-drawer/            # Overlay panel (slides from right)
│   ├── eo-chat/              # Chat container
│   ├── eo-message-list/      # Scrollable message list
│   ├── eo-message-bubble/    # Individual bubble (user/assistant)
│   ├── eo-chat-input/        # Textarea + send button
│   ├── eo-chat-header/       # Logo + close + new session
│   └── eo-loading/           # Streaming indicator
├── services/
│   ├── auth.service.ts       # Register + session + token management
│   ├── chat.service.ts       # POST /partner/chat (SSE)
│   └── sse.service.ts        # SSE parsing from ReadableStream
├── models/
│   └── types.ts              # Props, events, message types
├── utils/
│   └── token.ts              # JWT decode, expiry check
└── assets/                   # EvidenceOne logo + icons (inlined SVG)
```

## Key Constraints

1. **No FAB.** Inline button where partner places the tag. Drawer is overlay (fixed position).
2. **Shadow DOM required.** Every component uses `shadow: true`. See `stencil-discipline` skill.
3. **Token in memory only.** Never `localStorage`, `sessionStorage`, `cookies`, or `IndexedDB`.
4. **No `mode` in chat requests.** The agent decides autonomously — partners never pass one.
5. **`apiUrl` is required.** No default value ever.
6. **Minimal deps.** Only `marked` and `dompurify`. Every new dep needs explicit justification.
7. **Portuguese UI text.** All user-facing strings in Brazilian Portuguese.

## Brand Colors

```css
--eo-green: #51C878;   --eo-dark: #1d1d1b;    --eo-white: #FFFFFF;
--eo-gray-100: #F5F5F5; --eo-gray-200: #E5E5E5; --eo-gray-500: #888888; --eo-gray-800: #333333;
```

Logo: "Evidence" in `#1d1d1b` + "One." in `#51C878`

## Skills

- `stencil-discipline` — component pattern, Shadow DOM, CSS, Functional Core, markdown rendering
- `sse-protocol` — auth flow, SSE event types, token handling, streaming
- `tdd` — where and how to apply TDD: services, pure functions, state logic (not component rendering)
- `code-review` — full code review against all project disciplines: Stencil, Functional Core, security, a11y, concurrency, CSS tokens, spec compliance. Reports findings — does not auto-fix.

## Commands

- `/break` — break spec into issues
- `/plan` — plan an issue
- `/execute` — implement an issue
- `/publish` — pre-publish checklist + npm publish

## Testing

```bash
npm run build    # StencilJS builds dist/
npm test         # Component unit tests
npm audit        # No high/critical vulnerabilities
```

To manually test in a browser: create `test/index.html` loading `../dist/evidenceone-chat/evidenceone-chat.esm.js`, place `<evidenceone-chat>` with test props, serve with `npx serve test/`.

## Publishing

```bash
npm version patch|minor|major
npm publish --access public
# CDN: https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js
```

## Reference

- Spec: `docs/specs/spec-evidenceone-chat-widget.md`
- Issues: `docs/issues/` — `status.md` tracks progress
- DAAI reference: https://github.com/doctor-assistant/daai-component (Shadow DOM + CDN pattern)
- Server endpoints: `POST /v1/partner/register`, `/session`, `/chat`
