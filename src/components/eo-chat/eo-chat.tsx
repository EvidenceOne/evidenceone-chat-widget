import { Component, Event, EventEmitter, Host, Prop, State, Watch, h } from '@stencil/core';
import { CLIPBOARD_CHECK_SVG } from '../../assets/icons';
import { AuthStatus, ChatStatus, Message, SSEEvent } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { ChatService, ConsentRequiredError, TokenRejectedError } from '../../services/chat.service';
import { applySSEEvent, canStartNewSession, isInputDisabled } from '../../utils/chat-state';
import { generateId } from '../../utils/id';

@Component({
  tag: 'eo-chat',
  styleUrl: 'eo-chat.css',
  shadow: true,
})
export class EoChat {
  // 1. @Prop — services and data injected from root
  @Prop() authStatus: AuthStatus = 'idle';
  @Prop() authService: AuthService | undefined;
  @Prop() chatService: ChatService | undefined;
  /** Parent bumps this to force a reset (clears messages, aborts stream). */
  @Prop() resetKey: number = 0;

  // Consent screen pass-through (root owns the consent flow state)
  @Prop() consentSaving: boolean = false;
  @Prop() consentError: boolean = false;
  @Prop() consentPrefillComms: boolean = false;

  // 2. @State
  @State() messages: Message[] = [];
  @State() status: ChatStatus = 'idle';
  /** True from the blocked-screen retry click until the re-check resolves — keeps the blocked screen up with a button spinner. */
  @State() retryPending: boolean = false;
  /** Time (HH:MM) of the last failed retry — drives the "última verificação" pendency banner. */
  @State() lastRetryAt: string | null = null;

  // 3. @Event
  @Event() eoChatClose!: EventEmitter<void>;
  @Event() eoChatNewSession!: EventEmitter<void>;
  /** Emitted when the user retries from the blocked state — parent re-runs auth. */
  @Event() eoChatRetry!: EventEmitter<void>;
  /** Emitted on 403 CONSENT_REQUIRED from the chat — parent swaps to the consent screen. */
  @Event() eoChatConsentRequired!: EventEmitter<void>;

  // Internal — in-flight stream controller for cancellation
  private abortController: AbortController | undefined;

  // 5. Lifecycle
  @Watch('resetKey')
  onResetKeyChange() {
    this.resetChat();
  }

  @Watch('authStatus')
  onAuthStatusChange(newVal: AuthStatus) {
    // Retry resolved back to blocked → stamp the pendency banner time. No
    // oldVal condition: retryPending is only ever true between the click and
    // the settle, so any arrival at 'blocked' during it IS the settle.
    if (this.retryPending && newVal === 'blocked') {
      this.lastRetryAt = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      this.retryPending = false;
    }
    // Any exit from the blocked/loading pair clears the retry context.
    if (newVal !== 'blocked' && newVal !== 'loading') {
      this.retryPending = false;
      this.lastRetryAt = null;
    }
  }

  disconnectedCallback() {
    this.abortController?.abort();
    this.abortController = undefined;
  }

  // 7. Private methods
  private resetChat() {
    this.abortController?.abort();
    this.abortController = undefined;
    this.messages = [];
    this.status = 'idle';
  }

