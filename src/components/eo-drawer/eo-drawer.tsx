import { Component, Element, Event, EventEmitter, Host, Prop, Watch, h } from '@stencil/core';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/body-scroll-lock';
import { setupFocusTrap } from '../../utils/focus-trap';

@Component({
  tag: 'eo-drawer',
  styleUrl: 'eo-drawer.css',
  shadow: true,
})
export class EoDrawer {
  // 1. @Prop
  @Prop() isOpen: boolean = false;
  /**
   * Element to restore keyboard focus to when the drawer closes.
   * Parent (evidenceone-chat) captures this on trigger-button activation.
   */
  @Prop() triggerEl: HTMLElement | undefined;

  // 3. @Event
  @Event() eoDrawerClose: EventEmitter<void>;

  // 4. @Element
  @Element() el: HTMLElement;

  // Internal
  private holdingLock = false;
  private releaseFocusTrap: (() => void) | undefined;
  private isMounted = false;

  // 5. Lifecycle
  @Watch('isOpen')
  handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      this.acquireLockAndTrap();
    } else {
      this.releaseLockAndTrap();
    }
  }

  componentDidLoad() {
    this.isMounted = true;
    document.addEventListener('keydown', this.handleKeyDown);
    // Single acquisition entry point — @Watch handles runtime changes.
    // If the drawer was rendered with isOpen=true on first mount, acquire once here.
    if (this.isOpen && !this.holdingLock) {
      this.acquireLockAndTrap();
    }
  }

  disconnectedCallback() {
    this.isMounted = false;
    document.removeEventListener('keydown', this.handleKeyDown);
    this.releaseLockAndTrap();
  }

  // 7. Private methods
  private acquireLockAndTrap() {
    if (!this.holdingLock) {
      lockBodyScroll();
      this.holdingLock = true;
    }
    if (this.releaseFocusTrap) return; // already trapped

    // Defer focus trap setup — lets Stencil render slotted content first so
    // focusable descendants (inside eo-chat's shadow DOM) actually exist.
    requestAnimationFrame(() => {
      if (!this.isMounted || !this.isOpen) return;
      // `this.el` is the drawer host; its light DOM contains the slotted <eo-chat>
      // whose own shadow DOM the trap recurses into.
      this.releaseFocusTrap = setupFocusTrap(this.el, this.triggerEl ?? null);
    });
  }

  private releaseLockAndTrap() {
    if (this.holdingLock) {
      unlockBodyScroll();
      this.holdingLock = false;
    }
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = undefined;
  }

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
        <div
          class={{ 'eo-drawer': true, 'eo-drawer--open': this.isOpen }}
          role="dialog"
          aria-modal="true"
          aria-label="Chat com assistente EvidenceOne"
        >
          <slot />
        </div>
      </Host>
    );
  }
}
