import { Component, Event, EventEmitter, Host, Prop, State, Watch, h } from '@stencil/core';
import { AuthStatus, ChatStatus, Message, SSEEvent } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { ChatService, TokenRejectedError } from '../../services/chat.service';
import { applySSEEvent } from '../../utils/chat-state';
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

  // 2. @State
  @State() messages: Message[] = [];
  @State() status: ChatStatus = 'idle';

  // 3. @Event
  @Event() eoChatClose: EventEmitter<void>;
  @Event() eoChatNewSession: EventEmitter<void>;
  /** Emitted when the user retries from the blocked state — parent re-runs auth. */
  @Event() eoChatRetry: EventEmitter<void>;

  // Internal — in-flight stream controller for cancellation
  private abortController: AbortController | undefined;

  // 5. Lifecycle
  @Watch('resetKey')
  onResetKeyChange() {
    this.resetChat();
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
    this.eoChatRetry.emit();
  };

  // 8. render()
  render() {
    const inputDisabled =
      this.status === 'streaming' ||
      this.status === 'loading' ||
      this.authStatus === 'loading' ||
      this.authStatus === 'error' ||
      this.authStatus === 'blocked';

    return (
      <Host>
        <div class="eo-chat">
          <eo-chat-header
            canStartNewSession={this.authStatus === 'ready'}
            onEoHeaderClose={() => { this.eoChatClose.emit(); }}
            onEoHeaderNewSession={() => { this.handleNewSession(); }}
          />

          {this.authStatus === 'loading' ? (
            <div class="eo-auth-loading">
              <eo-loading />
              <span>Conectando...</span>
            </div>
          ) : this.authStatus === 'blocked' ? (
            <div class="eo-auth-blocked" role="alert">
              <span class="eo-auth-blocked-title">Cadastro incompleto</span>
              <span class="eo-auth-blocked-text">
                Complete seu cadastro para usar o assistente EvidenceOne e abra novamente.
              </span>
              <button type="button" class="eo-auth-retry" onClick={this.handleRetry}>
                Tentar novamente
              </button>
            </div>
          ) : this.authStatus === 'error' ? (
            <div class="eo-auth-error" role="alert">
              <span>Não foi possível conectar.</span>
              <span class="eo-auth-error-hint">Tente fechar e abrir novamente.</span>
            </div>
          ) : (
            <eo-message-list
              messages={this.messages}
              isStreaming={this.status === 'streaming'}
              onEoMessageRetry={this.handleMessageRetry}
            />
          )}

          <eo-chat-input
            disabled={inputDisabled}
            onEoSendMessage={(e: CustomEvent<string>) => this.handleSend(e.detail)}
          />
        </div>
      </Host>
    );
  }
}
