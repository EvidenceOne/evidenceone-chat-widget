import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Prop,
  State,
  Watch,
  h,
} from '@stencil/core';
import { E1_MARK_SVG } from '../../assets/logo';
import { AuthStatus, DoctorData, EoErrorDetail, IdentityPayload } from '../../models/types';
import { AuthService, ProfileIncompleteError } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import {
  BRAND_TRIGGER_TEXT,
  isBrandIntact,
  verifyBrand,
} from '../../utils/integrity';

type ButtonSize = 'sm' | 'md' | 'lg';
type Placement = 'right' | 'left';
type Variant = 'floating' | 'inline';

/**
 * LOCKED PUBLIC API SURFACE — DO NOT EXTEND WITHOUT BRAND APPROVAL.
 *
 * The visual customization the partner is allowed to perform is exhausted by
 * three typed enum props (buttonSize / placement / variant) and zero CSS knobs.
 *
 * Specifically: NO @Prop here may accept a logo, brand colour, custom asset
 * URL, theme object, class name, inline style, or anything that lets the
 * partner alter the rendered EvidenceOne brand. The trigger label text
 * ("Consultar EvidenceOne") and the header logo are runtime-verified by
 * src/utils/integrity.ts and the widget refuses to authenticate on mismatch.
 */
// L3 note: Stencil 4 does not expose `mode: 'closed'` for shadow roots
// (see node_modules/@stencil/core/internal/stencil-public-runtime.d.ts —
// ShadowRootOptions has only `delegatesFocus` and `slotAssignment`). The
// runtime-tampering defense for the brand mark is therefore moved to a
// MutationObserver on the logo element inside eo-chat-header, paired with
// the L4b bundle-hash check on the source string. Combined, those catch
// both byte-patched bundles and post-mount DOM swaps.
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

  // 1. @Prop — optional behavior
  @Prop() doctorSpecialty?: string;
  /**
   * Opaque partner token for `partner_gateway` partners. When present, the
   * server resolves the doctor profile from the partner's gateway and the
   * doctor-* props are not required.
   */
  @Prop() partnerToken?: string;
  /**
   * Optional generic lookup value (id, email, name — the partner decides) that
   * keys a `{lookup}`-templated gateway URL on the server. Only meaningful in
   * `partner_gateway` mode alongside `partnerToken`.
   */
  @Prop() partnerLookup?: string;
  @Prop() newSession: boolean = false;

  // 1. @Prop — visual customization (enum-only)
  @Prop({ reflect: true }) buttonSize: ButtonSize = 'md';
  @Prop({ reflect: true }) placement: Placement = 'right';
  @Prop({ reflect: true }) variant: Variant = 'floating';

  // 2. @State
  @State() isOpen: boolean = false;
  @State() authStatus: AuthStatus = 'idle';
  /** Bumped whenever a fresh session is requested — child eo-chat @Watch-es this to reset. */
  @State() resetKey: number = 0;
  /** True if brand integrity verification failed at mount. Render-blocks the trigger and short-circuits auth. */
  @State() integrityFailed: boolean = false;

  // 3. @Event
  @Event() eoReady!: EventEmitter<{ sessionId: string }>;
  @Event() eoError!: EventEmitter<EoErrorDetail>;
  /** Emitted when the partner session is blocked because the doctor profile is incomplete. */
  @Event() eoBlocked!: EventEmitter<{ missing: string[] }>;
  @Event() eoClose!: EventEmitter<void>;

  // 4. @Element
  @Element() el!: HTMLElement;

  // Private — built once from props (rebuilt on @Watch)
  private authService: AuthService | undefined;
  private chatService: ChatService | undefined;
  private cachedDoctorData: DoctorData | undefined;
  /** Element that triggered drawer open — focus returns here on close. */
  private triggerEl: HTMLElement | undefined;
  /** Ref to the rendered trigger button or pill — used for integrity check on its label. */
  private triggerRef: HTMLElement | undefined;

  // 5. Lifecycle
  componentWillLoad() {
    if (!this.validateProps()) return;
    this.buildServices();
    this.cacheDoctorData();
  }

  async componentDidLoad() {
    await this.verifyBrandIntegrity();
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

  // The Keycloak/partner token rotates ~every minute. `identityPayload()` reads
  // `partnerToken` live at auth time, so the latest token is used on the next
  // round-trip automatically — we must NOT reset an active EvidenceOne session
  // (valid up to 1h) on every rotation. Re-validate props for diagnostics only;
  // no clearToken()/resetKey bump here.
  @Watch('partnerToken')
  onPartnerTokenChange() {
    this.validateProps();
  }

  // 6. Private methods
  /**
   * Transport-level validation: the widget can only function with an api-key and
   * api-url. Doctor-profile completeness is NOT checked here — an incomplete
   * profile must still build services so the drawer can open and show the
   * "Cadastro incompleto" blocked state (see missingDoctorFields / resolveSession).
   */
  private validateProps(): boolean {
    const missing: string[] = [];
    if (!this.apiKey) missing.push('api-key');
    if (!this.apiUrl) missing.push('api-url');

    if (missing.length > 0) {
      console.error(
        `[EvidenceOne] Propriedades obrigatórias ausentes: ${missing.join(', ')}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Required doctor-* fields that are missing/empty (client_provided mode only).
   * In partner_gateway mode the server resolves the profile, so completeness is
   * decided server-side (422 PROFILE_INCOMPLETE) and this returns []. Field names
   * match the server's `missing` payload so client- and server-driven blocks agree.
   */
  private missingDoctorFields(): string[] {
    if (this.partnerToken) return [];
    const missing: string[] = [];
    if (!this.doctorEmail) missing.push('email');
    if (!this.doctorName) missing.push('name');
    if (!this.doctorCrm) missing.push('crm');
    if (!this.doctorPhone) missing.push('phone');
    return missing;
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

  /** Defensive enum normalization — Stencil passes raw attribute strings, so unknown values fall back to default. */
  private normalizedSize(): ButtonSize {
    return this.buttonSize === 'sm' || this.buttonSize === 'lg' ? this.buttonSize : 'md';
  }
  private normalizedPlacement(): Placement {
    return this.placement === 'left' ? 'left' : 'right';
  }
  private normalizedVariant(): Variant {
    return this.variant === 'inline' ? 'inline' : 'floating';
  }

  /** Drawer side is bound to placement only when floating; inline always opens a right-side drawer. */
  private drawerSide(): Placement {
    return this.normalizedVariant() === 'floating' ? this.normalizedPlacement() : 'right';
  }

  private async verifyBrandIntegrity() {
    if (!this.triggerRef) {
      // Defensive: ref not attached yet — verify the label-as-source-string.
      const okText = await verifyBrand(BRAND_TRIGGER_TEXT, 'trigger');
      this.integrityFailed = !okText;
      return;
    }
    const labelEl =
      this.triggerRef.querySelector('.eo-pill__label, .eo-fab__label') ?? this.triggerRef;
    const rendered = (labelEl.textContent ?? '').trim();
    const ok = await verifyBrand(rendered, 'trigger');
    this.integrityFailed = !ok;
    if (!ok) {
      console.error('[EvidenceOne] Falha de integridade da marca — autenticação bloqueada.');
    }
  }

  private handleTriggerClick = (e: MouseEvent) => {
    this.triggerEl = e.currentTarget as HTMLElement;
    this.openDrawer();
  };

  private async openDrawer() {
    if (this.integrityFailed || !isBrandIntact()) {
      console.error('[EvidenceOne] Drawer não pode ser aberto — falha de integridade da marca.');
      return;
    }
    this.isOpen = true;
    await this.resolveSession();
  }

  /**
   * Resolve (or re-resolve) the partner session for the open drawer. Runs on
   * every open and on retry, so the completeness gate is re-checked each time.
   */
  private async resolveSession() {
    if (!this.authService) return; // transport props invalid — logged

    // Completeness gate (client_provided): incomplete doctor data blocks the
    // session with "Cadastro incompleto" before any network round-trip, and
    // emits eoBlocked with the missing field names.
    const missing = this.missingDoctorFields();
    if (missing.length > 0) {
      this.authService.clearToken();
      this.authStatus = 'blocked';
      this.eoBlocked.emit({ missing });
      return;
    }

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

    // No cached token (including after a block) → re-resolve. In gateway mode this
    // is also where a server-side incomplete profile (422) becomes a block.
    await this.attemptAuth();
  }

  /**
   * Resolve a partner session. `blocked` (422 PROFILE_INCOMPLETE) is a distinct
   * outcome from `error` — it surfaces the block state and the `eoBlocked` event
   * instead of a generic auth failure.
   */
  private async attemptAuth() {
    if (!this.authService) return;
    this.authService.setIdentity(this.identityPayload());
    this.authStatus = 'loading';
    try {
      await this.authService.ensureValidToken();
      this.authStatus = 'ready';
      const sessionId = this.authService.getSessionId();
      if (sessionId) {
        this.eoReady.emit({ sessionId });
      }
    } catch (err) {
      if (err instanceof ProfileIncompleteError) {
        this.authStatus = 'blocked';
        this.eoBlocked.emit({ missing: err.missing });
        return;
      }
      this.authStatus = 'error';
      this.eoError.emit({
        code: 'AUTH_FAILED',
        message: (err as Error).message || 'Falha na autenticação',
      });
    }
  }

  private identityPayload(): IdentityPayload {
    return this.partnerToken
      ? { partnerToken: this.partnerToken, lookup: this.partnerLookup }
      : { doctor: this.cachedDoctorData as DoctorData };
  }

  private handleRetry = () => {
    // Explicit user action from the blocked state: force a fresh
    // re-authentication (clear any token, re-send the current doctor data) so
    // the server re-checks completeness. Shows the loading state, then resolves
    // to ready / blocked / error — never a silent no-op.
    this.authService?.clearToken();
    void this.attemptAuth();
  };

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
    const size = this.normalizedSize();
    const variant = this.normalizedVariant();
    const placement = this.normalizedPlacement();

    return (
      <Host>
        <div class="eo-scope">
          {this.integrityFailed ? (
            <span class="eo-integrity-error" role="alert">
              EvidenceOne · erro de integridade
            </span>
          ) : variant === 'inline' ? (
            <button
              class={`eo-pill eo-pill--${size}`}
              type="button"
              onClick={this.handleTriggerClick}
              ref={(el) => (this.triggerRef = el as HTMLElement | undefined)}
            >
              <span class="eo-pill__mark" innerHTML={E1_MARK_SVG} aria-hidden="true" />
              <span class="eo-pill__label">{BRAND_TRIGGER_TEXT}</span>
            </button>
          ) : (
            <button
              class={`eo-fab eo-trigger--${size} eo-trigger--floating eo-trigger--anchor-${placement}`}
              type="button"
              aria-label={BRAND_TRIGGER_TEXT}
              onClick={this.handleTriggerClick}
              ref={(el) => (this.triggerRef = el as HTMLElement | undefined)}
            >
              <span class="eo-fab__label">{BRAND_TRIGGER_TEXT}</span>
              <span class="eo-fab__mark" innerHTML={E1_MARK_SVG} aria-hidden="true" />
            </button>
          )}
          <eo-drawer
            isOpen={this.isOpen}
            side={this.drawerSide()}
            triggerEl={this.triggerEl}
            onEoDrawerClose={this.handleDrawerClose}
          >
            <eo-chat
              authStatus={this.authStatus}
              authService={this.authService}
              chatService={this.chatService}
              resetKey={this.resetKey}
              onEoChatClose={() => { this.handleDrawerClose(); }}
              onEoChatNewSession={() => { this.handleNewSession(); }}
              onEoChatRetry={() => { this.handleRetry(); }}
            />
          </eo-drawer>
        </div>
      </Host>
    );
  }
}
