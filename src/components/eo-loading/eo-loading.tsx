import { Component, Host, h } from '@stencil/core';

@Component({
  tag: 'eo-loading',
  styleUrl: 'eo-loading.css',
  shadow: true,
})
export class EoLoading {
  render() {
    return (
      <Host>
        <div class="eo-loading" aria-label="Carregando..." role="status">
          <span class="eo-dot" />
          <span class="eo-dot" />
          <span class="eo-dot" />
        </div>
      </Host>
    );
  }
}
