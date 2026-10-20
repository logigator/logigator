import {
  ConfigurableFocusTrap,
  ConfigurableFocusTrapFactory,
  InteractivityChecker
} from '@angular/cdk/a11y';
import { afterNextRender, AfterRenderRef, Injector } from '@angular/core';

/**
 * Marks an element initial focus passes over, such as a header's help
 * button: it stays in the tab order, but opening the surface lands on the
 * next tabbable element instead. Written literally in templates.
 */
export const SKIP_INITIAL_FOCUS = 'data-lg-skip-initial-focus';

/**
 * A `cdk/a11y` `ConfigurableFocusTrap` plus focus restore: what every modal
 * overlay needs. Initial focus, once the surface has rendered, goes to a
 * `cdkFocusInitial` element if there is one, else to the first tabbable
 * element not marked {@link SKIP_INITIAL_FOCUS}, else to whatever the cdk
 * trap picks.
 */
export class LgFocusTrap {
  private trap: ConfigurableFocusTrap | null = null;
  private initialFocus: AfterRenderRef | null = null;
  private previouslyFocused: HTMLElement | null = null;

  constructor(private readonly injector: Injector) {}

  trapFocus(element: HTMLElement): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    const trap = this.injector
      .get(ConfigurableFocusTrapFactory)
      .create(element);
    this.trap = trap;
    this.initialFocus = afterNextRender(
      () => this.focusInitialElement(trap, element),
      { injector: this.injector }
    );
  }

  release(): void {
    this.initialFocus?.destroy();
    this.initialFocus = null;
    this.trap?.destroy();
    this.trap = null;
    this.previouslyFocused?.focus?.();
    this.previouslyFocused = null;
  }

  private focusInitialElement(
    trap: ConfigurableFocusTrap,
    root: HTMLElement
  ): void {
    this.initialFocus = null;
    if (!root.querySelector('[cdk-focus-initial], [cdkFocusInitial]')) {
      const checker = this.injector.get(InteractivityChecker);
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (
          !el.closest(`[${SKIP_INITIAL_FOCUS}]`) &&
          checker.isFocusable(el) &&
          checker.isTabbable(el)
        ) {
          el.focus();
          return;
        }
      }
    }
    trap.focusInitialElement();
  }
}
