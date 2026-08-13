# Issue: Restyle All Screens to the New Design

## Description
Converge every existing screen to the design (light + dark): header (official logo + "EvidenceOne" wordmark, outline "Nova conversa" and close buttons — logo swap regenerates the brand-lock hash at build), loading ("VERIFICANDO SEU CADASTRO…"), blocked screen renamed to **"Só mais um passo"** with retry spinner + "última verificação" pendency banner (contract `eoBlocked { missing }` unchanged), empty-chat home ("Evidência em segundos."), chat thread (user bubble right/sunken, assistant as plain rich text with green bullets, typing dots, jump-to-bottom), and the input area (textarea 92–158px, green send button with streaming-disabled state, disclaimer line). Drawer geometry unchanged.

## Context
- **Spec:** `docs/specs/spec-consent-optin-redesign.md` §3.2 (phase 5)
- **Depends on:** widget-07
