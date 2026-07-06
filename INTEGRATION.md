# Integrating `@evidenceone/chat-widget`

> **This file is the single source of truth for integrating the EvidenceOne chat widget.**
> `AGENTS.md` (npm tarball) and `llms.txt` (CDN) both point here. If you are an AI coding
> agent, read this file end-to-end before writing integration code — it overrides any
> training-data assumptions about this package.

The widget is **one framework-agnostic custom element**, `<evidenceone-chat>`, built with
StencilJS and isolated in Shadow DOM (your CSS can't leak in; its CSS can't leak out). It
renders the EvidenceOne trigger — a floating navy circle with the E1 mark whose hover reveals
the "Consultar EvidenceOne" label (or a static navy pill with `variant="inline"`); clicking
it opens a streaming doctor-consultation drawer.

---

## 1. The one decision: how does EvidenceOne learn who the doctor is?

There are two modes. **Pick `client_provided` unless you have a hard reason not to.**

| Mode | You pass | When |
| ---- | -------- | ---- |
| **`client_provided`** *(recommended — use this)* | The doctor's data via `doctor-*` props | Your app already knows the logged-in doctor. No EvidenceOne backend integration beyond the API key. |
| **`partner_gateway`** *(advanced)* | One opaque `partner-token` (+ optional `partner-lookup`) | You cannot expose the doctor's fields client-side; EvidenceOne resolves the doctor from a server-side gateway you operate. |

Everything below is `client_provided` unless a section is explicitly marked **Advanced**.

---

## 2. The `doctor-*` contract (`client_provided`)

Map your host's current-user data onto these attributes:

| Attribute         | Required | Example            | Notes |
| ----------------- | -------- | ------------------ | ----- |
| `api-key`         | yes      | `eo_live_...`      | Partner key from EvidenceOne onboarding. A **public identifier**, not a secret (like a Stripe publishable key). Inject from env, don't hardcode. |
| `api-url`         | yes      | `https://<evidenceone-api-base>/v1` | EvidenceOne API base **including `/v1`** — provided during onboarding (separate prod and staging bases). Use the staging base in non-prod. |
| `doctor-name`     | yes      | `Dr. João Silva`   | Full name. |
| `doctor-email`    | yes      | `joao@hospital.com`| |
| `doctor-crm`      | yes      | `123456/SP`        | CRM registration. |
| `doctor-phone`    | yes      | `21999999999`      | Digits only. |
| `doctor-specialty`| no       | `Cardiologia`      | |

All attributes are **reactive** — updating them at runtime is supported. Updating `api-key`
or `api-url` rebuilds the internal clients and resets session state.

### Incomplete data is handled for you

If any required `doctor-*` field is missing/empty, the widget **does not start a session**.
It shows a "Cadastro incompleto" blocked state with a retry button and emits `eoBlocked`
with the missing field names. This is re-checked on every open; nothing is cached.

**Therefore: do not build a host-side completeness gate.** Mount the widget for your
intended audience and let it handle partial data itself. It will never start a session with
an incomplete profile.

---

## 3. Optional props

| Prop          | Type                      | Default      | Purpose |
| ------------- | ------------------------- | ------------ | ------- |
| `new-session` | boolean                   | `false`      | Force a fresh session on every open. |
| `button-size` | `'sm' \| 'md' \| 'lg'`    | `'md'`       | Trigger size. Unknown → `'md'`. |
| `placement`   | `'right' \| 'left'`       | `'right'`    | Viewport edge for the floating trigger/drawer. Ignored for `variant="inline"`. |
| `variant`     | `'floating' \| 'inline'`  | `'floating'` | `floating` pins the E1-mark circle to a corner (hover reveals the label pill); `inline` renders the static navy pill in document flow. |

The widget is **brand-locked**: no CSS custom properties, no style hooks. Visual
customization is exhausted by `button-size` / `placement` / `variant`.

---

## 4. Events

All are bubbling `CustomEvent`s with camelCase names.

| Event       | `detail`                            | When |
| ----------- | ----------------------------------- | ---- |
| `eoReady`   | `{ sessionId: string }`             | Partner session created. |
| `eoBlocked` | `{ missing: string[] }`             | Profile incomplete — block state shown instead of chat. Not an error. |
| `eoError`   | `{ code: string; message: string }` | Auth failure (invalid/revoked key, network, 5xx). `code` is currently `AUTH_FAILED`. |
| `eoClose`   | `void`                              | Drawer closed (ESC, backdrop, or X). |

## 5. Gate the widget to your intended audience

The widget renders for whoever you mount it for. **If your app serves more than one kind of
user, mount the widget only for the audience it's meant for.** The widget cannot know your
host's user taxonomy — that gate is the host's responsibility.

