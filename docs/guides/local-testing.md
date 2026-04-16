# Teste Local — Widget contra localhost:8000

## Pré-requisitos

- NestJS server rodando (`EvidenceOne_Server/nestjs-server`)
- Widget buildado (`npm run build` neste repo)
- Uma API key ativa no banco

---

## 1. Subir o servidor

```bash
cd ~/Documents/GitHub/EvidenceOne_Server/nestjs-server
npm run start
```

Porta padrão: `8000`. Prefix: `/v1`. Endpoints:
- `POST http://localhost:8000/v1/partner/register`
- `POST http://localhost:8000/v1/partner/session`
- `POST http://localhost:8000/v1/partner/chat`

CORS já aceita qualquer origem (`origin: true`).

## 2. Obter uma API key

O seed gera a chave e imprime no console (mostrada apenas uma vez):

```bash
cd ~/Documents/GitHub/EvidenceOne_Server/nestjs-server
npm run seed
```

Saída:
```
API key created (save this — shown only once): eo_live_XXXXXXXXXXXXXXXX
```

Se já rodou o seed antes e diz *"API key already exists, skipping"*:
- Consulte o prefixo: `psql $DATABASE_URL -c "SELECT key_prefix FROM api_keys;"`
- Ou limpe e re-seed: `DELETE FROM api_keys;` → `npm run seed`

## 3. Configurar a página de teste

Edite `test/local.html` — substitua `PASTE_YOUR_API_KEY_HERE` pela chave real:

```html
<evidenceone-chat
  api-key="eo_live_XXXXXXXXXXXXXXXX"
  api-url="http://localhost:8000/v1"
  ...
></evidenceone-chat>
```

## 4. Servir a página

```bash
cd ~/Documents/GitHub/evidenceone-chat-widget
npx serve test/
```

Abra `http://localhost:3000/local.html` (porta que o `serve` reportar).

## 5. Fluxo esperado

1. Página carrega → botão verde "Consultar EvidenceOne" renderiza inline.
2. Clique no botão → drawer desliza da direita (≤300ms).
3. Drawer mostra "Conectando..." brevemente → chama `/partner/register` + `/partner/session`.
4. Sucesso: estado vazio "Como posso ajudar?" aparece. Painel de log mostra:
   ```
   [12:34:56] eoReady → sessionId=abc-123-...
   ```
5. Digite uma mensagem, Enter → bolha do usuário (verde, direita). Bolha do assistente (cinza, esquerda), tokens streamam caractere por caractere via SSE de `/partner/chat`.
6. ESC ou X fecha → log mostra `eoClose`, foco retorna ao botão trigger.

## 6. Diagnóstico de falhas

| Sintoma | Causa provável |
|---|---|
| `eoError → AUTH_FAILED: Invalid or revoked API key` | Chave errada/expirada — re-seed |
| `eoError → AUTH_FAILED: Failed to fetch` | Server não está rodando na `:8000`, ou URL errada |
| Drawer abre mas mostra "Não foi possível conectar." | Endpoint de auth retornou 4xx/5xx — checar logs do server |
| Chat envia mas nada streama | `/partner/chat` está dando throw — checar logs do server |
| Funciona e depois para | Token expirou — re-auth silencioso deveria funcionar; se não, reabra o drawer |
| Borda vermelha + "!" na bolha do assistente | Stream quebrou no meio — clique no "!" para re-enviar só aquela mensagem |

## 7. Checagens no DevTools

- **Network tab**: filtrar `Fetch/XHR`. Deve aparecer `register` → `session` ao abrir, depois `chat` em cada envio. A request `chat` fica "pending" com `Content-Type: text/event-stream` enquanto tokens streamam.
- **Application → Local Storage**: deve estar **vazio** para sua origem. O token vive apenas na memória do componente.
- **Console**: sem erros vermelhos. Props faltantes imprimem `[EvidenceOne] Propriedades obrigatórias ausentes: ...`.

## 8. Rebuild rápido

Se alterar código do widget:

```bash
npm run build
```

O `serve` na porta 3000 já serve o novo `dist/` — basta recarregar o browser.

## 9. Testes extras

- **Shadow DOM**: abra DevTools → Elements → expanda `<evidenceone-chat>` → `#shadow-root (open)` deve existir.
- **Mobile**: redimensione o viewport para 360px — drawer deve preencher a tela inteira sem scroll horizontal.
- **Focus trap**: com o drawer aberto, Tab/Shift+Tab devem ciclar apenas entre os elementos internos (inputs, botões). ESC fecha e retorna foco ao botão.
- **XSS**: envie `<script>alert(1)</script>` como mensagem — nenhum alert deve disparar.
- **CSS vars**: na host page, adicione `evidenceone-chat { --eo-button-color: red; }` → apenas o botão muda. `evidenceone-chat { --eo-green: red; }` → nada muda internamente (tokens protegidos no `.eo-scope`).
