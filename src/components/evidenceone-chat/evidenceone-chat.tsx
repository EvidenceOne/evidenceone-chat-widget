import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Method,
  Prop,
  State,
  Watch,
  h,
} from '@stencil/core';
import { AuthStatus, DoctorData, EoErrorDetail } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

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
  @State() authStatus: AuthStatus = 'idle';
  /** Bumped whenever a fresh session is requested — child eo-chat @Watch-es this to reset. */
  @State() resetKey: number = 0;

  // 3. @Event
  @Event() eoReady: EventEmitter<{ sessionId: string }>;
  @Event() eoError: EventEmitter<EoErrorDetail>;
  @Event() eoClose: EventEmitter<void>;

  // 4. @Element
  @Element() el: HTMLElement;

  // Private — built once from props (rebuilt on @Watch)
  private authService: AuthService | undefined;
  private chatService: ChatService | undefined;
  private cachedDoctorData: DoctorData | undefined;
  /** Element that triggered drawer open — focus returns here on close. */
  private triggerEl: HTMLElement | undefined;

  // 5. Lifecycle
  componentWillLoad() {
    if (!this.validateProps()) return;
    this.buildServices();
    this.cacheDoctorData();
  }

  /**
   * Rebuild services if the partner reactively updates apiKey/apiUrl
   * (common in framework wrappers that swap endpoints between staging/prod).
   */
  @Watch('apiKey')
  @Watch('apiUrl')
  onApiPropChange() {
    if (!this.validateProps()) return;
    this.buildServices();
    this.authStatus = 'idle';
    this.resetKey += 1;
  }

  // Keep cached DoctorData in sync with its underlying props
  @Watch('doctorEmail')
  @Watch('doctorName')
  @Watch('doctorCrm')
  @Watch('doctorPhone')
  @Watch('doctorSpecialty')
  onDoctorPropChange() {
    this.cacheDoctorData();
  }

  // 6. @Method — public API
  @Method()
  async show(): Promise<void> {
    // Capture the element that called show() so focus can return there on close.
    this.triggerEl = document.activeElement as HTMLElement;
    await this.openDrawer();
  }

  @Method()
  async hide(): Promise<void> {
    // Symmetrical with ESC/backdrop — emits eoClose.
    this.handleDrawerClose();
  }

  // 7. Private methods
  private validateProps(): boolean {
    const missing: string[] = [];
    if (!this.apiKey) missing.push('api-key');
    if (!this.apiUrl) missing.push('api-url');
    if (!this.doctorEmail) missing.push('doctor-email');
    if (!this.doctorName) missing.push('doctor-name');
    if (!this.doctorCrm) missing.push('doctor-crm');
    if (!this.doctorPhone) missing.push('doctor-phone');

    if (missing.length > 0) {
      console.error(
        `[EvidenceOne] Propriedades obrigatórias ausentes: ${missing.join(', ')}`,
      );
      return false;
    }
    return true;
  }

  private buildServices() {
    this.authService = new AuthService(this.apiUrl, this.apiKey);
    this.chatService = new ChatService(this.apiUrl);
  }

  private cacheDoctorData() {
    this.cachedDoctorData = {
      email: this.doctorEmail,
      name: this.doctorName,
      crm: this.doctorCrm,
      phone: this.doctorPhone,
      specialty: this.doctorSpecialty,
    };
  }

  private handleTriggerClick = (e: MouseEvent) => {
    this.triggerEl = e.currentTarget as HTMLElement;
    this.openDrawer();
  };

  private async openDrawer() {
    this.isOpen = true;

    if (!this.authService || !this.cachedDoctorData) return; // props invalid — logged

    // newSession prop forces a fresh session every open
    if (this.newSession) {
      this.authService.clearToken();
      this.authStatus = 'idle';
      this.resetKey += 1;
    }

    // Reuse existing valid token (AuthService manages its own cache)
    const existing = this.authService.getToken();
    if (existing && !AuthService.isTokenExpired(existing)) {
      this.authStatus = 'ready';
      return;
    }

    this.authStatus = 'loading';
    try {
      await this.authService.ensureValidToken(this.cachedDoctorData);
      this.authStatus = 'ready';
      const sessionId = this.authService.getSessionId();
      if (sessionId) {
        this.eoReady.emit({ sessionId });
      }
    } catch (err) {
      this.authStatus = 'error';
      this.eoError.emit({
        code: 'AUTH_FAILED',
        message: (err as Error).message || 'Falha na autenticação',
      });
    }
  }

  private handleDrawerClose = () => {
    this.isOpen = false;
    this.eoClose.emit();
  };

  private handleNewSession = () => {
    this.authService?.clearToken();
    this.authStatus = 'idle';
    this.resetKey += 1;
  };

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-scope">
          {!this.hideButton && (
            <button class="eo-trigger-btn" onClick={this.handleTriggerClick}>
              Consultar EvidenceOne
            </button>
          )}
          <eo-drawer
            isOpen={this.isOpen}
            triggerEl={this.triggerEl}
            onEoDrawerClose={this.handleDrawerClose}
          >
            <eo-chat
              authStatus={this.authStatus}
              authService={this.authService}
              chatService={this.chatService}
              doctorData={this.cachedDoctorData}
              resetKey={this.resetKey}
              onEoChatClose={() => { this.handleDrawerClose(); }}
              onEoChatNewSession={() => { this.handleNewSession(); }}
            />
          </eo-drawer>
        </div>
      </Host>
    );
  }
}
