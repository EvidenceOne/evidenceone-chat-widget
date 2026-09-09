# Spec: Consent Opt-in + Convergência Visual ("EvidenceOne Onboarding")

## Resumo

Widget v4.0.0: tela de opt-in de consentimento (Termos obrigatório + Comunicações opcional) gateando o chat, e convergência visual completa para o design "EvidenceOne Onboarding" (projeto claude.ai `2bba224e-3004-413f-aa4e-049961c3f6eb`, arquivo `EvidenceOne Onboarding.dc.html`) — tokens light/dark, prop reativa `theme`, todas as telas redesenhadas, feedback e fontes como frontend-only prontos para wiring futuro. `eoReady` passa a significar "chat utilizável" (pós-consent) — breaking change, major bump. Stack: StencilJS, Shadow DOM, vanilla CSS, zero persistência de browser (mantida).

**Spec irmã (servidor):** `EvidenceOne_Server/docs/specs/spec-consent-optin.md` — tabelas `consent_events`/`terms_versions`, campo `consent` na resposta de `/partner/session`, endpoint `POST /v1/partner/consent`, enforcement 403 `CONSENT_REQUIRED`. Os contratos HTTP definidos lá são a fronteira entre as duas specs.

---

## 1. Objetivo e Contexto

**Objetivo:** exibir o opt-in no primeiro acesso de usuário com cadastro completo (e a cada nova versão dos Termos), registrar aceite/recusa no servidor, e alinhar o visual do componente inteiro ao design aprovado.

**Contexto — o que existe hoje (v3.3.3):**
- Troca de telas por cadeia ternária sobre `AuthStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked'` (`src/models/types.ts:12`, render em `src/components/eo-chat/eo-chat.tsx:196-222`). Sem state machine.
- Bootstrap: trigger → `openDrawer()` → `resolveSession()` (`evidenceone-chat.tsx:254`) com 4 saídas: pre-flight incompleto → `'blocked'`; `newSession` → reset; **token em cache → `'ready'` direto (`:276-280`)**; senão `attemptAuth()` → `POST /partner/session` → `'ready'` + `eoReady` (`:298-302`).
- Tela de bloqueio com copy "Cadastro incompleto" (`eo-chat.tsx:201-210`) — o design renomeia para "Só mais um passo".
- Tokens CSS centralizados em `.eo-scope` (`evidenceone-chat.css:41-74`), com fallbacks hardcoded repetidos nos 8 arquivos CSS. Sem theming API (deliberado), sem webfont (`system-ui`).
- Zero `localStorage`/cookies em `/src` — garantia documentada em README/INTEGRATION. Token/sessão vivem em memória (`auth.service.ts:23-27`).
- 401/403 no chat = re-auth silencioso + 1 retry (qualquer 403 é lido como token velho).
- Brand lock: logo e label do trigger com hash SHA-256 verificado em runtime (`stencil.config.ts` + `src/utils/integrity.ts`). Trocar o SVG do logo é seguro (hash regenera no build); o label do trigger não muda nesta spec.

**O que não muda:** zero persistência de browser (o estado de consent vem do servidor — o `localStorage` do protótipo era só protótipo); superfície de rede continua mínima (2 POSTs viram 3); brand lock; contratos de `eoBlocked`/`eoError`/`eoClose`; label do trigger; `marked` + `dompurify`.

**Fora de escopo:** wiring de feedback para backend (backlog — sem endpoint); fonte Inter (widget segue system-ui; carregar webfont de dentro de Shadow DOM em página de parceiro = peso de bundle/risco de CSP — decidir com design depois, o próprio protótipo marca tipografia como "a confirmar"); toggle de tema visível ao usuário final (tema é prop do host); atualização dos 2 PDFs de integração (backlog pós-publish).

---

## 2. Fundação

### 2.1 Tokens de design (light + dark)

Estratégia: **manter os nomes `--eo-*`** (evita renomear 8 arquivos) e **adotar os valores do design**, adicionando os tokens que faltam. Fonte de verdade continua sendo o bloco em `evidenceone-chat.css`; o dark é um bloco `[data-theme='dark']` sobre `.eo-scope`.

