# Issue: Docs Refresh & v4.0.0 Publish Prep

## Description
Update `README.md` (events table, consent flow, `theme` prop, new `eoReady` semantics), `INTEGRATION.md`, `AGENTS.md` (revise the "Do NOT add a completeness gate" rule so it doesn't conflict with the consent gate), `CHANGELOG.md` (v4.0.0 — breaking: `eoReady` post-consent) and `llms.txt`. Leave the repo publish-ready (`npm pack --dry-run` verified); the npm publish itself is manual per `/.claude/commands/publish.md`. Integration PDFs: backlog.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §3.4 (phase 7)
- **Depends on:** widget-09, widget-10, widget-11, widget-12
