import { Component, Event, EventEmitter, Host, Prop, State, Watch, h } from '@stencil/core';
import { CHECK_SVG, COPY_SVG, THUMB_DOWN_SVG, THUMB_UP_SVG } from '../../assets/icons';
import { ERROR_ICON_SVG } from '../../assets/logo';
import { MessageSource } from '../../models/types';
import { renderMarkdown } from '../../utils/markdown';

/** How long the copy button shows its "copied" confirmation. */
const COPY_FEEDBACK_MS = 2000;

@Component({
  tag: 'eo-message-bubble',
  styleUrl: 'eo-message-bubble.css',
  shadow: true,
})
export class EoMessageBubble {
  // 1. @Prop
  @Prop() messageId: string = '';
  @Prop() messageRole: 'user' | 'assistant' = 'user';
  @Prop() content: string = '';
  @Prop() isStreaming: boolean = false;
  @Prop() error: boolean = false;
  /** Position within the conversation — carried on feedback votes (spec §3.3). */
  @Prop() messageIndex: number = -1;
  /** Citations from the stream — the "Fontes" section renders only when non-empty. */
  @Prop() sources: MessageSource[] = [];

  // 2. @State — local-only action feedback (no persistence, spec §3.3)
  @State() vote: 'up' | 'down' | null = null;
  @State() copied: boolean = false;

  // 3. @Event
  @Event() eoMessageRetry!: EventEmitter<{ messageId: string }>;
  /** Internal seam — the root re-emits this as the public `eoFeedback` with sessionId attached. */
  @Event() eoMessageFeedback!: EventEmitter<{ messageIndex: number; vote: 'up' | 'down' }>;

  // Ref to the assistant content container — set via ref callback
  private contentEl: HTMLElement | undefined;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  // 5. Lifecycle — recompute sanitized HTML only when content actually changes
  @Watch('content')
  onContentChange() {
    this.applyMarkdown();
  }

  componentDidLoad() {
    this.applyMarkdown();
  }

  disconnectedCallback() {
    clearTimeout(this.copyTimer);
  }

  // 7. Private methods
  private applyMarkdown() {
    if (this.messageRole !== 'assistant') return;
    if (!this.contentEl) return;
    this.contentEl.innerHTML = renderMarkdown(this.content);
  }

  private handleRetryClick = () => {
    this.eoMessageRetry.emit({ messageId: this.messageId });
  };

  private handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.content);
      this.copied = true;
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => (this.copied = false), COPY_FEEDBACK_MS);
    } catch {
      /* clipboard denied (permissions/insecure context) — button simply stays unchanged */
    }
  };

  private handleVote = (vote: 'up' | 'down') => {
    // Exclusive local state; re-clicking the active vote is a no-op (no unvote,
    // no duplicate event — each emitted eoFeedback is a state change).
    if (this.vote === vote) return;
    this.vote = vote;
    this.eoMessageFeedback.emit({ messageIndex: this.messageIndex, vote });
  };

  /** Actions appear only once an assistant answer finished streaming cleanly. */
  private showActions(): boolean {
    return (
      this.messageRole === 'assistant' && !this.isStreaming && !this.error && !!this.content
    );
  }

  private showSources(): boolean {
    return this.messageRole === 'assistant' && !this.isStreaming && this.sources.length > 0;
  }

  // 8. render()
  render() {
    const isUser = this.messageRole === 'user';
    const ariaLabel = isUser ? 'Mensagem do usuário' : 'Mensagem do assistente';
    return (
      <Host>
        <div
          class={{
            'eo-bubble-row': true,
            'eo-bubble-row--user': isUser,
            'eo-bubble-row--assistant': !isUser,
          }}
          role="article"
          aria-label={ariaLabel}
        >
          <div
            class={{
              'eo-bubble': true,
              'eo-bubble--user': isUser,
              'eo-bubble--assistant': !isUser,
              'eo-bubble--error': this.error,
            }}
          >
            {isUser ? (
              <span class="eo-bubble-content eo-bubble-content--plain">{this.content}</span>
            ) : (
              <span
                class="eo-bubble-content"
                ref={el => { this.contentEl = el ?? undefined; }}
              />
            )}
            {this.isStreaming && <eo-loading />}
            {this.error && (
              <button
                class="eo-bubble-error-btn"
                type="button"
                title="Erro ao processar. Clique para tentar novamente."
                aria-label="Tentar enviar novamente esta mensagem"
                onClick={this.handleRetryClick}
                innerHTML={ERROR_ICON_SVG}
              />
            )}
            {this.showSources() && (
              <div class="eo-sources">
                <span class="eo-sources-title">Fontes</span>
                <ol class="eo-sources-list">
                  {this.sources.map(source => (
                    <li>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.title}
                        </a>
                      ) : (
                        <span>{source.title}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {this.showActions() && (
              <div class="eo-actions" role="group" aria-label="Ações da resposta">
                <button
                  type="button"
                  class="eo-action-btn"
                  title={this.copied ? 'Copiado!' : 'Copiar resposta'}
                  aria-label={this.copied ? 'Copiado!' : 'Copiar resposta'}
                  onClick={this.handleCopy}
                  innerHTML={this.copied ? CHECK_SVG : COPY_SVG}
                />
                <button
                  type="button"
                  class={{ 'eo-action-btn': true, 'eo-action-btn--up': this.vote === 'up' }}
                  title="Resposta útil"
                  aria-label="Marcar resposta como útil"
                  aria-pressed={this.vote === 'up' ? 'true' : 'false'}
                  onClick={() => this.handleVote('up')}
                  innerHTML={THUMB_UP_SVG}
                />
                <button
                  type="button"
                  class={{ 'eo-action-btn': true, 'eo-action-btn--down': this.vote === 'down' }}
                  title="Resposta não útil"
                  aria-label="Marcar resposta como não útil"
                  aria-pressed={this.vote === 'down' ? 'true' : 'false'}
                  onClick={() => this.handleVote('down')}
                  innerHTML={THUMB_DOWN_SVG}
                />
              </div>
            )}
          </div>
        </div>
      </Host>
    );
  }
}