| Token | Light | Dark |
|---|---|---|
| `--eo-bg` / `--eo-surface` | `#FFFFFF` | `#131312` / `#1d1d1b` |
| `--eo-sunken` | `#F5F6F4` | `#262623` |
| `--eo-text` | `#1d1d1b` | `#F4F4F1` |
| `--eo-text-2` | `#5a5a58` | `#B5B5B3` |
| `--eo-text-3` | `#6C6C6A` | `#9B9B99` |
| `--eo-border` | `#E3E4E0` | `#33332F` |
| `--eo-border-strong` | `#C9CAC4` | `#46463F` |
| `--eo-green` | `#50C878` | `#50C878` |
| `--eo-green-hover` (strong) | `#34A85C` | `#7ADB9B` |
| `--eo-green-text` | `#1E7A40` | `#7ADB9B` |
| `--eo-green-soft` | `rgba(80,200,120,0.12)` | `rgba(80,200,120,0.14)` |
| `--eo-on-green` | `#10240F` | `#10240F` |
| `--eo-link` | `#1E7A40` | `#7ADB9B` |
| `--eo-danger` | `#B3261E` | `#FF8A80` |
| `--eo-danger-soft` | `rgba(179,38,30,0.08)` | `rgba(255,138,128,0.10)` |
| `--eo-shadow` | `0 18px 44px rgba(29,29,27,0.16)` | `0 18px 44px rgba(0,0,0,0.5)` |

Atenção: o verde atual é `#51c878`; o do design é `#50C878` — **todos os fallbacks hardcoded `var(--eo-green, #51c878)` espalhados nos CSS dos 8 componentes precisam ser atualizados junto** (grep por `#51c878`, `#45b369`, `#13214d` etc.). Tokens antigos sem equivalente no design (`--eo-navy`) saem. Fonte: mantém `--eo-font: system-ui, ...`.

### 2.2 Prop `theme`

```ts
@Prop() theme: 'light' | 'dark' | 'auto' = 'light';
```

- Reativa (`@Watch`): o host muda o atributo e o widget re-tema na hora — cobre tanto "opção de dev" quanto "acompanha o software do parceiro automaticamente" (o parceiro seta `theme="dark"` quando o tema dele muda; uma linha do lado deles).
- `'auto'` = `window.matchMedia('(prefers-color-scheme: dark)')` + listener para mudança ao vivo.
- Tema resolvido (`'light' | 'dark'`) vira `data-theme` no `.eo-scope`. Sem persistência (host decide sempre). Documentar em README/INTEGRATION.

### 2.3 Estado de consent no fluxo de auth

- `AuthStatus` ganha `'consent'` (`src/models/types.ts:12`).
- `AuthService` guarda, junto do token, o objeto `consent: { required, reconsent, termsVersion, comms }` vindo da resposta de `/partner/session` (spec irmã §3.1). Validação de shape: campo **opcional** na validação da resposta (`auth.service.ts:87-89`) — servidor antigo sem o campo ⇒ tratar como `required: false` (widget novo continua funcionando contra servidor antigo).
- Gate nos **dois** caminhos de `resolveSession`:
  - Auth fresco (`evidenceone-chat.tsx:298`): `consent.required ? 'consent' : 'ready'`.
  - Token em cache (`:276-280`): usa o `consent` guardado no `AuthService` — sem isso, reabrir o drawer pularia o gate.
- Aceite bem-sucedido ⇒ `AuthService` marca `consent.required = false` em memória (não refaz sessão).
- `inputDisabled` (`eo-chat.tsx:180-185`) e o gate do "Nova conversa" (`eo-chat.tsx:191`) incluem `'consent'`.
- **`eoReady` muda de significado:** emitido quando o chat fica utilizável — direto após auth quando `required: false`, ou **após o aceite** quando `required: true`. Payload `{ sessionId }` inalterado. Breaking ⇒ v4.0.0.

### 2.4 `consent.service.ts` (novo, em `src/services/`)

- `accept(comms: boolean)` → `POST ${apiUrl}/partner/consent` com `Authorization: Bearer`, body `{ action: 'accepted', termsAccepted: true, commsAccepted: comms }`. **Aguarda o 201** — só então o chat libera. Falha (rede ou !ok) → a tela mostra o banner de erro do design e mantém o modal (retry pelo próprio Continuar).
- `decline()` → body `{ action: 'declined', termsAccepted: false, commsAccepted: false }`, **fire-and-forget** — falha não impede fechar o componente.
- Sem retry automático, sem fila; padrão dos services existentes (fetch nativo, `unit.test.ts` colocado ao lado).

### 2.5 403 `CONSENT_REQUIRED` no chat

No caminho de erro do chat (hoje: qualquer 401/403 ⇒ `clearToken()` + re-auth + 1 retry): **antes** do re-auth, inspecionar o body do erro; `error.code === 'CONSENT_REQUIRED'` ⇒ `authStatus = 'consent'` (sem clearToken — o token é válido, falta consentimento). Só o 401/403 sem esse code mantém o comportamento atual. Cobre o cenário de enforcement ligado no servidor com estado local dessincronizado.

