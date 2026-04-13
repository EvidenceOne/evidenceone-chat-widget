import { Component, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import { SEND_ICON_SVG } from '../../assets/logo';

// 4 lines × line-height (24px) + padding (20px top+bottom) = 116px max
const MAX_TEXTAREA_HEIGHT = 116;

@Component({
  tag: 'eo-chat-input',
  styleUrl: 'eo-chat-input.css',
  shadow: true,
})
export class EoChatInput {
  // 1. @Prop
  @Prop() disabled: boolean = false;

  // 2. @State
  @State() value: string = '';

  // 3. @Event
  @Event() eoSendMessage: EventEmitter<string>;

  // 4. @Element
  @Element() el: HTMLElement;

  // 7. Private methods
  private getTextarea(): HTMLTextAreaElement | null {
    return this.el.shadowRoot?.querySelector('.eo-textarea') as HTMLTextAreaElement | null;
  }

  private adjustHeight() {
    const ta = this.getTextarea();
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
  }

  private handleInput(e: Event) {
    this.value = (e.target as HTMLTextAreaElement).value;
    this.adjustHeight();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  private handleSend() {
    const text = this.value.trim();
    if (!text || this.disabled) return;
    this.eoSendMessage.emit(text);
    this.value = '';
    // Reset height after clearing
    const ta = this.getTextarea();
    if (ta) ta.style.height = 'auto';
  }

  // 8. render()
  render() {
    const canSend = !!this.value.trim() && !this.disabled;
    return (
      <Host>
        <div class="eo-input-area">
          <textarea
            class="eo-textarea"
            placeholder="Escreva sua mensagem..."
            disabled={this.disabled}
            value={this.value}
            onInput={(e: Event) => this.handleInput(e)}
            onKeyDown={(e: KeyboardEvent) => this.handleKeyDown(e)}
            rows={1}
            aria-label="Mensagem"
          />
          <button
            class={{ 'eo-send-btn': true, 'eo-send-btn--active': canSend }}
            disabled={!canSend}
            onClick={() => this.handleSend()}
            type="button"
            aria-label="Enviar mensagem"
            innerHTML={SEND_ICON_SVG}
          />
        </div>
      </Host>
    );
  }
}
