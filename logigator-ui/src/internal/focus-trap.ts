import {
  ConfigurableFocusTrap,
  ConfigurableFocusTrapFactory
} from '@angular/cdk/a11y';

/**
 * A `cdk/a11y` `ConfigurableFocusTrap` plus focus restore: what every modal
 * overlay needs. Construct it with the injected
 * {@link ConfigurableFocusTrapFactory}.
 */
export class LgFocusTrap {
  private trap: ConfigurableFocusTrap | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(private readonly factory: ConfigurableFocusTrapFactory) {}

  trapFocus(element: HTMLElement): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.trap = this.factory.create(element);
    this.trap.focusInitialElementWhenReady();
  }

  release(): void {
    this.trap?.destroy();
    this.trap = null;
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
  }
}