---

## 3. Feature

### 3.1 Componente novo `eo-consent`

Pasta `src/components/eo-consent/` (`.tsx` + `.css`), padrão dos demais (Shadow DOM, tokens `var(--eo-*)`, bloco de reset de propriedades herdáveis). Variantes do design congeladas: hierarquia **destacado**, densidade **compacto**, botão desabilitado **cinza**.

Estrutura (copy exata do design, pt-BR):

- Ícone escudo em círculo `--eo-green-soft` (SVG inline novo em `src/assets/`).
- Título **"Antes de começar"** (28px/34px, weight 500, letter-spacing -0.02em) · descrição conforme o público (widget-14): primeiro aceite ⇒ **"Para usar o EvidenceOne, precisamos do seu aceite."**; recoleta (`consent.reconsent === true`) ⇒ **"Nossos termos passaram por uma pequena revisão. Confirme abaixo para continuar usando o EvidenceOne."**
- **Checkbox 1 (obrigatório)** — card destacado (`--eo-green-soft`, borda `--eo-border`, radius 12, padding 14): rótulo "Li e aceito os [Termos de Uso] e a [Política de Privacidade] do EvidenceOne" + tag **OBRIGATÓRIO** (11px, tracking 0.12em, `--eo-green-text`). Links: `https://www.evidence1.com/privacidade#termos` e `#privacidade`, `target="_blank" rel="noopener noreferrer"` (hardcoded — mesma classe de constante que o restante do brand).
- **Checkbox 2 (opcional)** — sem card: "Aceito receber anúncios personalizados de acordo com meus interesses e novidades exclusivas sobre o EvidenceOne" (widget-14; até a v4.0.2 era "Quero receber novidades e melhorias do EvidenceOne em primeira mão"). **Sem prefill:** os dois checkboxes começam sempre desmarcados, recoleta inclusive.
- Checkbox visual: input nativo visualmente oculto sob caixa custom 20×20 radius 6 (marcada: fundo/borda `--eo-green`, check `#10240F`; desmarcada: transparente + borda 1.5px `--eo-border-strong`); rótulo inteiro clicável.
- **Banner de erro** (aparece se `accept()` falhar): "Não conseguimos registrar seu aceite" / "Verifique sua conexão e clique em "Continuar" novamente." — `--eo-danger-soft` + borda `--eo-danger`, dentro de `role="alert"`.
- Ações: **Cancelar** (ghost) · **Continuar** — desabilitado (`disabled` + `aria-disabled`, estilo cinza `--eo-sunken`/`--eo-text-3`) enquanto o obrigatório não estiver marcado; habilitado: `--eo-green`/`--eo-on-green`; estado saving com spinner e botão travado.

Acessibilidade (obrigatória, vinda do design):

- `role="dialog" aria-modal="true"` + `aria-labelledby`/`aria-describedby`; foco inicial no primeiro checkbox; Tab/Shift+Tab circulam só dentro do card (checkboxes → links → Cancelar → Continuar); **Esc não fecha** durante o consent (ajustar o handler de Esc do `eo-drawer` para consultar o estado); erro/sucesso em regiões `aria-live`; `aria-required` no obrigatório.

Eventos internos (padrão filho→raiz): `eoConsentAccept { comms: boolean }` e `eoConsentCancel`. A raiz (`evidenceone-chat.tsx`):

- **Accept:** `consentService.accept(comms)` → 201 ⇒ `authStatus = 'ready'` + `eoReady.emit({ sessionId })`; falha ⇒ prop de erro para o `eo-consent` renderizar o banner.
- **Cancel** (botão Cancelar **ou** fechar o drawer — X/backdrop — com `authStatus === 'consent'`): `consentService.decline()` fire-and-forget + fecha drawer + `eoClose.emit()`. Reaberto na mesma página ⇒ `consent.required` ainda `true` em memória ⇒ modal de novo (critério "continua aparecendo até termos o aceite").

### 3.2 Restyle das telas existentes

Todas as telas passam para os tokens novos; geometria do drawer (400px / fullscreen <767px) mantida.

