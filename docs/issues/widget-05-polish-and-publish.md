# Issue 05: Polish, CSS Vars, README & Publish

## Description
Final hardening before publish: CSS custom property API for partner theming, mobile responsiveness, animations, error UX, `npm audit` clean, README with framework examples. After this issue the package is ready for `npm publish --access public`.

## Dependencies
- [ ] Issue 04 (integration) — full feature working end-to-end

## Files to Create/Modify

### New Files
- `README.md`

### Modified Files
- `src/components/evidenceone-chat/evidenceone-chat.css` — CSS var API
- `src/components/eo-drawer/eo-drawer.css` — animation polish, mobile
- `src/components/eo-chat/eo-chat.css` — error bar, auth loading
- `src/components/eo-chat-input/eo-chat-input.css` — auto-expand textarea
- `package.json` — confirm version 1.0.0, `"files": ["dist/"]`

## Implementation Details

### CSS Custom Properties (Partner Theming)

Expose on the host element `<evidenceone-chat>`:
```css
/* evidenceone-chat.css */
:host {
  --eo-button-color: #51C878;
  --eo-button-text-color: #FFFFFF;
}

.eo-trigger-btn {
  background-color: var(--eo-button-color);
  color: var(--eo-button-text-color);
  /* other styles locked — no partner override */
}
```

Partner usage:
```css
evidenceone-chat {
  --eo-button-color: #005fcc;
  --eo-button-text-color: #fff;
}
```

These two vars are the ONLY partner-exposed customization. Everything else is locked inside Shadow DOM.

### Drawer Animation Polish

Ensure `≤300ms` transition — spec requirement:
```css
.eo-drawer {
  transition: transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
}
.eo-backdrop {
  transition: opacity 200ms ease;
}
```

### Mobile Full-screen

Already in drawer CSS from Issue 01, verify:
```css
@media (max-width: 767px) {
  .eo-drawer {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}
```

Minimum viewport note: 360px — no horizontal scroll at 360px.

### Textarea Auto-expand (max 4 lines)

In `eo-chat-input.tsx`:
```typescript
private handleInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;
  this.value = textarea.value;
  // Reset then grow
  textarea.style.height = 'auto';
  const lineHeight = 24; // px
  const maxHeight = lineHeight * 4;
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
}
```

### Error Bar Styling

In `eo-chat.css`:
```css
.eo-error-bar {
  background: #FEF2F2;
  border-top: 1px solid #FCA5A5;
  color: #991B1B;
  padding: 8px 16px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eo-error-bar button {
  background: none;
  border: 1px solid #991B1B;
  color: #991B1B;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}
```

### README.md

Follow DAAI readme pattern. Sections:

```markdown
# @evidenceone/chat-widget

EvidenceOne Case Brasil chat as a web component. Install and embed a doctor consultation chat in any web application.

## Installation

\`\`\`bash
npm install @evidenceone/chat-widget
\`\`\`

Or via CDN:
\`\`\`html
<script src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js" type="module"></script>
\`\`\`

## Quick Start

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js" type="module"></script>
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
\`\`\`

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `api-key` | string | ✓ | — | Partner API key |
| `api-url` | string | ✓ | — | Base URL of EvidenceOne API |
| `doctor-name` | string | ✓ | — | Doctor full name |
| `doctor-email` | string | ✓ | — | Doctor email |
| `doctor-crm` | string | ✓ | — | Doctor CRM (e.g. `123456/SP`) |
| `doctor-phone` | string | ✓ | — | Doctor phone |
| `doctor-specialty` | string | — | — | Doctor specialty (optional) |
| `new-session` | boolean | — | `false` | Force new session on each open |
| `hide-button` | boolean | — | `false` | Hide built-in trigger button |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `eoReady` | `{ sessionId: string }` | Fired after successful auth |
| `eoError` | `{ code: string; message: string }` | Fired on auth failure |
| `eoClose` | `void` | Fired when drawer closes |

## Methods

\`\`\`javascript
const widget = document.querySelector('evidenceone-chat');
widget.show(); // Open drawer programmatically
widget.hide(); // Close drawer programmatically
\`\`\`

## CSS Customization

\`\`\`css
evidenceone-chat {
  --eo-button-color: #51C878;       /* Trigger button background */
  --eo-button-text-color: #FFFFFF;  /* Trigger button text */
}
\`\`\`

## Framework Examples

### React

\`\`\`tsx
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
\`\`\`

### Vue

\`\`\`vue
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
\`\`\`

### Next.js

\`\`\`tsx
import dynamic from 'next/dynamic';

const EvidenceOneChat = dynamic(
  () => import('@evidenceone/chat-widget').then(() => {
    const El = () => (
      <evidenceone-chat
        api-key="eo_live_..."
        api-url="https://api.evidenceone.com.br/v1"
        doctor-name="Dr. João"
        doctor-email="joao@hospital.com"
        doctor-crm="123456/SP"
        doctor-phone="21999999999"
      />
    );
    return El;
  }),
  { ssr: false }
);
\`\`\`

## Custom Trigger

\`\`\`html
<evidenceone-chat id="eo" hide-button api-key="..." ...></evidenceone-chat>
<button onclick="document.getElementById('eo').show()">Consultar EvidenceOne</button>
\`\`\`

## CORS / Domain Registration

During onboarding, register your domain with EvidenceOne so the API accepts requests from your application.

## CSP Requirements

If your application uses a Content Security Policy:

\`\`\`
connect-src: https://api.evidenceone.com.br
script-src: cdn.jsdelivr.net (if using CDN)
\`\`\`
```

### Pre-publish checklist

Run `/publish` command which verifies:
1. `/review` passes — no VIOLATIONS
2. `/build` passes — dist/ generated
3. `npm pack --dry-run` — only `dist/`, `package.json`, `README.md` in package
4. `npm audit --audit-level=high` — clean
5. `package.json` version is `1.0.0` (or appropriate)

Publish:
```bash
npm version 1.0.0
npm publish --access public
```

## Acceptance Criteria
- [ ] `npm pack --dry-run` shows ONLY `dist/`, `package.json`, `README.md` — no src/
- [ ] `npm audit --audit-level=high` exits 0
- [ ] `npm run build` passes
- [ ] CSS vars `--eo-button-color` and `--eo-button-text-color` work from partner page
- [ ] Drawer animation ≤300ms (measure in DevTools Performance)
- [ ] Mobile: full-screen at 375px, no horizontal overflow at 360px
- [ ] Textarea auto-expands to 4 lines then stops
- [ ] Error bar shows on network failure, "Tentar novamente" works
- [ ] README has working examples for HTML, React, Vue, Next.js
- [ ] CDN URL resolves after publish

## Testing Notes
- `npm pack` creates a `.tgz` — extract and verify contents
- Install in a fresh Create React App: `npm i file:../evidenceone-chat-widget-1.0.0.tgz` — verify it works
- Test shadow DOM isolation: wrap component in a page with Bootstrap's CSS reset — component styles must survive
- Run `/test-component` one final time and go through every item in the checklist
