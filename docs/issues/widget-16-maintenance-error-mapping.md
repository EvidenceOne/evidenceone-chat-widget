# Issue: Recognize the maintenance 503 in the services

## Description

While maintenance is on, the server answers `POST /partner/session` and `POST /partner/chat` with **503 `{"error":"MAINTENANCE"}`**. Both services flatten that into a generic error today, so the partner's user sees "Não foi possível conectar." or a red bubble with "Erro ao processar resposta." instead of the maintenance screen — even after issue `widget-15`, whenever maintenance starts between two polls.

The services have to recognize that one body and let the root switch to the maintenance screen, leaving every other failure exactly as it is.

## Server dependency

- `POST /partner/session` and `POST /partner/chat` → 503 `{"error":"MAINTENANCE"}` (no `Retry-After`, no `since` in the body).
- Other 503s exist and are **not** maintenance (e.g. `{"error":"Queue service unavailable"}`), so the decision is made on the body, never on the status code.

Spec: `EvidenceOne_Server/docs/specs/spec-maintenance-mode.md` §3.4. Analysis: `EvidenceOne_Server/docs/issues/maintenance-mode/009-verify-contract-consistency-across-repos.md` (S3, S3b, S5).

## Decisions

- A `MaintenanceError` alongside the existing error classes (`ProfileIncompleteError` in `auth.service.ts`, `TokenRejectedError` / `ConsentRequiredError` in `chat.service.ts`), thrown by both services when the body matches.
- The root treats it like a positive status check: maintenance on, polling from `widget-15` decides when it ends.
- A question refused with the maintenance 503 drops the pending assistant bubble — the same treatment `ConsentRequiredError` already gets — and the user's question stays in the transcript.
- **An answer already streaming is left to finish** (changed during implementation — the draft said "abort"). The server only refuses *new* questions; aborting would throw away an answer that may well complete. It finishes behind the maintenance screen and is there when the chat comes back.
- The two failure kinds are classified in one place, `StatusService.failureOf(status, body)`: `MaintenanceError` for the maintenance body, `ApiUnreachableError` for a 5xx the API did not write (no `error`/`message` in JSON — a proxy page or an empty body), and nothing for whatever the API answered on its own.
- `eo-chat` tells the root through one internal event, `eoChatUnavailable { reason: 'maintenance' | 'unreachable' }`.
- **API unreachable** (network failure, or a 5xx with an HTML/empty body) counts as maintenance **when the browser is online** (`navigator.onLine`), and stays a connection error when it is offline. Same rule as the web client, so a doctor never gets "check your connection" when the problem is ours.

## Files

- `src/services/auth.service.ts` — `MaintenanceError`; `createSession` throws it on 503 `MAINTENANCE`, before the current generic branch (`:104-107`). The 422 `ProfileIncompleteError` branch is untouched.
- `src/services/chat.service.ts` — same recognition in `sendMessage` (`:73-76`), before the generic branch; the 401/403 branch is untouched.
- `src/components/eo-chat/eo-chat.tsx` — `runStream` handles `MaintenanceError`: abort, drop the pending bubble, tell the root (a new internal event, like `eoChatConsentRequired`); `ensureValidToken` failing with it at send time (`:110-117`) takes the same path instead of `MSG_CONNECTION_FAIL`.
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — `attemptAuth` maps `MaintenanceError` to maintenance instead of `authStatus = 'error'` + `eoError { AUTH_FAILED }`; handles the new event from `eo-chat`; applies the unreachable-API rule above to failed status checks (two consecutive failures while online, so one dropped request does not flash the screen) and to session failures with no JSON body.
- Unit tests for both services (a 503 `MAINTENANCE` body vs. another 503 body vs. a network failure) and for the `eo-chat` / root state changes.
- `CHANGELOG.md` + `package.json` — release **4.0.4** (patch — the project keeps to minimal version bumps) (new behaviour, public API unchanged apart from the new `eoError` code from `widget-15`).

## Acceptance criteria

- With maintenance on, opening the drawer (a stale poll notwithstanding) shows the maintenance screen, not "Não foi possível conectar."
- Sending a question when maintenance starts mid-session shows the maintenance screen, with no red bubble left behind and no orphan stream.
- A 503 whose body is not `MAINTENANCE` still shows the ordinary error.
- A network failure with the browser offline still shows the connection error; with the browser online it shows the maintenance screen.
- Partners on older widget versions keep working: they get the 503 as a generic error, and sending stays blocked.
- `npm test` passes and `npx tsc --noEmit` is clean.

## Context

- `src/services/auth.service.ts:104-107` turns any non-ok body into `Error(parsed.error ?? 'Session failed: <status>')` — with the new contract that is literally `Error('MAINTENANCE')`, which today reaches the partner as `eoError { code: 'AUTH_FAILED', message: 'MAINTENANCE' }`.
- `src/services/chat.service.ts:73-76` reads `err.message`, which the maintenance body does not have, so it becomes "Chat failed: 503" → `MSG_PROCESSING_FAIL`.
- Depends on `widget-15` (the root already owns the availability state).
