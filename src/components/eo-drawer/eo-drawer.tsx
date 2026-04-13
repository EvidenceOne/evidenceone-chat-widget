import { Component, Event, EventEmitter, Host, Prop, Watch, h } from '@stencil/core';

@Component({
  tag: 'eo-drawer',
  styleUrl: 'eo-drawer.css',
  shadow: true,
})
export class EoDrawer {
  // 1. @Prop
  @Prop() isOpen: boolean = false;

  // 3. @Event
  @Event() eoDrawerClose: EventEmitter<void>;

  // 5. Lifecycle
  @Watch('isOpen')
  handleOpenChange(isOpen: boolean) {
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  componentDidLoad() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleKeyDown);
    // Restore body scroll when component is removed
    document.body.style.overflow = '';
  }

  // 7. Private methods
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isOpen) {
      this.eoDrawerClose.emit();
    }
  };

  // 8. render()
  render() {
    return (
      <Host>
        <div
          class={{ 'eo-backdrop': true, 'eo-backdrop--open': this.isOpen }}
          onClick={() => this.eoDrawerClose.emit()}
        />
        <div class={{ 'eo-drawer': true, 'eo-drawer--open': this.isOpen }}>
          <slot />
        </div>
      </Host>
    );
  }
}
