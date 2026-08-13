import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Listen,
  Prop,
  State,
  Watch,
  h,
} from '@stencil/core';
import { E1_MARK_SVG } from '../../assets/logo';
import { AuthStatus, DoctorData, EoErrorDetail, EoFeedbackDetail, IdentityPayload } from '../../models/types';
import { AuthService, ProfileIncompleteError } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ConsentService } from '../../services/consent.service';
import {
  BRAND_TRIGGER_TEXT,
  isBrandIntact,
  verifyBrand,
} from '../../utils/integrity';
import { ResolvedTheme, ThemePreference, resolveTheme } from '../../utils/theme';

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
  /**
   * Color scheme of the widget. Reactive — the host may flip it at any time.
   * 'auto' follows the page's `prefers-color-scheme` live.
   */
  @Prop({ reflect: true }) theme: ThemePreference = 'light';

  // 2. @State
  @State() isOpen: boolean = false;
  @State() authStatus: AuthStatus = 'idle';
  /** Bumped whenever a fresh session is requested — child eo-chat @Watch-es this to reset. */
  @State() resetKey: number = 0;
  /** True if brand integrity verification failed at mount. Render-blocks the trigger and short-circuits auth. */
  @State() integrityFailed: boolean = false;
  /** Concrete theme applied as data-theme on .eo-scope — resolved from the `theme` prop. */
  @State() resolvedTheme: ResolvedTheme = 'light';
  /** True while POST /partner/consent is in flight after "Continuar". */
  @State() consentSaving: boolean = false;
  /** True when the last accept attempt failed — eo-consent shows the banner. */
  @State() consentError: boolean = false;

  // 3. @Event
  @Event() eoReady!: EventEmitter<{ sessionId: string }>;
  @Event() eoError!: EventEmitter<EoErrorDetail>;
  /** Emitted when the partner session is blocked because the doctor profile is incomplete. */
  @Event() eoBlocked!: EventEmitter<{ missing: string[] }>;
  @Event() eoClose!: EventEmitter<void>;
  /**
   * Emitted when the user votes an answer útil/não útil. Frontend-only: no
   * network call is made — this event is the seam for future backend wiring
   * (spec §3.3, backlogged).
   */
  @Event() eoFeedback!: EventEmitter<EoFeedbackDetail>;

  // 4. @Element
  @Element() el!: HTMLElement;

  // Private — built once from props (rebuilt on @Watch)
  private authService: AuthService | undefined;
  private chatService: ChatService | undefined;
  private consentService: ConsentService | undefined;
  private cachedDoctorData: DoctorData | undefined;
  /** Element that triggered drawer open — focus returns here on close. */
  private triggerEl: HTMLElement | undefined;
  /** Ref to the rendered trigger button or pill — used for integrity check on its label. */
  private triggerRef: HTMLElement | undefined;
  /** Live media query behind theme='auto' — subscribed only while auto is active. */
  private darkMql: MediaQueryList | undefined;

  // 5. Lifecycle
  connectedCallback() {
    // Runs on first load and on DOM re-insertion — re-attaches the
    // prefers-color-scheme listener that disconnectedCallback tears down.
    this.applyTheme();
  }

  componentWillLoad() {
    if (!this.validateProps()) return;
    this.buildServices();
    this.cacheDoctorData();
  }

  async componentDidLoad() {
    await this.verifyBrandIntegrity();
  }

  disconnectedCallback() {
    this.detachSystemThemeListener();
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

  @Watch('theme')
  onThemeChange() {
    this.applyTheme();
  }

  // Consent events bubble composed from eo-consent (grandchild shadow DOM) up
  // to this host — @Listen is the child→root seam for them (spec §3.1).
  @Listen('eoConsentAccept')
  onConsentAccept(e: CustomEvent<{ comms: boolean }>) {
    void this.handleConsentAccept(e.detail.comms);
  }

  @Listen('eoConsentCancel')
  onConsentCancel() {
    this.handleDrawerClose();
  }

  // Bubble votes arrive from grandchild shadow DOM; re-emitted here as the
  // public eoFeedback with the sessionId attached.
  @Listen('eoMessageFeedback')
  onMessageFeedback(e: CustomEvent<{ messageIndex: number; vote: 'up' | 'down' }>) {
    this.eoFeedback.emit({
      sessionId: this.authService?.getSessionId() ?? '',
      messageIndex: e.detail.messageIndex,
      vote: e.detail.vote,
    });
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
    this.consentService = new ConsentService(this.apiUrl);
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

  /**
   * Resolve the `theme` prop into `resolvedTheme` and keep the
   * prefers-color-scheme subscription in sync: attached only while
   * theme='auto', so explicit light/dark never react to OS changes.
   */
  private applyTheme() {
    if (this.theme === 'auto') {
      this.attachSystemThemeListener();
    } else {
      this.detachSystemThemeListener();
    }
    this.resolvedTheme = resolveTheme(this.theme, this.darkMql?.matches ?? false);
  }

  private attachSystemThemeListener() {
    if (this.darkMql) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.darkMql = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkMql.addEventListener('change', this.onSystemThemeChange);
  }

  private detachSystemThemeListener() {
    if (!this.darkMql) return;
    this.darkMql.removeEventListener('change', this.onSystemThemeChange);
    this.darkMql = undefined;
  }

  private onSystemThemeChange = (e: MediaQueryListEvent) => {
    this.resolvedTheme = resolveTheme(this.theme, e.matches);
  };

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

    // Reuse existing valid token (AuthService manages its own cache). The
    // consent gate applies here too — without it, reopening the drawer with a
    // cached token would skip the opt-in (spec §2.3).
    const existing = this.authService.getToken();
    if (existing && !AuthService.isTokenExpired(existing)) {
      if (this.authService.getConsent().required) {
        this.enterConsent();
      } else {
        this.authStatus = 'ready';
      }
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
      // Consent gate: eoReady means "chat usable" (v4 breaking change) — when
      // consent is pending it is emitted only after acceptance, not here.
      if (this.authService.getConsent().required) {
        this.enterConsent();
        return;
      }
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

  /**
   * Present the consent screen with a clean slate — stale error/saving flags
   * from an earlier presentation (including a late accept-failure that landed
   * after the drawer was dismissed) must not leak into this one.
   */
  private enterConsent() {
    this.consentSaving = false;
    this.consentError = false;
    this.authStatus = 'consent';
  }

  /**
   * Single close path (X, backdrop, Cancelar). Dismissing during consent is a
   * refusal: logged fire-and-forget — a failed log must never trap the user in
   * the modal (spec §2.4). Consent stays `required` in AuthService memory, so
   * reopening on the same page shows the opt-in again until the server records
   * an accept.
   */
  private handleDrawerClose = () => {
    if (this.authStatus === 'consent') {
      // A pending acceptance must not be chased by a 'declined' event into
      // the consent trail — skip the refusal log while the POST is in flight.
      if (!this.consentSaving) {
        this.declineConsent();
      }
      // Back to idle so <eo-consent> unmounts: the drawer hides via CSS (its
      // slot stays in the DOM), and a mounted consent screen keeps a
      // document-level focus trap armed — it would hijack Tab on the partner
      // page. Unmounting also guarantees the Terms box starts unchecked on
      // the next presentation. The gate itself is re-derived from
      // AuthService.consent on reopen.
      this.authStatus = 'idle';
    }
    this.isOpen = false;
    this.eoClose.emit();
  };

  private declineConsent() {
    const token = this.authService?.getToken();
    if (token && this.consentService) {
      this.consentService.decline(token);
    }
  }

  /**
   * Chat hit 403 CONSENT_REQUIRED (server enforcement, stale local state).
   * The token stays — it is valid; only consent is missing (spec §2.5). The
   * in-memory consent flips to required so the cached-token reopen path keeps
   * gating, and the screen swaps to the opt-in.
   */
  private handleConsentRequired = () => {
    this.authService?.markConsentRequired();
    this.enterConsent();
  };

  private handleConsentAccept = async (comms: boolean) => {
    if (!this.authService || !this.consentService) return;
    const token = this.authService.getToken();
    if (!token) {
      this.consentError = true;
      return;
    }
    this.consentError = false;
    this.consentSaving = true;
    try {
      // Chat is released only after the server confirms (201) — spec §2.4.
      await this.consentService.accept(token, comms);
      this.authService.markConsentAccepted();
      this.authStatus = 'ready';
      const sessionId = this.authService.getSessionId();
      if (sessionId) {
        this.eoReady.emit({ sessionId });
      }
    } catch {
      this.consentError = true;
    } finally {
      this.consentSaving = false;
    }
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
        <div class="eo-scope" data-theme={this.resolvedTheme}>
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
            canEscClose={this.authStatus !== 'consent'}
            onEoDrawerClose={this.handleDrawerClose}
          >
            <eo-chat
              authStatus={this.authStatus}
              authService={this.authService}
              chatService={this.chatService}
              resetKey={this.resetKey}
              consentSaving={this.consentSaving}
              consentError={this.consentError}
              consentPrefillComms={this.authService?.getConsent().comms === true}
              onEoChatClose={() => { this.handleDrawerClose(); }}
              onEoChatNewSession={() => { this.handleNewSession(); }}
              onEoChatRetry={() => { this.handleRetry(); }}
              onEoChatConsentRequired={() => { this.handleConsentRequired(); }}
            />
          </eo-drawer>
        </div>
      </Host>
    );
  }
}
