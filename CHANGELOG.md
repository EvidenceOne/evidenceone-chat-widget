# Changelog

All notable changes to `@evidenceone/chat-widget` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-06-16

### Added

- `partner-token` prop for **gateway partners** — when set, the server resolves the doctor profile from the partner's gateway and the `doctor-*` props are not required.
- `eoBlocked` event (`{ missing: string[] }`) and a "Cadastro incompleto" block state with a **Tentar novamente** button, shown when the doctor profile is incomplete. Re-checked on every open.

### Changed

- **BREAKING:** authentication is now a single resolver-driven `POST /partner/session` (the separate `/partner/register` call is gone) and consumes the `{ data }` / `{ error }` response envelope. Requires the updated EvidenceOne server. The public `doctor-*` props are unchanged for existing partners.
- An incomplete profile (HTTP 422 `PROFILE_INCOMPLETE`) now emits `eoBlocked` instead of `eoError`.

### Removed

- The widget no longer calls `/partner/register`.

## [1.0.0] - 2026-04-16

Initial public release.

### Added

- `<evidenceone-chat>` custom element with Shadow DOM isolation.
- Inline trigger button + right-hand drawer with focus trap and ESC-to-close.
- Register + session authentication against `/v1/partner/register` and `/v1/partner/session`.
- Streaming chat via Server-Sent Events over `/v1/partner/chat`, aligned with the native EvidenceOne Agent contract (`delta`, `end`, observational events).
- Markdown rendering with `marked` + `dompurify` sanitization.
- Reactive props — `api-key` / `api-url` hot-swapping rebuilds services at runtime.
- Public methods: `show()`, `hide()`.
- Public events: `eoReady`, `eoError`, `eoClose`.
- CSS hooks: `--eo-button-color`, `--eo-button-text-color` (trigger button only).
- Silent re-authentication on expired JWT (1 hour TTL).
- In-memory token storage (no `localStorage` / `sessionStorage` / cookies / `IndexedDB`).
- Inline per-message retry for broken SSE streams.
- Vitest unit coverage across services, utilities, and state reducers (79 tests).
- Full TypeScript type definitions.
- Portuguese (pt-BR) UI copy and ARIA labels.

[1.0.0]: https://github.com/EvidenceOne/evidenceone-chat-widget/releases/tag/v1.0.0
