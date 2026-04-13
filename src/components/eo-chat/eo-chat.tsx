import { Component, Event, EventEmitter, Host, State, h } from '@stencil/core';
import { ChatStatus, Message } from '../../models/types';

// Hardcoded sample messages for visual validation (Issue 03).
// Replaced with real messages in Issue 04 (API wiring).
const SAMPLE_MESSAGES: Message[] = [
  {
    id: 'sample-user-1',
    role: 'user',
    content: 'Quais são os principais critérios diagnósticos para Síndrome Metabólica?',
  },
  {
    id: 'sample-assistant-1',
    role: 'assistant',
    content: `De acordo com os critérios do **IDF/AHA/NHLBI (2009)**, o diagnóstico requer **3 ou mais** dos seguintes:

- **Obesidade abdominal:** circunferência ≥ 94cm (H) / ≥ 80cm (M) para europeus
- **Triglicerídeos elevados:** ≥ 150 mg/dL ou em tratamento
- **HDL reduzido:** < 40 mg/dL (H) / < 50 mg/dL (M) ou em tratamento
- **Pressão arterial:** ≥ 130/85 mmHg ou em tratamento anti-hipertensivo
- **Glicemia de jejum:** ≥ 100 mg/dL ou diagnóstico prévio de DM2

> A resistência à insulina é o mecanismo central, embora não seja critério diagnóstico formal.

Deseja aprofundar algum critério específico?`,
  },
];

@Component({
  tag: 'eo-chat',
  styleUrl: 'eo-chat.css',
  shadow: true,
})
export class EoChat {
  // 2. @State
  @State() messages: Message[] = SAMPLE_MESSAGES;
  @State() status: ChatStatus = 'idle';

  // 3. @Event — propagate close/new-session to root component
  @Event() eoChatClose: EventEmitter<void>;
  @Event() eoChatNewSession: EventEmitter<void>;

  // 7. Private methods
  private handleSend(text: string) {
    // Stub: append user message. API wiring in Issue 04.
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    this.messages = [...this.messages, userMsg];
  }

  private handleNewSession() {
    this.messages = [];
    this.status = 'idle';
    this.eoChatNewSession.emit();
  }

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-chat">
          <eo-chat-header
            onEoHeaderClose={() => { this.eoChatClose.emit(); }}
            onEoHeaderNewSession={() => { this.handleNewSession(); }}
          />
          <eo-message-list
            messages={this.messages}
            isStreaming={this.status === 'streaming'}
          />
          {this.status === 'error' && (
            <div class="eo-error-bar">
              Erro ao conectar.{' '}
              <button type="button" onClick={() => (this.status = 'idle')}>
                Tentar novamente
              </button>
            </div>
          )}
          <eo-chat-input
            disabled={this.status === 'streaming' || this.status === 'loading'}
            onEoSendMessage={(e: CustomEvent<string>) => this.handleSend(e.detail)}
          />
        </div>
      </Host>
    );
  }
}
