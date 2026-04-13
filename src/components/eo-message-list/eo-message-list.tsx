import { Component, Element, Host, Prop, h } from '@stencil/core';
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

  // 4. @Element
  @Element() el: HTMLElement;

  // 5. Lifecycle
  componentDidUpdate() {
    const list = this.el.shadowRoot?.querySelector('.eo-message-list');
    if (list) list.scrollTop = list.scrollHeight;
  }

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-message-list">
          {this.messages.length === 0 ? (
            <div class="eo-empty">Como posso ajudar?</div>
          ) : (
            this.messages.map(msg => (
              <eo-message-bubble
                key={msg.id}
                messageRole={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming && msg.role === 'assistant' && this.isStreaming}
              />
            ))
          )}
        </div>
      </Host>
    );
  }
}
