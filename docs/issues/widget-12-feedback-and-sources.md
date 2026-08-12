# Issue: Feedback Actions & Fontes (Frontend-Only)

## Description
Per-answer actions shown after streaming ends: copy (clipboard) and thumbs up/down (exclusive local state) emitting the new public event `eoFeedback { sessionId, messageIndex, vote }` — **no network calls**; the event is the seam for future backend wiring (backlogged). "Fontes" section rendered only when the message carries sources: verify the real SSE event shape that carries them (parser currently ignores types beyond `delta`/`end`/`error`) and map it into the message model; absence must not break anything.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §3.3 (phase 6)
- **Depends on:** widget-11
