import { Component, Event, EventEmitter, Host, Prop, h } from '@stencil/core';
import { CLOCK_SVG } from '../../assets/icons';

/**
 * Maintenance screen — replaces the chat body (and the composer) while the
 * EvidenceOne service is unavailable, so no question is sent in degraded
 * conditions. Presentation only: the parent owns the availability state and
 * the re-check behind "Tentar novamente".
 */
@Component({
  tag: 'eo-maintenance',
  styleUrl: 'eo-maintenance.css',
  shadow: true,
})
export class EoMaintenance {
  // 1. @Prop
  /** True while the parent re-checks availability — the screen stays up with a button spinner. */
  @Prop() checking: boolean = false;

  // 3. @Event
  /** Emitted on "Tentar novamente" — the parent re-checks availability. */
  @Event() eoMaintenanceRetry!: EventEmitter<void>;

  // 7. Private methods
  private handleRetry = () => {
    if (this.checking) return;
    this.eoMaintenanceRetry.emit();
  };

  // 8. render()
  render() {
    return (
      <Host>
        <div class="eo-maintenance" role="alert">
          <span class="eo-maintenance-icon" aria-hidden="true" innerHTML={CLOCK_SVG} />
          <h2 class="eo-maintenance-title">Estamos em manutenção</h2>
          <p class="eo-maintenance-text">
            O EvidenceOne está temporariamente indisponível. Tente novamente mais tarde.
          </p>
          <button
            type="button"
            class="eo-maintenance-retry"
            // `disabled` while checking would drop focus to <body>; keep the
            // button focusable and gate activation in handleRetry instead.
            aria-disabled={this.checking ? 'true' : 'false'}
            aria-busy={this.checking ? 'true' : 'false'}
            onClick={this.handleRetry}
          >
            {this.checking && <span class="eo-maintenance-spinner" aria-hidden="true" />}
            {this.checking ? 'Verificando…' : 'Tentar novamente'}
          </button>
        </div>
      </Host>
    );
  }
}