  private async handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.status === 'streaming' || this.status === 'loading') return;
    if (!this.authService || !this.chatService) {
      console.error('[EvidenceOne] Serviços não inicializados; verifique propriedades obrigatórias.');
      this.status = 'error';
      return;
    }

    // Block double-submit during the auth round-trip
    this.status = 'loading';

    let token: string;
    try {
      token = await this.authService.ensureValidToken();
    } catch {
      this.status = 'error';
      return;
    }

    // Append user message + empty streaming assistant message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: trimmed,
    };
    const assistantId = generateId();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    this.messages = [...this.messages, userMsg, assistantMsg];
    this.status = 'streaming';

    await this.runStream(token, trimmed, assistantId, /* isRetry */ false);
  }

  /**
   * Streams a single message attempt. On `TokenRejectedError`, clears the
   * session and retries exactly once with a fresh token — silent to the user.
   */
  private async runStream(
    token: string,
    message: string,
    assistantId: string,
    isRetry: boolean,
  ): Promise<void> {
    if (!this.authService || !this.chatService) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      for await (const event of this.chatService.sendMessage(token, message, signal)) {
        if (signal.aborted) return;
        this.messages = applySSEEvent(this.messages, assistantId, event);
        if (event.type === 'error') {
          this.markAssistantError(assistantId);
          return;
        }
        if (event.type === 'end') break;
      }
    } catch (err) {
      // Drawer closed mid-stream — expected, exit silently.
      if ((err as Error)?.name === 'AbortError') return;

      // Consent enforcement (403 CONSENT_REQUIRED) — the token is valid, so no
      // clearToken and no retry. The pending assistant bubble is dropped (the
      // question was not answered); the user message stays as context for when
      // the chat comes back post-acceptance. Root swaps the screen.
      if (err instanceof ConsentRequiredError) {
        this.messages = this.messages.filter(m => m.id !== assistantId);
        this.status = 'idle';
        this.eoChatConsentRequired.emit();
        return;
      }

      // Server rejected the token — one silent retry with a refreshed session.
      if (err instanceof TokenRejectedError && !isRetry) {
        this.authService.clearToken();
        let fresh: string;
        try {
          fresh = await this.authService.ensureValidToken();
        } catch {
          this.markAssistantError(assistantId);
          return;
        }
        await this.runStream(fresh, message, assistantId, /* isRetry */ true);
        return;
      }

      this.markAssistantError(assistantId);
      return;
    } finally {
      this.abortController = undefined;
    }

    // Normal completion — clear streaming flag
    this.messages = applySSEEvent(this.messages, assistantId, { type: 'end' });
    this.status = 'idle';
  }

  private markAssistantError(assistantId: string) {
    // Clear streaming flag + mark error on the assistant bubble.
    this.messages = applySSEEvent(
      this.messages,
      assistantId,
      { type: 'end' } as SSEEvent,
    ).map(m => (m.id === assistantId ? { ...m, error: true } : m));
    this.status = 'idle';
  }

  private handleMessageRetry = (e: CustomEvent<{ messageId: string }>) => {
    const failedId = e.detail.messageId;
    const idx = this.messages.findIndex(m => m.id === failedId);
    if (idx < 1) return;
    const userMsg = this.messages[idx - 1];
    if (!userMsg || userMsg.role !== 'user') return;

    // Drop the failed assistant bubble AND the user msg — handleSend will re-append both.
    this.messages = this.messages.slice(0, idx - 1);
    this.handleSend(userMsg.content);
  };

  private handleNewSession() {
    this.resetChat();
    this.eoChatNewSession.emit();
  }

  private handleRetry = () => {
    this.retryPending = true;
    this.eoChatRetry.emit();
  };

  // 8. render()
  render() {
    const inputDisabled = isInputDisabled(this.status, this.authStatus);

    return (
      <Host>
        <div class="eo-chat">
          <eo-chat-header
            canStartNewSession={canStartNewSession(this.authStatus)}
            onEoHeaderClose={() => { this.eoChatClose.emit(); }}
            onEoHeaderNewSession={() => { this.handleNewSession(); }}
          />

          {this.authStatus === 'loading' && !this.retryPending ? (
            <div class="eo-auth-loading" role="status" aria-live="polite">
              <span class="eo-auth-spinner" aria-hidden="true" />
              <span class="eo-auth-loading-text">Verificando seu cadastro…</span>
            </div>
          ) : this.authStatus === 'blocked' || (this.authStatus === 'loading' && this.retryPending) ? (
            <div class="eo-auth-blocked" role="alert">
              <span class="eo-auth-blocked-icon" aria-hidden="true" innerHTML={CLIPBOARD_CHECK_SVG} />
              <span class="eo-auth-blocked-title">Só mais um passo</span>
              <span class="eo-auth-blocked-text">
                Para liberar o acesso ao EvidenceOne, complete seu cadastro. Depois de concluir,
                volte aqui e tente novamente.
              </span>
              <button
                type="button"
                class="eo-auth-retry"
                onClick={this.handleRetry}
                disabled={this.retryPending}
                aria-busy={this.retryPending ? 'true' : 'false'}
              >
                {this.retryPending && <span class="eo-auth-retry-spinner" aria-hidden="true" />}
                {this.retryPending ? 'Verificando…' : 'Tentar novamente'}
              </button>
              {this.lastRetryAt && !this.retryPending && (
                <div class="eo-auth-pending" role="status" aria-live="polite">
                  <strong>Ainda não achamos seu cadastro completo</strong>
                  <span>
                    Confira se todos os campos do cadastro foram preenchidos e tente novamente.
                  </span>
                  <span class="eo-auth-pending-time">Última verificação {this.lastRetryAt}</span>
                </div>
              )}
            </div>
          ) : this.authStatus === 'error' ? (
            <div class="eo-auth-error" role="alert">
              <span>Não foi possível conectar.</span>
              <span class="eo-auth-error-hint">Tente fechar e abrir novamente.</span>
            </div>
          ) : this.authStatus === 'consent' ? (
            <eo-consent
              prefillComms={this.consentPrefillComms}
              saving={this.consentSaving}
              error={this.consentError}
            />
          ) : (
            <eo-message-list
              messages={this.messages}
              isStreaming={this.status === 'streaming'}
              onEoMessageRetry={this.handleMessageRetry}
            />
          )}

          {/* The composer only exists on the chat itself — the auth screens
              (loading/blocked/consent/error) fill the whole body, as in the
              design's full-screen overlays. */}
          {(this.authStatus === 'ready' || this.authStatus === 'idle') && (
            <eo-chat-input
              disabled={inputDisabled}
              placeholder={
                this.messages.length === 0 ? 'Qual a sua dúvida clínica?' : 'Escreva sua mensagem...'
              }
              onEoSendMessage={(e: CustomEvent<string>) => this.handleSend(e.detail)}
            />
          )}
        </div>
      </Host>
    );
  }
}