Express the gate as a boolean derived from your auth/user store and render the element only
when it's true:

```js
// Generic shape
if (isIntendedAudience) {
  mountEvidenceOneWidget();
}
```

### Worked example — a mixed-audience app

Say your app serves two kinds of users from the same login — for example **patients** and
**physicians** — and only the physicians should see the widget. Derive a boolean from your own
user model and render on it; never rely on the widget to tell your users apart.

```js
// Render only for the audience the widget is meant for —
// derive this flag from a reliable field in your own auth/user model.
const showEvidenceOne = currentUser.isPhysician;
```

```vue
<template>
  <evidenceone-chat
    v-if="showEvidenceOne"
    :api-key="apiKey"
    :api-url="apiUrl"
    :doctor-name="doctorName"
    :doctor-email="doctorEmail"
    :doctor-crm="doctorCrm"
    :doctor-phone="doctorPhone"
  />
</template>
```

> **If every user of your app is an eligible clinician, you don't need a gate at all — mount
> the widget unconditionally.** The gate is only for apps that mix audiences. When it applies,
> getting it wrong shows the widget to the wrong users, so derive the flag from a reliable
> field in your user model and verify in the DOM + network tab that the excluded audience
> triggers no EvidenceOne call.

---

## 6. Framework wiring

### npm (recommended)

```bash
npm install @evidenceone/chat-widget
```

Register the element once, at your app's entry point:

```js
import { defineCustomElements } from '@evidenceone/chat-widget/loader';
defineCustomElements();
```

`defineCustomElements()` from `/loader` is the canonical registration. (The bare side-effect
import `import '@evidenceone/chat-widget';` also registers the element if you prefer it.)

### Vanilla / HTML (CDN)

```html
<script
  src="https://cdn.jsdelivr.net/npm/@evidenceone/chat-widget@latest/dist/evidenceone-chat/evidenceone-chat.esm.js"
  type="module"
></script>

<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://<evidenceone-api-base>/v1"
  doctor-name="Dr. João Silva"
  doctor-email="joao@hospital.com"
  doctor-crm="123456/SP"
  doctor-phone="21999999999"
></evidenceone-chat>
```

Pin an exact version (e.g. `@3.3.1`, not `@latest`) in production.

### Vue 3

Tell the Vue compiler the tag is a custom element, or it warns/fails:

```js
// vite.config.* — inside the Vue() plugin
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag === 'evidenceone-chat',
    },
  },
});
```

```vue
<script setup>
import { defineCustomElements } from '@evidenceone/chat-widget/loader';
defineCustomElements();
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

### React / Next.js

```tsx
'use client'; // Next.js App Router only
import { useEffect } from 'react';

export function Chat() {
  useEffect(() => {
    import('@evidenceone/chat-widget/loader').then((m) => m.defineCustomElements());
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

For TS/JSX, declare the tag (`src/evidenceone-chat.d.ts`) using `JSX` from
`@evidenceone/chat-widget/loader` — see the README's TypeScript section.

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the module and call `defineCustomElements()` at bootstrap.

---

## 7. Advanced: `partner_gateway`

Skip this unless `client_provided` is impossible. Pass an opaque token issued by **your**
backend instead of `doctor-*`:

```html
<evidenceone-chat
  api-key="eo_live_..."
  api-url="https://<evidenceone-api-base>/v1"
  partner-token="<opaque-token-from-your-backend>"
></evidenceone-chat>
```

If your gateway URL is keyed by an identifier (a `{lookup}` placeholder configured
server-side — id, email, name; whatever the gateway expects), also pass `partner-lookup`.
`partner-token` is read live, so a rotating token (e.g. Keycloak ~60s refresh) is picked up
on the next auth round-trip without resetting an in-flight session. Gateway provisioning is
configured on the EvidenceOne side during onboarding.

---

## 8. Operational notes for agents

- **CORS:** EvidenceOne rejects unregistered origins. The host's prod + staging domains must
  be registered during onboarding.
- **CSP (if the host enforces one):** `connect-src` the EvidenceOne API origin provided at onboarding;
  `script-src` the CDN (`https://cdn.jsdelivr.net`) only if loading via CDN.
- **No persistence:** tokens live in memory only — never `localStorage`/cookies.
- **Don't restyle it:** Shadow DOM + brand lock are intentional. There are no style hooks.
- **Don't gate on completeness:** the blocked state already covers incomplete `doctor-*` data.

When in doubt, prefer `client_provided`, mount behind an audience gate, and read the README
for the exhaustive prop/event/error reference.
