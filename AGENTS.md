# AGENTS.md — `@evidenceone/chat-widget`

Operating manual for AI coding agents (Cursor, Copilot, Claude Code, etc.) integrating this
package. **Read [`INTEGRATION.md`](./INTEGRATION.md) before writing any integration code** —
it is the single source of truth and overrides your training-data assumptions about this
package's API.

When installed, this file ships in the npm tarball at the package root, so you can read it
from `node_modules/@evidenceone/chat-widget/AGENTS.md` and the full guide from
`node_modules/@evidenceone/chat-widget/INTEGRATION.md`.

## TL;DR for integration

1. **One custom element:** `<evidenceone-chat>` (Stencil, Shadow DOM, brand-locked).
2. **Default mode is `client_provided`** — pass the doctor via props:
   `api-key`, `api-url` (must end in `/v1`), `doctor-name`, `doctor-email`, `doctor-crm`,
   `doctor-phone` (all required), `doctor-specialty` (optional). Don't use `partner-token`
   unless `client_provided` is impossible.
3. **Register the element:** `import { defineCustomElements } from '@evidenceone/chat-widget/loader'; defineCustomElements();` at app entry. In **Vue**, also set
   `compilerOptions.isCustomElement: (t) => t === 'evidenceone-chat'`.
4. **Gate to your audience:** if the host serves multiple user types, render the element only
   for the intended audience (see §6 of `INTEGRATION.md`). For shared frontends this gate is
   safety-critical.
5. **Do NOT add a completeness gate** — the widget shows its own "Cadastro incompleto"
   blocked state and emits `eoBlocked`. Incomplete data never starts a session.
6. **Do NOT restyle it** — Shadow DOM + brand lock are intentional; there are no CSS hooks.

## Hard rules

- `api-key` is a **public partner identifier**, not a secret — but still inject it from env,
  never hardcode. `api-url` and `api-key` come from the host's environment config.
- Use the **staging** API base + key in non-prod; never point a staging host at prod.
- Events to wire if the host needs them: `eoReady`, `eoBlocked`, `eoError`, `eoClose`.
- The exhaustive prop/event/error reference lives in [`README.md`](./README.md).

## What this package is not

- Not an MCP server.
- Not style-customizable.
- Not a host-side gate — audience targeting is the host's job, not the widget's.

→ **Full guide: [`INTEGRATION.md`](./INTEGRATION.md). Reference: [`README.md`](./README.md).**
