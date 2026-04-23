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
- [Quick start](#quick-start)
- [Props](#props)
- [Events](#events)
- [Methods](#methods)
- [CSS customization](#css-customization)
- [Framework examples](#framework-examples)
- [Custom trigger button](#custom-trigger-button)
- [TypeScript](#typescript)
- [CORS / domain registration](#cors--domain-registration)
- [Content Security Policy (CSP)](#content-security-policy-csp)
- [Error codes](#error-codes)
- [Browser support](#browser-support)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Installation

### NPM

```bash
npm install @evidenceone/chat-widget
```

Then import it once at your app's entry point:

```javascript
import '@evidenceone/chat-widget';
```

The first import registers the `<evidenceone-chat>` custom element globally. You can then use the tag anywhere in your markup.

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
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@1.0.0/dist/evidenceone-chat/evidenceone-chat.esm.js"
  type="module"
></script>
```

## Quick start

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
      api-url="https://api.evidenceone.com.br/v1"
      doctor-name="Dr. João Silva"
      doctor-email="joao@hospital.com"
      doctor-crm="123456/SP"
      doctor-phone="21999999999"
    ></evidenceone-chat>
  </body>
</html>
```

A green "Consultar EvidenceOne" button appears inline where you placed the tag. Clicking it slides a drawer in from the right and authenticates the doctor automatically.

## Props

| Prop                | Type    | Required | Default | Description                                                                  |
| ------------------- | ------- | -------- | ------- | ---------------------------------------------------------------------------- |
| `api-key`           | string  | Yes      | —       | Partner API key provided during onboarding                                   |
| `api-url`           | string  | Yes      | —       | Base URL of the EvidenceOne API (e.g. `https://api.evidenceone.com.br/v1`)   |
| `doctor-name`       | string  | Yes      | —       | Doctor's full name                                                           |
| `doctor-email`      | string  | Yes      | —       | Doctor's email address                                                       |
| `doctor-crm`        | string  | Yes      | —       | Doctor's CRM registration (e.g. `123456/SP`)                                 |
| `doctor-phone`      | string  | Yes      | —       | Doctor's phone number (digits only, e.g. `21999999999`)                      |
| `doctor-specialty`  | string  | No       | —       | Doctor's specialty                                                           |
| `new-session`       | boolean | No       | `false` | Force a new session every time the drawer opens                              |
| `hide-button`       | boolean | No       | `false` | Hide the built-in trigger button (use `show()` / `hide()` instead)           |

> All props are reactive. Updating `api-key` or `api-url` at runtime rebuilds the internal auth/chat clients and resets session state.

## Events

All events bubble and are `CustomEvent` instances. Event names are camelCase.

| Event     | Payload                               | When                                                               |
| --------- | ------------------------------------- | ------------------------------------------------------------------ |
| `eoReady` | `{ sessionId: string }`               | After successful authentication (register + session)               |
| `eoError` | `{ code: string; message: string }`   | On authentication failure                                          |
| `eoClose` | `void`                                | When the drawer closes (ESC, backdrop, X button, or `hide()`)      |

```javascript
const widget = document.querySelector('evidenceone-chat');

widget.addEventListener('eoReady', (e) => {
  console.log('Session started:', e.detail.sessionId);
});

widget.addEventListener('eoError', (e) => {
  console.error('Auth failed:', e.detail.code, e.detail.message);
});

widget.addEventListener('eoClose', () => {
  console.log('Drawer closed');
});
```

## Methods

Both methods return promises and can be awaited.

```javascript
const widget = document.querySelector('evidenceone-chat');

await widget.show(); // Open the drawer and authenticate (idempotent — reuses valid tokens)
await widget.hide(); // Close the drawer
```

## CSS customization

Only the trigger button's colors are customizable. All drawer, message list, and input styles live inside Shadow DOM and are not exposed — this guarantees the widget always looks the same across partners.

```css
evidenceone-chat {
  --eo-button-color: #51c878;       /* Trigger button background */
  --eo-button-text-color: #ffffff;  /* Trigger button text       */
}
```

Internal tokens (colors, fonts, spacing) are scoped to the widget's `.eo-scope` container, so partner stylesheets cannot leak in.

## Framework examples

### React

```tsx
import { useEffect } from 'react';

export function App() {
  useEffect(() => {
    import('@evidenceone/chat-widget');
  }, []);

  return (
    <evidenceone-chat
      api-key="eo_live_..."
      api-url="https://api.evidenceone.com.br/v1"
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
import '@evidenceone/chat-widget';
</script>

<template>
  <evidenceone-chat
    api-key="eo_live_..."
    api-url="https://api.evidenceone.com.br/v1"
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
import '@evidenceone/chat-widget';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

```html
<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://api.evidenceone.com.br/v1"
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
    import('@evidenceone/chat-widget');
  }, []);

  return (
    <evidenceone-chat
      api-key="eo_live_..."
      api-url="https://api.evidenceone.com.br/v1"
      doctor-name="Dr. João"
      doctor-email="joao@hospital.com"
      doctor-crm="123456/SP"
      doctor-phone="21999999999"
    />
  );
}
```

## Custom trigger button

Hide the built-in button and open the drawer from your own UI:

```html
<evidenceone-chat
  id="eo"
  hide-button
  api-key="eo_live_..."
  api-url="https://api.evidenceone.com.br/v1"
  doctor-name="Dr. João"
  doctor-email="joao@hospital.com"
  doctor-crm="123456/SP"
  doctor-phone="21999999999"
></evidenceone-chat>

<button onclick="document.getElementById('eo').show()">
  Abrir consulta
</button>
```

When the drawer closes, focus returns to the element that triggered `show()` — so keyboard users stay exactly where they left off.

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
connect-src https://api.evidenceone.com.br
script-src  https://cdn.jsdelivr.net   # only if loading via CDN
```

Replace the domains if you consume a different API URL or CDN.

## Error codes

Emitted on the `eoError` event. `detail.code` is machine-readable; `detail.message` is localized Portuguese for UI display.

| Code          | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `AUTH_FAILED` | Register or session creation failed (invalid key, revoked key, CORS, 5xx)   |

Stream-level errors from the chat endpoint are surfaced inline inside the message bubble (red border, `!` retry icon) and do not emit `eoError`.

## Browser support

The widget targets evergreen browsers with native Web Components, `fetch`, and `ReadableStream` support.

| Browser         | Minimum version |
| --------------- | --------------- |
| Chrome / Edge   | 90+             |
| Firefox         | 90+             |
| Safari          | 15+             |
| iOS Safari      | 15+             |

No polyfills are shipped. If you need to support older browsers, load polyfills for Web Components and `fetch` before the widget script.

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
The API URL is unreachable — usually a typo in `api-url`, a CORS block from an unregistered domain, or a network outage. Open DevTools → Network and check the `/partner/register` request.

**Drawer opens but shows "Não foi possível conectar."**
The authentication request returned a 4xx/5xx. Inspect the response in DevTools; the message under the banner echoes the server error.

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