- **Header** (`eo-chat-header`): logo oficial + texto "EvidenceOne" (16px, weight 400) — trocar o SVG em `src/assets/logo.ts` (hash do brand lock regenera no build); "Nova conversa" vira botão outline com ícone `+` (30px de altura, borda `--eo-border`, hover borda verde); botão fechar 30×30 outline. Sem botão de tema (tema é prop).
- **Loading:** spinner 28px (`--eo-border` + topo verde) + "VERIFICANDO SEU CADASTRO…" (11px, tracking 0.1em).
- **Blocked** (`eo-chat.tsx:201-210`): título **"Só mais um passo"** (28px), texto "Para liberar o acesso ao EvidenceOne, complete seu cadastro. Depois de concluir, volte aqui e tente novamente.", botão de retry verde com spinner durante a checagem, e banner de pendência pós-retry-falho ("Ainda não achamos seu cadastro completo" / "Confira se todos os campos do cadastro foram preenchidos e tente novamente." / "ÚLTIMA VERIFICAÇÃO {hora}") em `role="status" aria-live="polite"`. Contrato `eoBlocked { missing }` inalterado.
- **Home (chat vazio):** ícone lupa em círculo verde-soft, título "Evidência em segundos.", subtítulo "Faça sua pergunta clínica e receba a resposta fundamentada em evidências.", input placeholder "Qual a sua dúvida clínica?".
- **Chat:** bolha do usuário à direita (`--eo-sunken`, borda, radius 14/14/4/14); resposta do assistente sem bolha (texto direto, bullets com marcador verde); indicador de digitação = 3 pontos verdes animados (`role="status" aria-live="polite"`); botão flutuante "ir para o fim" quando fora do fundo; área de input: textarea min 92px/max 158px radius 12 fundo `--eo-sunken`, botão enviar 36×36 verde (desabilitado cinza durante streaming), disclaimer "O EvidenceOne pode cometer erros e não substitui a decisão nem a responsabilidade do médico. Sempre confira as respostas." (11px, opacity 0.75, centrado); placeholder "Escreva sua mensagem...".

### 3.3 Frontend-only, prontos para wiring (sem rede)

- **Ações por resposta do assistente** (aparecem ao fim do streaming): **copiar** (clipboard API, feedback visual no title/aria-label) · **útil/não útil** (thumbs; estado local exclusivo, preenchido verde/vermelho). Voto emite evento público novo `eoFeedback { sessionId, messageIndex, vote: 'up' | 'down' }` — esse evento é a costura para o wiring futuro (host ou backend); **nenhuma chamada de rede**. Backlog registrado: wiring de feedback para backend.
- **Fontes:** seção "Fontes" abaixo da resposta (12px, `--eo-text-3`, links) renderizada **somente se** a mensagem tiver fontes. O agente já emite fontes no stream — na implementação, verificar o shape real do evento SSE que as carrega (hoje o parser ignora tipos além de `delta`/`end`/`error`) e mapear para o model da mensagem. Tolerante: sem fontes no stream ⇒ seção não renderiza, nada quebra.

### 3.4 Documentação e publicação

- Atualizar: `README.md` (events table, novo fluxo, prop `theme`, semântica do `eoReady`), `INTEGRATION.md`, `AGENTS.md` — **revisar a regra "Do NOT add a completeness gate"** para não conflitar com o consent gate (a regra fala do gate de cadastro; registrar a exceção), `CHANGELOG.md` (v4.0.0, breaking: `eoReady` pós-consent), `llms.txt`. PDFs: backlog.
- Versão: **v4.0.0**. Publicação npm é **manual e feita pelo usuário** (workflow do projeto — `npm version major` + checklist de `/.claude/commands/publish.md`); a spec termina com o repo pronto para publicar, não publicado.

---

## 4. Validation Gates

Geral (toda fase): `npm test` verde · `npm run build` compila · docs-readme regenerados sem diff inesperado.

| Fase | Validação específica |
|---|---|
| 1 | Tokens novos aplicados; `grep -ri '#51c878\|#45b369\|#13214d' src/` sem hits; `theme` light/dark/auto alterna `data-theme` ao vivo (unit no resolvedor de tema) |
| 2 | Unit: `required:true` ⇒ `'consent'` nos DOIS caminhos (fresco + cache); `required:false` e campo ausente ⇒ `'ready'`; `eoReady` não emite antes do aceite; input e "Nova conversa" desabilitados em `'consent'` |
| 3 | Unit do `consent.service`: accept aguarda 201, propaga falha; decline não propaga falha. Manual: fluxo do design completo (desmarcado ⇒ Continuar disabled; só obrigatório ⇒ libera; erro de rede ⇒ banner + retry; Cancelar ⇒ fecha) |
| 4 | Unit: 403 com `code: 'CONSENT_REQUIRED'` ⇒ `'consent'` sem clearToken; 403 sem code ⇒ re-auth de sempre |
| 5 | Conferência visual tela a tela contra o design (light e dark); checklist a11y do §3.1 manual (foco, Tab-cycle, Esc, aria-live) |
| 6 | Thumbs emitem `eoFeedback` (unit); copiar copia; Fontes renderiza com e sem dados |
| 7 | README/INTEGRATION/AGENTS/CHANGELOG atualizados; `npm pack --dry-run` com conteúdo esperado |

