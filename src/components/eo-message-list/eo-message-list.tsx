import { Component, Element, Event, EventEmitter, Host, Prop, h } from '@stencil/core';
import { Message } from '../../models/types';

@Component({
  tag: 'eo-message-list',
  styleUrl: 'eo-message-list.css',
  shadow: true,
})
export class EoMessageList {
  // 1. @Prop
  @Prop() messages: Message[] = [];
  @Prop() isStreaming: boolean = false;

  // 3. @Event — re-emitted upward from child bubbles
  @Event() eoMessageRetry: EventEmitter<{ messageId: string }>;

  // 4. @Element
  @Element() el: HTMLElement;

  // 5. Lifecycle
  componentDidUpdate() {
    const list = this.el.shadowRoot?.querySelector('.eo-message-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  // 7. Private methods
  private handleBubbleRetry = (e: CustomEvent<{ messageId: string }>) => {
    this.eoMessageRetry.emit(e.detail);
  };

  // 8. render()
  render() {
    return (
      <Host>
        <div
          class="eo-message-list"
          role="log"
          aria-label="Histórico de conversa"
          aria-live="polite"
          aria-relevant="additions"
        >
          {this.messages.length === 0 ? (
            <div class="eo-empty">Como posso ajudar?</div>
          ) : (
            this.messages.map(msg => (
              <eo-message-bubble
                key={msg.id}
                messageId={msg.id}
                messageRole={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming && msg.role === 'assistant' && this.isStreaming}
                error={msg.error === true}
                onEoMessageRetry={this.handleBubbleRetry}
              />
            ))
          )}
        </div>
      </Host>
    );
  }
}
