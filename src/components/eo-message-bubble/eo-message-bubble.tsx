import { Component, Event, EventEmitter, Host, Prop, Watch, h } from '@stencil/core';
import { ERROR_ICON_SVG } from '../../assets/logo';
import { renderMarkdown } from '../../utils/markdown';

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

  // 3. @Event
  @Event() eoMessageRetry: EventEmitter<{ messageId: string }>;

  // Ref to the assistant content container — set via ref callback
  private contentEl: HTMLElement | undefined;

  // 5. Lifecycle — recompute sanitized HTML only when content actually changes
  @Watch('content')
  onContentChange() {
    this.applyMarkdown();
  }

  componentDidLoad() {
    this.applyMarkdown();
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
          </div>
        </div>
      </Host>
    );
  }
}
