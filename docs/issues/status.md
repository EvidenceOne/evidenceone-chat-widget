# Issues Status

| Issue | Title | Status | Depends On |
|-------|-------|--------|------------|
| [widget-01](widget-01-scaffold.md) | Project Scaffold | completed | — |
| [widget-02](widget-02-types-and-services.md) | Types, Utils & Services | completed | 01 |
| [widget-03](widget-03-chat-ui.md) | Chat UI Components | completed | 01, 02 |
| [widget-04](widget-04-integration.md) | API Integration & Streaming | completed | 02, 03 |
| [widget-05](widget-05-polish-and-publish.md) | Polish, CSS Vars, README & Publish | completed | 04 |
| [widget-06](widget-06-sse-alignment.md) | SSE Alignment — Event Names and Field Fix | completed | 04 |
| [widget-07](widget-07-design-tokens-and-theme-prop.md) | Design Tokens (Light + Dark) & Theme Prop | completed | — |
| [widget-08](widget-08-consent-gate-auth-flow.md) | Consent Gate in the Auth Flow | completed | — |
| [widget-09](widget-09-consent-screen-and-service.md) | `eo-consent` Component & Consent Service | completed | 07, 08 |
| [widget-10](widget-10-consent-required-chat-handling.md) | Handle 403 `CONSENT_REQUIRED` on Chat | completed | 08 |
| [widget-11](widget-11-screens-restyle.md) | Restyle All Screens to the New Design | completed | 07 |
| [widget-12](widget-12-feedback-and-sources.md) | Feedback Actions & Fontes (Frontend-Only) | completed | 11 |
| [widget-13](widget-13-docs-and-publish-prep.md) | Docs Refresh & v4.0.0 Publish Prep | pending | 09, 10, 11, 12 |

> widget-07 – widget-13: spec `docs/specs/spec-consent-optin-redesign.md` (consent opt-in + convergência visual). Server counterpart: `EvidenceOne_Server/docs/issues/consent-optin/`.

## Status Values
- `pending` — not started
- `in_progress` — actively being worked on
- `completed` — done and validated
- `failed` — blocked or needs rework
