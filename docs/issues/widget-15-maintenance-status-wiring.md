# Issue: Drive the maintenance screen from the server status

## Description

The maintenance screen exists (`eo-maintenance`) and `eo-chat` already gives it precedence over every auth state, but nothing ever turns it on: the root never passes `maintenance` / `maintenanceChecking`, and no one listens to `eoMaintenanceRetry`. Only the `test/maintenance-preview.html` harness drives it, by reaching into the shadow root.

The root component becomes the owner of the availability state: it asks the server, drives the two props, polls while the drawer is open, and re-checks when the user presses "Tentar novamente".

## Server dependency

`GET {apiUrl}/status` — public, no API key and no token, `Cache-Control: no-store` (the partner's `api-url` already includes `/v1`):

```jsonc
{ "data": { "maintenance": true, "since": "2026-09-18T13:02:11.000Z", "source": "manual" } }
```

Spec: `EvidenceOne_Server/docs/specs/spec-maintenance-mode.md` §3.2. Cross-repo analysis: `EvidenceOne_Server/docs/issues/maintenance-mode/009-verify-contract-consistency-across-repos.md` (S1, S2, S4).

## Decisions

- **Check when the drawer opens, in parallel with resolving the session — never before it.** Waiting for the status would add a round trip to every open, for every user, to optimize a rare case. `eo-chat` already gives `maintenance` precedence over every auth state, so whichever answer arrives first is safe; and during maintenance the session call is rejected by the server's guard before it counts any usage.
- **Poll only while the drawer is open and the tab is visible** (15s; the server caches its state for 5s). A closed widget makes no network traffic, which is what partners expect from an embedded component.
- **A failed status check changes nothing in this issue** — the state stays as it was. What an unreachable API means is decided in `widget-16`.
- **Recovery without reload:** when a poll reports `maintenance: false`, the widget resumes the normal flow (session resolution / the chat as it was) with no user action.
- **`since` is not shown.** The web screen has the "Atualizado há X min" chip; the widget screen does not, and this issue does not add one.
- **Partner-facing event:** emit `eoError { code: 'MAINTENANCE', message }` when the widget enters maintenance, once per transition. It reuses the existing event, so the locked public prop surface does not change, and partners that already listen to `eoError` can react. Needs the README error-code table updated.

## Files

- `src/services/status.service.ts` — new. `getStatus(apiUrl)` → `{ maintenance, since, source }`; a non-ok response or a network failure rejects, and the caller decides.
- `src/services/status.service.unit.test.ts` — new. Follows `auth.service.unit.test.ts` (`vi.spyOn(globalThis, 'fetch')`).
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — availability state, the check on open, the polling while open (cleared on close and in `disconnectedCallback`), `@Listen('eoMaintenanceRetry')` for the retry (same pattern as `eoConsentAccept`), passing `maintenance` / `maintenanceChecking` to `eo-chat`, and the `eoError` emission above.
- `src/components/evidenceone-chat/evidenceone-chat.unit.test.ts` — the state machine: maintenance on open, recovery on the next poll, retry sets `maintenanceChecking`, no polling while closed.
- `README.md` — the `eoError` code table (today only `AUTH_FAILED`).
- `CHANGELOG.md` — under `[Unreleased]`.

## Acceptance criteria

- With maintenance on, opening the drawer shows the maintenance screen, and opening it with maintenance off is not delayed by the status request.
- With maintenance turned on while the drawer is open, the screen appears within ~15s.
- Turning maintenance off brings back the previous state (chat, consent or blocked) with no reload and no user action.
- "Tentar novamente" queries the server and shows "Verificando…" during the request.
- A closed drawer issues no status requests.
- `npm test` passes and `npx tsc --noEmit` is clean.

## Context

- `src/components/evidenceone-chat/evidenceone-chat.tsx:599-611` renders `eo-chat` without the maintenance props; the props sit at their `false` defaults in production.
- `src/components/eo-chat/eo-chat.tsx:271-274` gives `eo-maintenance` precedence over every auth state, hides the composer (`:330-338`) and "Nova conversa" (`:266`).
- `eoMaintenanceRetry` is emitted by `src/components/eo-maintenance/eo-maintenance.tsx:22,27` and has no listener in `src/`.
- The root has no polling, interval or visibility logic today.
