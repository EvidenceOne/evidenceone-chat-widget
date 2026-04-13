import { Component, Event, EventEmitter, Host, Method, Prop, State, h } from '@stencil/core';
import { EoErrorDetail } from '../../models/types';

@Component({
  tag: 'evidenceone-chat',
  styleUrl: 'evidenceone-chat.css',
  shadow: true,
})
export class EvidenceOneChat {
  // 1. @Prop — required
  @Prop() apiKey!: string;
  @Prop() apiUrl!: string;
  @Prop() doctorEmail!: string;
  @Prop() doctorName!: string;
  @Prop() doctorCrm!: string;
  @Prop() doctorPhone!: string;

  // 1. @Prop — optional
  @Prop() doctorSpecialty?: string;
  @Prop() newSession: boolean = false;
  @Prop() hideButton: boolean = false;

  // 2. @State
  @State() isOpen: boolean = false;
  @State() sessionToken: string | null = null;
  @State() sessionId: string | null = null;

  // 3. @Event
  @Event() eoReady: EventEmitter<{ sessionId: string }>;
  @Event() eoError: EventEmitter<EoErrorDetail>;
  @Event() eoClose: EventEmitter<void>;

  // 5. Lifecycle
  componentWillLoad() {
    const missing: string[] = [];
    if (!this.apiKey) missing.push('api-key');
    if (!this.apiUrl) missing.push('api-url');
    if (!this.doctorEmail) missing.push('doctor-email');
    if (!this.doctorName) missing.push('doctor-name');
    if (!this.doctorCrm) missing.push('doctor-crm');
    if (!this.doctorPhone) missing.push('doctor-phone');

    if (missing.length > 0) {
      console.error(`[EvidenceOne] Propriedades obrigatórias ausentes: ${missing.join(', ')}`);
      return;
    }

  }

  // 6. @Method — public API
  @Method()
  async show(): Promise<void> {
    this.isOpen = true;
  }

  @Method()
  async hide(): Promise<void> {
    this.isOpen = false;
  }

  // 7. Private methods
  private handleDrawerClose = () => {
    this.isOpen = false;
    this.eoClose.emit();
  };

  // 8. render()
  render() {
    return (
      <Host>
        {!this.hideButton && (
          <button class="eo-trigger-btn" onClick={() => (this.isOpen = true)}>
            Consultar EvidenceOne
          </button>
        )}
        <eo-drawer isOpen={this.isOpen} onEoDrawerClose={this.handleDrawerClose}>
          {/* Chat content — added in later issues */}
        </eo-drawer>
      </Host>
    );
  }
}
