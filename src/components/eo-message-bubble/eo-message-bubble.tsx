import { Component, Element, Host, Prop, h } from '@stencil/core';
import { renderMarkdown } from '../../utils/markdown';

@Component({
  tag: 'eo-message-bubble',
  styleUrl: 'eo-message-bubble.css',
  shadow: true,
})
export class EoMessageBubble {
  // 1. @Prop
  @Prop() messageRole: 'user' | 'assistant' = 'user';
  @Prop() content: string = '';
  @Prop() isStreaming: boolean = false;

  // 4. @Element
  @Element() el: HTMLElement;

  // 5. Lifecycle
  componentDidRender() {
    // Inject sanitized markdown HTML into the assistant bubble container
    if (this.messageRole === 'assistant') {
      const container = this.el.shadowRoot?.querySelector('.eo-bubble-content');
      if (container) {
        container.innerHTML = renderMarkdown(this.content);
      }
    }
  }

  // 8. render()
  render() {
    const isUser = this.messageRole === 'user';
    return (
      <Host>
        <div class={{ 'eo-bubble-row': true, 'eo-bubble-row--user': isUser, 'eo-bubble-row--assistant': !isUser }}>
          <div class={{ 'eo-bubble': true, 'eo-bubble--user': isUser, 'eo-bubble--assistant': !isUser }}>
            {isUser ? (
              <span class="eo-bubble-content eo-bubble-content--plain">{this.content}</span>
            ) : (
              <span class="eo-bubble-content" />
            )}
            {this.isStreaming && <eo-loading />}
          </div>
        </div>
      </Host>
    );
  }
}
