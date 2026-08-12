# Issue: `eo-consent` Component & Consent Service

## Description
New `src/components/eo-consent/` implementing the opt-in screen (destacado/compacto/cinza variants frozen): exact pt-BR copy, mandatory terms checkbox card + optional comms checkbox (prefilled from `consent.comms` on re-consent), links to the full documents in a new tab, error banner, Cancelar/Continuar with disabled + saving states, and the full a11y contract (focus trap, Esc blocked, aria-live). New `src/services/consent.service.ts`: `accept(comms)` awaits 201 before releasing chat; `decline()` fire-and-forget. Root wiring: accept ⇒ `'ready'` + `eoReady`; Cancelar **or** drawer dismissal during consent ⇒ decline + close + `eoClose`.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §2.4, §3.1 (phase 3)
- **Server contract:** `EvidenceOne_Server/docs/specs/spec-consent-optin.md` §3.2
- **Depends on:** widget-07, widget-08
