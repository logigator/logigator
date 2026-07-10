import { Directive, ElementRef, inject } from '@angular/core';
import { afterPaint } from './after-paint';

/**
 * Play an element in from a "from" state: both class sets go on immediately
 * (call this while the element is not yet painted — construction / right after
 * portal attach), so the very first paint shows the from state; after that
 * paint the from classes lift and the CSS transition runs. The transition
 * classes stay on.
 */
export function playEnterTransition(
  el: HTMLElement,
  fromClasses: string[],
  transitionClasses: string[]
): void {
  el.classList.add(...transitionClasses, ...fromClasses);
  afterPaint(() => el.classList.remove(...fromClasses));
}

/**
 * Fades its host in when it enters the DOM — the enter transition for the
 * non-modal overlay panels (Tooltip, Menu, Popover, ConfirmPopup, Select).
 * Classes go on via `classList` in the constructor (not a binding) so the
 * transparent "from" state is present at the first paint; {@link afterPaint}
 * then lifts it and the 200ms opacity transition runs.
 *
 * Internal — not part of the public API.
 */
@Directive({ selector: '[lgFadeIn]' })
export class LgFadeIn {
  constructor() {
    playEnterTransition(
      inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      ['opacity-0'],
      ['transition-opacity', 'duration-200']
    );
  }
}

/**
 * Scale-and-fade sibling of {@link LgFadeIn} for the modal surfaces (Dialog,
 * DynamicDialog): the panel starts transparent at 95% scale from the very
 * first paint and plays in over a decelerating 300ms.
 *
 * Internal — not part of the public API.
 */
@Directive({ selector: '[lgScaleIn]' })
export class LgScaleIn {
  constructor() {
    playEnterTransition(
      inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      ['opacity-0', 'scale-95'],
      ['transition', 'duration-300', 'ease-out']
    );
  }
}
