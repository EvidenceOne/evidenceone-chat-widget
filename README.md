# @evidenceone/chat-widget

EvidenceOne Case Brasil chat as a web component. Install and embed a doctor consultation chat in any web application.

Shadow DOM isolates the widget's styles from your page — no CSS conflicts. Works in React, Vue, Angular, Next.js, or plain HTML.

## Installation

```bash
npm install @evidenceone/chat-widget
```

Or via CDN:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js"
  type="module"
></script>
```

## Quick Start

```html
<!DOCTYPE html>
<html>
  <head>
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

## Props

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `api-key` | string | Yes | — | Partner API key provided during onboarding |
| `api-url` | string | Yes | — | Base URL of the EvidenceOne API (e.g. `https://api.evidenceone.com.br/v1`) |
| `doctor-name` | string | Yes | — | Doctor's full name |
| `doctor-email` | string | Yes | — | Doctor's email address |
| `doctor-crm` | string | Yes | — | Doctor's CRM registration (e.g. `123456/SP`) |
| `doctor-phone` | string | Yes | — | Doctor's phone number |
| `doctor-specialty` | string | No | — | Doctor's specialty (optional) |
| `new-session` | boolean | No | `false` | Force a new session every time the drawer opens |
| `hide-button` | boolean | No | `false` | Hide the built-in trigger button (use `show()`/`hide()` instead) |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `eoReady` | `{ sessionId: string }` | After successful authentication |
| `eoError` | `{ code: string; message: string }` | On authentication failure |
| `eoClose` | `void` | When the drawer closes (ESC, backdrop click, X button, or `hide()`) |

```javascript
const widget = document.querySelector('evidenceone-chat');
widget.addEventListener('eoReady', (e) => {
  console.log('Session started:', e.detail.sessionId);
});
widget.addEventListener('eoError', (e) => {
  console.error('Auth failed:', e.detail.code, e.detail.message);
});
```

## Methods

```javascript
const widget = document.querySelector('evidenceone-chat');
await widget.show(); // Open drawer + authenticate
await widget.hide(); // Close drawer
```

## CSS Customization

Only the trigger button's colors are customizable. All other styles are locked inside Shadow DOM.

```css
evidenceone-chat {
  --eo-button-color: #51c878; /* Trigger button background */
  --eo-button-text-color: #ffffff; /* Trigger button text */
}
```

## Framework Examples

### React

```tsx
import '@evidenceone/chat-widget';

export function App() {
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

### Vue

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

### Next.js

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

## Custom Trigger Button

Hide the built-in button and control the drawer programmatically:

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
  Consultar EvidenceOne
</button>
```

## CORS / Domain Registration

During onboarding, register your domain with EvidenceOne so the API accepts requests from your application. Without domain registration, requests will be rejected by CORS policy.

## Content Security Policy (CSP)

If your application enforces CSP headers, add the following directives:

```
connect-src: {your api-url domain}  (e.g. https://api.evidenceone.com.br)
script-src: cdn.jsdelivr.net        (only if loading via CDN)
```

## Security

The `api-key` attribute is visible in the browser inspector — this is standard for all client-side B2B components (Stripe, Intercom, etc.). The API key is a **partner identifier**, not a secret.

Server-side protections:
- **CORS**: only registered domains can make requests
- **Rate limiting**: daily query cap per partner
- **Revocation**: admin can revoke a key instantly
- **JWT expiry**: session tokens expire after 1 hour

Do not commit your API key to public repositories.

## License

MIT
