# @evidenceone/chat-widget

[![npm version](https://img.shields.io/npm/v/@evidenceone/chat-widget.svg)](https://www.npmjs.com/package/@evidenceone/chat-widget)
[![license](https://img.shields.io/npm/l/@evidenceone/chat-widget.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@evidenceone/chat-widget)](https://bundlephobia.com/package/@evidenceone/chat-widget)

EvidenceOne Case Brasil chat as an embeddable web component. Drop it into any web application — React, Vue, Angular, Next.js, or plain HTML — and get a streaming doctor consultation drawer with zero style bleed.

- **Framework-agnostic** — one custom element, works everywhere
- **Shadow DOM** — your CSS never touches the widget, the widget's CSS never touches your page
- **Streaming responses** — Server-Sent Events with incremental tokens
- **Zero client persistence** — no cookies, no `localStorage`, tokens live in memory only
- **Portuguese UI** — all user-facing text in Brazilian Portuguese
- **Minimal dependencies** — only `marked` and `dompurify`

## Table of contents

- [Installation](#installation)
- [Integration modes](#integration-modes)
- [Quick start (`client_provided`)](#quick-start-client_provided)
- [Props](#props)
- [Events](#events)
- [CSS customization](#css-customization)
- [Framework examples](#framework-examples)
- [Advanced: gateway partners](#advanced-gateway-partners)
- [TypeScript](#typescript)
- [CORS / domain registration](#cors--domain-registration)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Error codes](#error-codes)
- [Browser support](#browser-support)
- [Integrating with an AI agent](#integrating-with-an-ai-agent)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Installation

### NPM

```bash
npm install @evidenceone/chat-widget
```

Then register it once at your app's entry point using the **custom-elements build** — it
compiles the component into your app bundle, with no runtime chunk fetching:

```javascript
import { defineCustomElement as defineEvidenceOneChat } from '@evidenceone/chat-widget/components/evidenceone-chat';
defineEvidenceOneChat();
```

This registers `<evidenceone-chat>` and its nested components globally — use the tag anywhere in
your markup. Do **not** use `@evidenceone/chat-widget/loader` (`defineCustomElements`) in a
bundled app: it lazy-fetches a `.entry.js` chunk at runtime that bundlers can't emit, so it
404s once deployed (works in `dev`, breaks in production). The `/loader` build is only for the
CDN / plain-HTML path.

### CDN

```html
<script
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js"
  type="module"
></script>
```

Pin a specific version in production:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@3.0.0/dist/evidenceone-chat/evidenceone-chat.esm.js"
  type="module"
></script>
```

## Integration modes

The widget supports two ways of telling EvidenceOne *who the doctor is*. Pick one:

- **`client_provided` (recommended)** — your app already knows the doctor, so you pass their data directly via the `doctor-*` props. No backend integration with EvidenceOne is required beyond the API key. **This is the path almost every partner should use** — start here.
- **`partner_gateway` (advanced)** — your backend issues an opaque `partner-token` and EvidenceOne resolves the doctor from a server-side gateway you operate. Use this **only** when you cannot expose the doctor's fields on the client. See [Advanced: gateway partners](#advanced-gateway-partners).

## Quick start (`client_provided`)

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <script
      src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js"
      type="module"
    ></script>
  </head>
  <body>
    <evidenceone-chat
      api-key="eo_live_..."
      api-url="https://<evidenceone-api-base>/v1"
      doctor-name="Dr. João Silva"
      doctor-email="joao@hospital.com"
      doctor-crm="123456/SP"
      doctor-phone="21999999999"
    ></evidenceone-chat>
  </body>
</html>
```

The navy EvidenceOne circle (E1 mark) pins to the bottom-right corner of the viewport; hovering it reveals the "Consultar EvidenceOne" label. Clicking it slides a drawer in from the same edge and authenticates the doctor automatically. Prefer a button in your page's flow instead? Use `variant="inline"`.

> **`api-url`:** EvidenceOne provides your API base URLs (production and staging) during onboarding — the value always ends in `/v1`. The `https://<evidenceone-api-base>/v1` in the examples is a placeholder.

That's the whole integration. If the doctor's data is incomplete, the widget handles it itself — see [Incomplete profile (blocked state)](#incomplete-profile-blocked-state); you do **not** need a host-side completeness gate.

## Props

| Prop                | Type                       | Required | Default      | Description                                                                  |
| ------------------- | -------------------------- | -------- | ------------ | ---------------------------------------------------------------------------- |
| `api-key`           | string                     | Yes      | —            | Partner API key provided during onboarding                                   |
| `api-url`           | string                     | Yes      | —            | Base URL of the EvidenceOne API (e.g. `https://<evidenceone-api-base>/v1`)   |
| `doctor-name`       | string                     | Yes¹     | —            | Doctor's full name                                                           |
| `doctor-email`      | string                     | Yes¹     | —            | Doctor's email address                                                       |
| `doctor-crm`        | string                     | Yes¹     | —            | Doctor's CRM registration (e.g. `123456/SP`)                                 |
| `doctor-phone`      | string                     | Yes¹     | —            | Doctor's phone number (digits only, e.g. `21999999999`)                      |
| `doctor-specialty`  | string                     | No       | —            | Doctor's specialty                                                           |
| `partner-token`     | string                     | No¹      | —            | **Advanced (`partner_gateway`).** Opaque token for gateway partners. When set, the server resolves the doctor profile from the partner's gateway and the `doctor-*` props are not required. See [Advanced: gateway partners](#advanced-gateway-partners). |
| `partner-lookup`    | string                     | No       | —            | **Advanced (`partner_gateway`).** Generic lookup value (id, email, name — partner decides) keyed into a `{lookup}`-templated gateway URL server-side. Gateway mode only. |
| `new-session`       | boolean                    | No       | `false`      | Force a new session every time the drawer opens                              |
| `button-size`       | `'sm' \| 'md' \| 'lg'`     | No       | `'md'`       | Trigger button size. Unknown values fall back to `'md'`.                     |
| `placement`         | `'right' \| 'left'`        | No       | `'right'`    | Viewport edge the floating trigger pins to and the drawer slides from. Ignored when `variant="inline"`. |
| `variant`           | `'floating' \| 'inline'`   | No       | `'floating'` | Trigger style. `'floating'` pins the navy E1-mark circle to a viewport corner — hover reveals the "Consultar EvidenceOne" pill; `'inline'` renders the static navy E1 pill in document flow where you place the tag. |

> ¹ **Identity is supplied one of two ways.** Most partners pass the doctor's data directly via the `doctor-*` props (all required). Partners integrated through a **server-side gateway** instead pass a single opaque `partner-token` — the server then fetches the doctor profile from the partner's gateway, and the `doctor-*` props are not needed. Provide one or the other.

> All props are reactive. Updating `api-key` or `api-url` at runtime rebuilds the internal auth/chat clients and resets session state. Updating `partner-token` does **not** reset an active session — the latest token is used on the next authentication round-trip, so a rotating token (e.g. Keycloak refreshing each minute) won't interrupt an in-flight chat.

### Incomplete profile (blocked state)

The doctor's profile must be complete (name, email, CRM, phone) before a session is created. When the data the partner supplied is incomplete — or, in gateway mode, the gateway returns a non-doctor / unreachable profile — the widget **does not start a session**. Instead it shows a "Cadastro incompleto" message with a **Tentar novamente** button and emits the [`eoBlocked`](#events) event with the missing fields.

This is re-checked **on every open**: nothing is cached. Once the doctor's data is completed on the partner side, the next open (or the retry button) authorizes normally.

Because the widget owns this state, **you do not need a host-side completeness gate**. Mount the widget for your intended audience and let it handle incomplete data — it will never start a session with a partial profile.

## Events

All events bubble and are `CustomEvent` instances. Event names are camelCase.

| Event       | Payload                               | When                                                               |
| ----------- | ------------------------------------- | ------------------------------------------------------------------ |
| `eoReady`   | `{ sessionId: string }`               | After the partner session is created                               |
| `eoBlocked` | `{ missing: string[] }`               | The doctor's profile is incomplete — the widget shows a block message instead of the chat. `missing` lists the fields still needed. Re-checked on every open. |
| `eoError`   | `{ code: string; message: string }`   | On authentication failure (invalid/revoked key, network, 5xx)      |
| `eoClose`   | `void`                                | When the drawer closes (ESC, backdrop, or the X button)            |

```javascript
const widget = document.querySelector('evidenceone-chat');

widget.addEventListener('eoReady', (e) => {
  console.log('Session started:', e.detail.sessionId);
});

widget.addEventListener('eoBlocked', (e) => {
  // Profile incomplete — e.g. send the doctor to finish their registration.
  console.warn('Blocked, missing fields:', e.detail.missing);
});

widget.addEventListener('eoError', (e) => {
  console.error('Auth failed:', e.detail.code, e.detail.message);
});

widget.addEventListener('eoClose', () => {
  console.log('Drawer closed');
});
```

## Customization

The widget renders as EvidenceOne everywhere it's embedded. To preserve brand integrity across partners, visual customization is **enum-only** — there are no CSS custom properties or stylesheet hooks. The customization surface is exhausted by three typed props:

```html
<evidenceone-chat
  api-key="..."
  api-url="..."
  doctor-name="..."
  doctor-email="..."
  doctor-crm="..."
  doctor-phone="..."
  button-size="md"
  placement="right"
  variant="floating"
></evidenceone-chat>
```

### Variants

- **`variant="floating"`** (default) — The navy E1-mark circle pins to the bottom-right (or bottom-left, via `placement="left"`) corner of the viewport. Hovering or focusing it slides out the "Consultar EvidenceOne" pill toward the inside of the screen. Clicking it slides the chat drawer in from the same edge.
- **`variant="inline"`** — A horizontal navy pill with the E1 mark + label renders in document flow at the exact spot you place the `<evidenceone-chat>` tag. No hover animation, no auto-positioning. Clicking it opens the drawer (always from the right). Use this when you want the trigger to sit beside other UI in a normal stacking context.

### Sizes

`button-size` accepts `'sm'`, `'md'`, or `'lg'`. Each variant has three pre-designed size variants — unknown values silently fall back to `'md'`.

### What you cannot customize

Colors, fonts, spacing, the logo, the brand text, the drawer chrome, the message-list styling, the input, and every other visual surface live inside Shadow DOM and are not exposed. Internal tokens are scoped to `.eo-scope` inside the shadow root, so partner stylesheets cannot leak in via CSS custom properties or inheritance. The logo SVG is hashed at build time and verified at runtime; if a partner modifies it (DOM injection, byte-patched bundle), the widget refuses to authenticate against the EvidenceOne API.

### Pinning the bundle (recommended for CDN users)

If you load the widget from a CDN, pin the version and add Subresource Integrity. Browsers refuse to execute a tampered script when `integrity` is present:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@3.0.0/dist/evidenceone-chat/evidenceone-chat.esm.js"
  integrity="sha384-<published-per-release>"
  crossorigin="anonymous"
></script>
```

The `integrity` value is published with each EvidenceOne release. Treat any version without one as a development dependency only.

## Framework examples

### React

```tsx
import { useEffect } from 'react';

export function App() {
  useEffect(() => {
    import('@evidenceone/chat-widget/components/evidenceone-chat').then((m) => m.defineCustomElement());
  }, []);

  return (
    <evidenceone-chat
      api-key="eo_live_..."
      api-url="https://<evidenceone-api-base>/v1"
      doctor-name="Dr. João"
      doctor-email="joao@hospital.com"
      doctor-crm="123456/SP"
      doctor-phone="21999999999"
    />
  );
}
```

For TypeScript in React, you may need to declare the element — see [TypeScript](#typescript).

### Vue 3

```vue
<script setup>
import { defineCustomElement as defineEvidenceOneChat } from '@evidenceone/chat-widget/components/evidenceone-chat';
defineEvidenceOneChat();
</script>

<template>
  <evidenceone-chat
    api-key="eo_live_..."
    api-url="https://<evidenceone-api-base>/v1"
    doctor-name="Dr. João"
    doctor-email="joao@hospital.com"
    doctor-crm="123456/SP"
    doctor-phone="21999999999"
  />
</template>
```

In `vite.config.js`, tell Vue to treat the tag as a custom element:

```javascript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('evidenceone-') || tag.startsWith('eo-'),
        },
      },
    }),
  ],
});
```

### Angular

In the module where you use the widget:

```typescript
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { defineCustomElement as defineEvidenceOneChat } from '@evidenceone/chat-widget/components/evidenceone-chat';

defineEvidenceOneChat();

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

```html
<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://<evidenceone-api-base>/v1"
  doctor-name="Dr. João"
  doctor-email="joao@hospital.com"
  doctor-crm="123456/SP"
  doctor-phone="21999999999"
></evidenceone-chat>
```

### Next.js (App Router)

The widget touches the DOM, so load it inside a client component:

```tsx
'use client';

import { useEffect } from 'react';

export default function Chat() {
  useEffect(() => {
    import('@evidenceone/chat-widget/components/evidenceone-chat').then((m) => m.defineCustomElement());
  }, []);

  return (
    <evidenceone-chat
      api-key="eo_live_..."
      api-url="https://<evidenceone-api-base>/v1"
      doctor-name="Dr. João"
      doctor-email="joao@hospital.com"
      doctor-crm="123456/SP"
      doctor-phone="21999999999"
    />
  );
}
```

## Advanced: gateway partners

> **Most partners do not need this.** If your app can supply the `doctor-*` props, use [`client_provided`](#quick-start-client_provided) and skip this section. `partner_gateway` exists only for integrations that cannot expose the doctor's fields client-side and instead resolve them through a server-side gateway.

In `partner_gateway` mode you pass a single opaque `partner-token` (issued by **your** backend) instead of the `doctor-*` props. EvidenceOne calls your configured gateway with that token and resolves the doctor profile server-side:

```html
<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://<evidenceone-api-base>/v1"
  partner-token="<opaque-token-from-your-backend>"
></evidenceone-chat>
```

If your gateway URL is keyed by an identifier — a `{lookup}` placeholder configured server-side (a user id, email, name; whatever your gateway expects) — pass that value via `partner-lookup`:

```html
<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://<evidenceone-api-base>/v1"
  partner-token="<opaque-token-from-your-backend>"
  partner-lookup="<doctor-id-or-email-from-your-client>"
></evidenceone-chat>
```

`partner-token` is read live, so a rotating token (e.g. Keycloak refreshing every minute) is picked up on the next authentication round-trip without resetting an in-flight session. Gateway provisioning (the profile URL, the `{lookup}` template, auth headers) is configured on the EvidenceOne side during onboarding — contact the partner team.

## TypeScript

The package ships full type definitions. Import types from the package root:

```typescript
import type { EoErrorDetail } from '@evidenceone/chat-widget';
```

### React + TypeScript

Declare the custom element so JSX knows about the tag and its props:

```typescript
// src/evidenceone-chat.d.ts
import type { JSX as EoJSX } from '@evidenceone/chat-widget/loader';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'evidenceone-chat': EoJSX.IntrinsicElements['evidenceone-chat'] &
        React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
```

## CORS / domain registration

During onboarding, register your production and staging domains with EvidenceOne. The API rejects requests from unregistered origins via CORS policy.

Contact the EvidenceOne partner team to add or update allowed origins.

## Content Security Policy (CSP)

If your application enforces a CSP, add these directives:

```
connect-src <the EvidenceOne API origin from onboarding>
script-src  https://cdn.jsdelivr.net   # only if loading via CDN
```

Replace the domains if you consume a different API URL or CDN.

## Error codes

Emitted on the `eoError` event. `detail.code` is machine-readable; `detail.message` is localized Portuguese for UI display.

| Code          | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `AUTH_FAILED` | Session creation failed (invalid key, revoked key, CORS, rate limit, 5xx)   |

An **incomplete doctor profile is not an error** — it does not emit `eoError`. The widget emits [`eoBlocked`](#events) (`{ missing }`) and shows the block state instead. Stream-level errors from the chat endpoint are surfaced inline inside the message bubble (red border, `!` retry icon) and do not emit `eoError`.

## Browser support

The widget targets evergreen browsers with native Web Components, `fetch`, and `ReadableStream` support.

| Browser         | Minimum version |
| --------------- | --------------- |
| Chrome / Edge   | 90+             |
| Firefox         | 90+             |
| Safari          | 15+             |
| iOS Safari      | 15+             |

No polyfills are shipped. If you need to support older browsers, load polyfills for Web Components and `fetch` before the widget script.

## Integrating with an AI agent

If you're wiring this widget in with an AI coding agent (Cursor, Copilot, Claude Code), point
it at the machine-readable guide that ships with the package:

- **[`INTEGRATION.md`](./INTEGRATION.md)** — the single source of truth: the `doctor-*`
  contract, the `client_provided` flow, props/events, framework snippets, and an
  audience-gating worked example. Available after install at
  `node_modules/@evidenceone/chat-widget/INTEGRATION.md` and over CDN at
  `https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/INTEGRATION.md`.
- **[`AGENTS.md`](./AGENTS.md)** — a condensed operating manual agents read from the package
  root; it points to `INTEGRATION.md`.
- **`llms.txt`** — a retrieval index at
  `https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/llms.txt` for agents told to
  "integrate `@evidenceone/chat-widget`".

These exist because an agent's training data lags this package's API; the shipped docs keep it
current. They are not an MCP server (a possible future enhancement).

## Security

The `api-key` attribute is visible in the browser inspector — this is standard for client-side B2B components (Stripe publishable keys, Intercom app IDs, etc.). The key is a **partner identifier**, not a server secret.

Server-side protections:

- **CORS** — only registered domains can make requests
- **Rate limiting** — daily query cap per partner
- **Revocation** — admins can invalidate a key instantly
- **JWT expiry** — session tokens expire after 1 hour; the widget re-authenticates silently
- **No persistence** — tokens never touch `localStorage`, `sessionStorage`, cookies, or `IndexedDB`
- **XSS defense** — assistant markdown is rendered through `marked` + `dompurify`; unsafe HTML is stripped

Do not commit your API key to public repositories. Use environment variables in your build pipeline and inject it at runtime.

## Troubleshooting

**`AUTH_FAILED: Invalid or revoked API key`**
Your key is wrong, expired, or revoked. Confirm the key string and contact the EvidenceOne partner team.

**`AUTH_FAILED: Failed to fetch`**
The API URL is unreachable — usually a typo in `api-url`, a CORS block from an unregistered domain, or a network outage. Open DevTools → Network and check the `/partner/session` request.

**Drawer opens but shows "Não foi possível conectar."**
The authentication request returned a 4xx/5xx. Inspect the response in DevTools; the message under the banner echoes the server error.

**Drawer opens but shows "Cadastro incompleto"**
The server returned `422 PROFILE_INCOMPLETE` — the doctor's profile is missing required fields (or, in gateway mode, the gateway returned a non-doctor / unreachable profile). Listen to the `eoBlocked` event for the `missing` field names, complete the doctor's data on the partner side, then reopen or use **Tentar novamente**.

**Messages send but nothing streams**
The `/partner/chat` endpoint is failing mid-stream. Retry via the red "!" icon in the assistant bubble, or open a new session.

**Assistant bubble shows a red border**
The SSE stream broke before completion. Click the `!` icon to resend that specific message.

**Widget styles look off**
The widget uses Shadow DOM — your global CSS cannot reach it. If something looks wrong, it's a widget issue, not yours. [Open an issue](https://github.com/EvidenceOne/evidenceone-chat-widget/issues).

## Development

### Requirements

- Node 18+
- NPM 9+

### Setup

```bash
git clone https://github.com/EvidenceOne/evidenceone-chat-widget.git
cd evidenceone-chat-widget
npm install
```

### Scripts

```bash
npm run build       # Build dist/
npm start           # Dev server with hot reload
npm test            # Run Vitest unit tests
npm run test:watch  # Tests in watch mode
```

### Local testing against a running server

See [`docs/guides/local-testing.md`](./docs/guides/local-testing.md) for the full walkthrough — spinning up the NestJS API, seeding an API key, and pointing the widget at `localhost`.

### Project structure

```
src/
├── components/           # StencilJS web components
├── services/             # Auth, chat, SSE services (framework-agnostic)
├── models/types.ts       # Shared TypeScript types
├── utils/                # Pure functions: token, markdown, focus-trap, etc.
└── assets/               # Inlined SVG logos and icons
```

### Publishing

Maintainers: see the [Publishing checklist](#publishing-to-npm) below.

## Publishing to NPM

1. Confirm `main`, `version`, tests pass, and `CHANGELOG.md` is up to date.
2. Bump the version: `npm version patch|minor|major`.
3. `npm publish` — `prepublishOnly` runs `build + audit + test` automatically.
4. Push tags: `git push --follow-tags`.

```bash
npm version minor
npm publish
git push --follow-tags
```

The `files` field restricts the published tarball to `dist/`, `loader/`, `LICENSE`, `README.md`, and `CHANGELOG.md`.

## License

[MIT](./LICENSE) © EvidenceOne
