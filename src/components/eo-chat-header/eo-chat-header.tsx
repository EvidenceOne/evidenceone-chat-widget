import { Component, Event, EventEmitter, Host, State, h } from '@stencil/core';
import { CLOSE_ICON_SVG, LOGO_SVG } from '../../assets/logo';
import { markBrandBroken, verifyBrand } from '../../utils/integrity';

/**
 * LOCKED HEADER. The EvidenceOne logo (`LOGO_SVG`) is rendered here via
 * innerHTML and verified at runtime in componentDidLoad. There is no
 * @Prop, no <slot>, and no other surface that allows the partner to
 * substitute or recolor the mark — this is intentional and must not be
 * relaxed without brand approval.
 *
 * Defenses against logo swap:
 *   1. L4b source-hash check: the LOGO_SVG constant is hashed at build
 *      time and re-checked at mount; bundle byte-patches are caught.
 *   2. MutationObserver on the rendered <span class="eo-logo">: any
 *      runtime DOM tampering (`el.shadowRoot.querySelector('.eo-logo').
 *      innerHTML = '...'`) triggers `markBrandBroken()`, which causes
 *      AuthService.register() to throw and the root component to render
 *      its integrity-error state.
 */
@Component({
  tag: 'eo-chat-header',
  styleUrl: 'eo-chat-header.css',
  shadow: true,
})
export class EoChatHeader {
  // 2. @State
  @State() logoIntact: boolean = true;

  // 3. @Event
  @Event() eoHeaderClose: EventEmitter<void>;
  @Event() eoHeaderNewSession: EventEmitter<void>;

  // Ref captured at render time — used by the integrity check to read
  // back the rendered SVG without depending on shadowRoot access.
  private logoEl: HTMLElement | undefined;
  private logoObserver: MutationObserver | undefined;

  // 5. Lifecycle
  async componentDidLoad() {
    const ok = await verifyBrand(LOGO_SVG, 'logo');
    this.logoIntact = ok;
    if (!ok) {
      console.error('[EvidenceOne] Logo integrity check failed.');
      return;
    }

    // Watch the rendered logo span for content changes. Any subtree
    // mutation latches the brand-broken flag, which short-circuits auth.
    if (this.logoEl && typeof MutationObserver !== 'undefined') {
      this.logoObserver = new MutationObserver(() => {
        markBrandBroken();
        this.logoIntact = false;
        console.error('[EvidenceOne] Logo DOM tampering detected.');
      });
      this.logoObserver.observe(this.logoEl, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    }
  }

  disconnectedCallback() {
    this.logoObserver?.disconnect();
    this.logoObserver = undefined;
  }

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-header">
          {this.logoIntact ? (
            <span
              class="eo-logo"
              innerHTML={LOGO_SVG}
              ref={(el) => (this.logoEl = el as HTMLElement | undefined)}
            />
          ) : (
            <span class="eo-logo eo-logo--error" role="alert">
              EvidenceOne
            </span>
          )}
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
