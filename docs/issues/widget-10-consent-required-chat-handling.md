# Issue: Handle 403 `CONSENT_REQUIRED` on Chat

## Description
In the chat error path, inspect the error body **before** the silent 401/403 re-auth: `error.code === 'CONSENT_REQUIRED'` ⇒ `authStatus = 'consent'` without clearing the token (token is valid, consent is missing). Plain 401/403 keeps the existing re-auth + one retry behavior. Covers server-side enforcement being enabled with stale local consent state.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §2.5 (phase 4)
- **Server contract:** `EvidenceOne_Server/docs/specs/spec-consent-optin.md` §3.3
- **Depends on:** widget-08
