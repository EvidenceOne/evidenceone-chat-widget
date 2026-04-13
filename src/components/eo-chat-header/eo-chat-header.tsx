import { Component, Event, EventEmitter, Host, h } from '@stencil/core';
import { CLOSE_ICON_SVG, LOGO_SVG } from '../../assets/logo';

@Component({
  tag: 'eo-chat-header',
  styleUrl: 'eo-chat-header.css',
  shadow: true,
})
export class EoChatHeader {
  // 3. @Event
  @Event() eoHeaderClose: EventEmitter<void>;
  @Event() eoHeaderNewSession: EventEmitter<void>;

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-header">
          <span class="eo-logo" innerHTML={LOGO_SVG} />
          <div class="eo-header-actions">
            <button class="eo-btn-new" onClick={() => this.eoHeaderNewSession.emit()} type="button">
              Nova conversa
            </button>
            <button
              class="eo-btn-close"
              aria-label="Fechar"
              onClick={() => this.eoHeaderClose.emit()}
              type="button"
              innerHTML={CLOSE_ICON_SVG}
            />
          </div>
        </div>
      </Host>
    );
  }
}
