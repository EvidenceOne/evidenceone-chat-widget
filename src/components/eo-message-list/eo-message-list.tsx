import { Component, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import { ARROW_DOWN_SVG, SEARCH_SVG } from '../../assets/icons';
import { Message } from '../../models/types';

/** Distance (px) from the bottom under which the list is considered "at the bottom". */
const NEAR_BOTTOM_PX = 80;

@Component({
  tag: 'eo-message-list',
  styleUrl: 'eo-message-list.css',
  shadow: true,
})
export class EoMessageList {
  // 1. @Prop
  @Prop() messages: Message[] = [];
  @Prop() isStreaming: boolean = false;

  // 2. @State
  /** True when the user scrolled away from the bottom — shows the jump button and pauses auto-stick. */
  @State() awayFromBottom: boolean = false;

  // 3. @Event — re-emitted upward from child bubbles
  @Event() eoMessageRetry!: EventEmitter<{ messageId: string }>;

  // 4. @Element
  @Element() el: HTMLElement;

  private listEl: HTMLDivElement | undefined;

  // 5. Lifecycle
  componentDidUpdate() {
    // Auto-stick only while the user is at (or near) the bottom — scrolling up
    // to re-read must not be fought by every streaming delta.
    if (!this.awayFromBottom) {
      this.scrollToBottom('auto');
    }
  }

  // 7. Private methods
  private scrollToBottom(behavior: ScrollBehavior) {
    this.listEl?.scrollTo({ top: this.listEl.scrollHeight, behavior });
  }

  private handleScroll = () => {
    const el = this.listEl;
    if (!el) return;
    const away = el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_BOTTOM_PX;
    if (away !== this.awayFromBottom) {
      this.awayFromBottom = away;
    }
  };

  private handleJumpClick = () => {
    this.scrollToBottom('smooth');
    this.awayFromBottom = false;
  };

  private handleBubbleRetry = (e: CustomEvent<{ messageId: string }>) => {
    this.eoMessageRetry.emit(e.detail);
  };

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-list-shell">
          <div
            class="eo-message-list"
            role="log"
            aria-label="Histórico de conversa"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={this.handleScroll}
            ref={(el) => (this.listEl = el as HTMLDivElement | undefined)}
          >
            {this.messages.length === 0 ? (
              <div class="eo-empty">
                <span class="eo-empty-icon" aria-hidden="true" innerHTML={SEARCH_SVG} />
                <span class="eo-empty-title">Evidência em segundos.</span>
                <span class="eo-empty-sub">
                  Faça sua pergunta clínica e receba a resposta fundamentada em evidências.
                </span>
              </div>
            ) : (
              this.messages.map((msg, index) => (
                <eo-message-bubble
                  key={msg.id}
                  messageId={msg.id}
                  messageIndex={index}
                  messageRole={msg.role}
                  content={msg.content}
                  sources={msg.sources ?? []}
                  isStreaming={msg.isStreaming && msg.role === 'assistant' && this.isStreaming}
                  error={msg.error === true}
                  onEoMessageRetry={this.handleBubbleRetry}
                />
              ))
            )}
          </div>
          {this.awayFromBottom && (
            <button
              type="button"
              class="eo-jump-bottom"
              aria-label="Ir para o fim da conversa"
              onClick={this.handleJumpClick}
              innerHTML={ARROW_DOWN_SVG}
            />
          )}
        </div>
      </Host>
    );
  }
}
