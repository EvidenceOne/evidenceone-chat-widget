import { Component, Element, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import { SHIELD_SVG } from '../../assets/icons';
import { getDeepActiveElement, getFocusableElements } from '../../utils/focus-trap';

/**
 * Legal-document URLs — hardcoded on purpose, same class of constant as the
 * rest of the brand (spec §3.1): partners cannot point the consent links
 * elsewhere.
 */
const TERMS_URL = 'https://www.evidence1.com/privacidade#termos';
const PRIVACY_URL = 'https://www.evidence1.com/privacidade#privacidade';

/**
 * Consent opt-in screen — gates the chat until the mandatory Terms checkbox
 * is accepted and the server confirms (parent owns the network call; this
 * component is presentation + a11y only).
 *
 * Frozen design variants (spec §3.1): highlighted hierarchy, compact density,
 * gray disabled button.
 */
@Component({
  tag: 'eo-consent',
  styleUrl: 'eo-consent.css',
  shadow: true,
})
export class EoConsent {
  // 1. @Prop
  /** Prefill for the optional comms checkbox — true only on re-consent (spec §3.1). */
  @Prop() prefillComms: boolean = false;
  /** True while the parent awaits the server's 201 — locks controls, shows spinner. */
  @Prop() saving: boolean = false;
  /** True when the last accept attempt failed — renders the error banner. */
  @Prop() error: boolean = false;

  // 2. @State
  @State() termsChecked: boolean = false;
  @State() commsChecked: boolean = false;

  // 3. @Event
  @Event() eoConsentAccept!: EventEmitter<{ comms: boolean }>;
  @Event() eoConsentCancel!: EventEmitter<void>;

  // 4. @Element
  @Element() el!: HTMLElement;

  private termsInputEl: HTMLInputElement | undefined;

  // 5. Lifecycle
  componentWillLoad() {
    // Terms ALWAYS starts unchecked; comms follows the server on re-consent.
    this.commsChecked = this.prefillComms;
  }

  componentDidLoad() {
    // Card-scoped focus trap (capture phase, registered after the drawer's
    // trap so this one has the last word on Tab).
    document.addEventListener('keydown', this.handleTrapKeydown, true);
    // Initial focus on the first checkbox — rAF so it lands after the drawer
    // trap's own install-time focus when both mount in the same frame.
    requestAnimationFrame(() => this.termsInputEl?.focus());
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleTrapKeydown, true);
  }

  // 7. Private methods
  /**
   * Tab/Shift+Tab cycle only inside the card (spec §3.1) — the drawer trap
   * can't provide this: its scope is the whole drawer (header included) and
   * it resolves the active element at document level, which shadow DOM masks.
   */
  private handleTrapKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const shadowRoot = this.el.shadowRoot;
    if (!shadowRoot) return;
    const focusables = getFocusableElements(shadowRoot);
    if (focusables.length === 0) return;

    const active = getDeepActiveElement();
    const idx = focusables.indexOf(active as HTMLElement);
    if (idx === -1) {
      // Focus escaped the card (e.g. header close button) — pull it back.
      e.preventDefault();
      focusables[0].focus();
      return;
    }
    const next = e.shiftKey ? idx - 1 : idx + 1;
    if (next < 0) {
      e.preventDefault();
      focusables[focusables.length - 1].focus();
    } else if (next >= focusables.length) {
      e.preventDefault();
      focusables[0].focus();
    }
    // In-range moves are left to the browser (natural order inside the card).
  };

  private handleContinue = () => {
    if (!this.termsChecked || this.saving) return;
    this.eoConsentAccept.emit({ comms: this.commsChecked });
  };

  private handleCancel = () => {
    if (this.saving) return;
    this.eoConsentCancel.emit();
  };

  private renderCheckIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  // 8. render()
  render() {
    const continueDisabled = !this.termsChecked || this.saving;

    return (
      <Host>
        <div
          class="eo-consent"
          role="dialog"
          aria-modal="true"
          aria-labelledby="eo-consent-title"
          aria-describedby="eo-consent-desc"
        >
          <div class="eo-consent-icon" aria-hidden="true" innerHTML={SHIELD_SVG} />

          <h2 id="eo-consent-title" class="eo-consent-title">
            Antes de começar
          </h2>
          <p id="eo-consent-desc" class="eo-consent-desc">
            Para usar o EvidenceOne, precisamos do seu aceite.
          </p>

          <label class="eo-check eo-check--card">
            <input
              type="checkbox"
              class="eo-check-input"
              checked={this.termsChecked}
              disabled={this.saving}
              aria-required="true"
              onChange={(e) => (this.termsChecked = (e.target as HTMLInputElement).checked)}
              ref={(el) => (this.termsInputEl = el)}
            />
            <span class="eo-check-box" aria-hidden="true">
              {this.renderCheckIcon()}
            </span>
            <span class="eo-check-label">
              Li e aceito os{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                Termos de Uso
              </a>{' '}
              e a{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </a>{' '}
              do EvidenceOne
              <span class="eo-check-tag">Obrigatório</span>
            </span>
          </label>

          <label class="eo-check">
            <input
              type="checkbox"
              class="eo-check-input"
              checked={this.commsChecked}
              disabled={this.saving}
              onChange={(e) => (this.commsChecked = (e.target as HTMLInputElement).checked)}
            />
            <span class="eo-check-box" aria-hidden="true">
              {this.renderCheckIcon()}
            </span>
            <span class="eo-check-label">
              Quero receber novidades e melhorias do EvidenceOne em primeira mão
            </span>
          </label>

          <div role="alert" class="eo-consent-alert">
            {this.error && (
              <div class="eo-consent-error">
                <strong>Não conseguimos registrar seu aceite</strong>
                <span>Verifique sua conexão e clique em "Continuar" novamente.</span>
              </div>
            )}
          </div>

          <div class="eo-consent-actions">
            <button
              type="button"
              class="eo-consent-btn eo-consent-btn--ghost"
              disabled={this.saving}
              onClick={this.handleCancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              class="eo-consent-btn eo-consent-btn--primary"
              disabled={continueDisabled}
              aria-disabled={continueDisabled ? 'true' : 'false'}
              onClick={this.handleContinue}
            >
              {this.saving && <span class="eo-consent-spinner" aria-hidden="true" />}
              Continuar
            </button>
          </div>
        </div>
      </Host>
    );
  }
}