---

## 5. Implementation Phases

| # | Phase | Descrição | Status | Depende de |
|---|---|---|---|---|
| 1 | Tokens + theme | Novos valores light/dark em `evidenceone-chat.css`, varredura dos fallbacks nos 8 CSS, prop `theme` reativa + `data-theme` | Pending | — |
| 2 | Gate de consent | `AuthStatus 'consent'`, estado de consent no `AuthService` (2 caminhos), `eoReady` pós-consent, inputDisabled | Pending | — |
| 3 | `eo-consent` + service | Componente completo (copy, a11y, estados) + `consent.service.ts` + handlers na raiz (accept/cancel/decline-on-close) | Pending | 1, 2 |
| 4 | `CONSENT_REQUIRED` no chat | Inspeção do body do erro antes do re-auth silencioso | Pending | 2 |
| 5 | Restyle das telas | Header, loading, blocked ("Só mais um passo"), home, chat, input — light + dark | Pending | 1 |
| 6 | Feedback + Fontes | Ações de resposta (copy/thumbs + `eoFeedback`), seção Fontes tolerante, mapeamento do evento SSE de fontes | Pending | 5 |
| 7 | Docs + publish-prep | README/INTEGRATION/AGENTS/CHANGELOG/llms.txt, v4.0.0 pronto para o publish manual | Pending | 3, 4, 5, 6 |

---

## 6. Decisões

| Decisão | Escolha | Alternativa descartada | Motivo |
|---|---|---|---|
| Fonte do estado de consent | Servidor (`consent` na resposta da sessão) | `localStorage` (protótipo) | Zero-persistence é garantia documentada do widget; localStorage não sobrevive a auditoria, troca de device, nem "reaparece até aceitar" |
| Tema | Prop reativa `'light' \| 'dark' \| 'auto'`, sem toggle interno | Toggle no header (protótipo); auto-only | O tema deve seguir o software do parceiro; prop reativa cobre dev-switch e acompanhamento automático com 1 linha no host. Toggle interno era chrome de protótipo |
| Nomes de token | Manter `--eo-*` com valores do design | Renomear para `--ev-*` (design) | Renomear tocaria 8 arquivos sem ganho funcional; o design é fonte de valores, não de naming |
| Fonte tipográfica | `system-ui` mantida | Inter (design) | Webfont dentro de Shadow DOM em página de terceiro = bundle/CSP; o próprio design marca tipografia como "a confirmar". Follow-up com design |
| `eoReady` | Pós-consent, mesmo payload, major bump | Evento novo (`eoConsented`) mantendo `eoReady` na sessão | "Chat utilizável" é o que o host realmente quer saber; dois eventos = confusão. Sem integração em produção ainda, major bump barato |
| Cancelar/fechar no consent | `declined` fire-and-forget + fecha | Aguardar o POST; não registrar nada | Registro de recusa é requisito (tudo é evento), mas falha de log não pode prender o usuário no modal |
| Feedback | Estado local + evento público `eoFeedback` | Chamada de rede; não implementar | Sem endpoint no backend; o evento é a costura de wiring futuro sem contrato inventado |
| Fontes | Render tolerante se presente no model | Bloquear em contrato SSE definido | O agente já emite fontes; o shape exato se confirma na implementação — ausência não pode quebrar o chat |
| Comms no re-consent | **Sempre desmarcado** (revisto na v4.0.3 / widget-14) | Prefill com `consent.comms` do servidor (decisão original da v4.0.0) | O texto do opcional mudou de escopo na v2.0 dos Termos (anúncios personalizados, não só novidades); herdar a marcação registraria consentimento que o usuário nunca deu. Prefill só volta se uma revisão futura deixar o texto do opcional intacto |
| Variantes do design | destacado + compacto + disabled cinza | neutro / respiro / outline | Defaults do protótipo; congelar evita prop-drilling de variação sem demanda |
| Estado da tela | `'consent'` como membro de `AuthStatus` | Flag booleana paralela | A cadeia ternária existente já troca telas por `AuthStatus`; um membro novo é o caminho de menor cirurgia e testável igual aos demais |
