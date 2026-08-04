import {
  ConfigurableFocusTrap,
  ConfigurableFocusTrapFactory
} from '@angular/cdk/a11y';

/**
 * A `cdk/a11y` `ConfigurableFocusTrap` plus focus restore — the behavior every
 * modal overlay (Dialog, Drawer, ConfirmDialog) needs: trap Tab focus inside
 * the surface while open, then return focus to whatever was focused before it
 * opened. Construct with the injected {@link ConfigurableFocusTrapFactory}.
 */
export class LgFocusTrap {
  private trap: ConfigurableFocusTrap | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(private readonly factory: ConfigurableFocusTrapFactory) {}

  /** Trap focus inside `element`, remembering the current `activeElement`. */
  trapFocus(element: HTMLElement): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.trap = this.factory.create(element);
    this.trap.focusInitialElementWhenReady();
  }

  /** Tear down the trap and restore focus to the pre-trap element. */
  release(): void {
    this.trap?.destroy();
    this.trap = null;
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
  }
}
