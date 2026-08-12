# Issue: Consent Gate in the Auth Flow

## Description
Add `'consent'` to `AuthStatus`; store the `consent: { required, termsVersion, comms }` object from the `/partner/session` response in `AuthService` (field optional in response validation — absent ⇒ `required: false`). Gate **both** `resolveSession` paths (fresh auth and cached token) into `'consent'` when required; successful acceptance flips the in-memory state. Move `eoReady` to "chat usable" (post-acceptance when required). Extend `inputDisabled` and the "Nova conversa" gate to cover `'consent'`.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §2.3 (phase 2)
- **Server contract:** `EvidenceOne_Server/docs/specs/spec-consent-optin.md` §3.1
- **Depends on:** —
