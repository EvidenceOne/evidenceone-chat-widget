# Issue: Design Tokens (Light + Dark) & Theme Prop

## Description
Adopt the "EvidenceOne Onboarding" design token values under the existing `--eo-*` names, add the dark palette as a `[data-theme='dark']` block on `.eo-scope`, and add the reactive `theme` prop (`'light' | 'dark' | 'auto'`, default `'light'`; `auto` follows `prefers-color-scheme` live). Sweep all hardcoded fallbacks across the 8 component CSS files (`#51c878` → `#50C878`, `#45b369`, `#13214d`, etc.). Font stack stays `system-ui`.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §2.1–2.2 (phase 1)
- **Depends on:** —
