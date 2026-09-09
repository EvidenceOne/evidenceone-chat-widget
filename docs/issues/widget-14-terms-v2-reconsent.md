# Issue: Terms v2.0 — New Opt-in Copy, Re-collection Screen & Chat Disclaimer

## Description

The Terms of Use and Privacy Policy were revised and republished as **version 2.0**
(registry id `2026-09-08`, live at `evidence1.com/privacidade`; v1.0 archived at
`/privacidade/v/1.0`). Three copy changes follow in the widget:

1. **Optional opt-in copy changes** — it now covers personalized advertising, not
   just product news.
2. **A second variant of the consent screen** for users who already accepted a
   previous version, explaining that the documents were revised.
3. **Chat disclaimer** under the input gets the medical-responsibility clause
   (unrelated to the Terms revision, shipped in the same release).

The first-acceptance screen does not go away: new users keep seeing it, with only
the optional checkbox copy updated.

## Copy

| Element | First acceptance (no prior consent) | Re-collection (accepted an older version) |
|---|---|---|
| Title | `Antes de começar` | `Antes de começar` |
| Description | `Para usar o EvidenceOne, precisamos do seu aceite.` (unchanged) | `Nossos termos passaram por uma pequena revisão. Confirme abaixo para continuar usando o EvidenceOne.` |
| Mandatory checkbox | unchanged (`Li e aceito os Termos de Uso e a Política de Privacidade do EvidenceOne` + `Obrigatório`), keeps the highlighted card | same |
| Optional checkbox | **`Aceito receber anúncios personalizados de acordo com meus interesses e novidades exclusivas sobre o EvidenceOne`** (replaces "Quero receber novidades e melhorias do EvidenceOne em primeira mão") | same |
| Actions | `Cancelar` / `Continuar` (unchanged) | same |

Chat input disclaimer (both audiences, exact text, punctuation included):

> O EvidenceOne pode cometer erros e não substitui a decisão nem a responsabilidade do médico. Sempre confira as respostas.

Links (`TERMS_URL` / `PRIVACY_URL` → `/privacidade#termos`, `#privacidade`) need no
change: the anchors were preserved when v2.0 was published.

## Server dependency

`consent.required` is `true` for both audiences, so the widget cannot tell them
apart on its own. `deriveConsentState` already holds `latestAccepted`, so this is
one additive field:

```ts
// EvidenceOne_Server/src/consent/helpers/consent-helpers.ts
reconsent: current !== null && latestAccepted !== null && latestAccepted.termsVersion !== current.version
```

Exposed through `POST /partner/session` alongside `required`, `termsVersion`, `comms`.
The widget treats a missing field as `false` (first-acceptance copy), so older
servers keep working — the widget ships and degrades gracefully; the re-collection
copy only lights up once the server change is deployed.

Rejected alternative: inferring re-consent from `comms === true` — a user who
accepted with the optional box unchecked would be misclassified.

## Optional checkbox is NOT prefilled

`consentPrefillComms` used to pre-check the optional box with the user's previous
choice. The v2.0 optional consent is **materially broader** (personalized ads +
exclusive news vs. product news only), so carrying the old choice over would record
consent to something the user never agreed to. Both boxes now start **unchecked**
on both screens, and the prop is gone.

Rule for the future: reintroduce a prefill only when the optional consent text is
unchanged between the accepted version and the current one.

## Files

- `src/components/eo-consent/eo-consent.tsx` — copy, `reconsent` prop replacing
  `prefillComms`, no prefill
- `src/components/eo-consent/eo-consent.unit.test.ts` — new: locks both copy
  variants, the unchecked start, and optional-consent recording
- `src/components/eo-chat/eo-chat.tsx` — `consentReconsent` pass-through
- `src/components/evidenceone-chat/evidenceone-chat.tsx` — reads it from the session state
- `src/components/eo-chat-input/eo-chat-input.tsx` — disclaimer text
- `src/services/auth.service.ts` + `src/models/types.ts` — `reconsent` in `ConsentState`
- `docs/specs/spec-consent-optin-redesign.md` — copy + prefill decision revised
- `CHANGELOG.md` + version bump (patch: **4.0.3**)

## Acceptance criteria

- New user sees the first-acceptance screen with the new optional copy.
- User who accepted v1.0 sees the re-collection screen with the revision message.
- Both checkboxes start unchecked in both screens; `Continuar` stays disabled until
  the mandatory one is checked.
- Accepting records a **new** consent event with `termsVersion` = current registry id;
  the previous event is untouched (server is append-only).
- Declining/closing records `declined` and re-shows the screen on the next open.
- Optional consent remains optional: the user completes the flow without checking it,
  and both `true` and `false` are recorded correctly.
- A server without the `reconsent` field still renders the first-acceptance copy.
- Disclaimer shows the exact new sentence, same style; wraps to 3 lines on a 320px
  viewport without breaking the input layout.

## Context

- Spec: `docs/specs/spec-consent-optin-redesign.md` (v4.0.0 consent work)
- Server: `EvidenceOne_Server/docs/issues/consent-optin/`, runbook
  `docs/runbooks/consent-terms-version.md`
- Rollout order: **(1)** publish the widget, **(2)** partner updates the dependency,
  **(3)** deploy the server `reconsent` field, **(4)** insert `2026-09-08` into
  `terms_versions` in production — that last INSERT is what flips every user to
  `required: true`.
