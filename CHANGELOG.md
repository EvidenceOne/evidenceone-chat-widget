# Changelog

All notable changes to `@evidenceone/chat-widget` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.1] - 2026-07-05

### Removed

- **BREAKING: the custom-trigger escape hatch is gone.** The `hide-button` prop and the public `show()`/`hide()` methods were removed — partners can no longer replace the EvidenceOne trigger with their own button. The locked brand trigger (`variant` floating FAB or inline pill, `placement`, `button-size`) is the only way to open the widget.

### Changed

- **FAB label pill sized to the brand design's compact proportions** — roughly half the circle's height with smaller type (sm 26px/12px, md 32px/14px, lg 38px/16px), instead of near-circle height. Matches the "opção bolinha" reference; no markup or API changes.
- **Inline pill presets shrunk to normal button proportions** — sm 36px/13px, md 44px/15px, lg 54px/18px (were 50/66/80px tall). `button-size` remains the only sizing control (locked enum).

## [3.3.0] - 2026-07-03

### Changed

- **Floating trigger is now the brand FAB from the EvidenceOne design:** a navy circle with the E1 mark, pinned to the viewport corner. Hover or keyboard focus slides out the locked "Consultar EvidenceOne" navy pill toward the inside of the screen — grows left when `placement="right"`, right when `placement="left"`. Replaces the plain green text button. The `inline` variant (static navy pill) is unchanged. No API changes — `variant`, `placement` and `button-size` keep their meanings, and the brand-integrity lock still verifies the trigger label (the text stays in the DOM at all times; only its box animates).

## [3.2.2] - 2026-07-03

### Fixed

- **Brand-integrity check always failed after a production build**, blocking authentication in every host (`"Falha de integridade da marca"`). The `__INJECT_*` hash sentinels were referenced both in `BRAND_HASHES` (meant to be substituted at build time) and in an `UNFILLED_SENTINELS` guard array (meant to stay as sentinels). The `brandIntegrity()` build hook does a global text replace, so it rewrote the guard array to the real hashes too — making the "is this still an unsubstituted sentinel?" check match every valid build and reject it. `verifyBrand()` now guards on hash *shape* (`/^[0-9a-f]{64}$/`) instead of a clobberable sentinel list.

## [3.2.1] - 2026-07-02

### Fixed

- **Broken `/loader` in the published package.** `prepublishOnly` ran `npm test` (a Stencil dev build that overwrites `dist/`) *after* the production build, so the packed tarball contained a partial `dist/` missing `dist/esm/` — which `@evidenceone/chat-widget/loader` (`defineCustomElements`) and the package `main`/`module` entries depend on. Reordered `prepublishOnly` to run the production `npm run build` **last**, so the full `dist/` is packed. Consumers importing via npm (`defineCustomElements` from `/loader`) were unable to bundle 3.2.0.

## [3.2.0] - 2026-06-30

### Added

- **AI integration skill** — machine-readable integration guide shipped with the package so AI coding agents wire the widget correctly:
  - `INTEGRATION.md` — single source of truth (the `doctor-*` contract, `client_provided` flow, props/events, Vue/React/vanilla snippets, and an audience-gating worked example).
  - `AGENTS.md` at the package root — condensed operating manual that points agents to `INTEGRATION.md` from `node_modules/@evidenceone/chat-widget/`.
  - `llms.txt` — retrieval-layer index served from the package CDN URL.
  - All three added to the published `files` allowlist.

### Changed

- **Docs:** README now frames the two integration modes explicitly — `client_provided` (the `doctor-*` props) is presented as the primary, recommended path, and `partner_gateway` (`partner-token` / `partner-lookup`) is moved to a dedicated **Advanced: gateway partners** section. Clarified that the widget's built-in **blocked state** ("Cadastro incompleto") is the complete handling for incomplete doctor data — no host-side completeness gate is required.

## [3.1.0] - 2026-06-23

### Added

- `partner-lookup` prop for **gateway partners** — a generic lookup value (id, email, name — the partner decides) keyed into a `{lookup}`-templated gateway URL on the server. Sent as `lookup` on `POST /partner/session`; omitted when unset.

### Fixed

- A rotating `partner-token` (e.g. Keycloak refreshing ~every minute) no longer resets the active session/chat. The latest token is read live and used on the next authentication round-trip; the in-flight EvidenceOne session (valid up to 1h) is preserved.

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
