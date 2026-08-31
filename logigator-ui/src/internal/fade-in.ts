import { Directive, ElementRef, inject } from '@angular/core';
import { afterPaint } from './after-paint';

/**
 * Play an element in from a "from" state. Both class sets go on immediately,
 * so call this before the element is painted; the from classes lift after
 * that first paint and the transition runs. The transition classes stay on.
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
 * Internal. Fades its host in when it enters the DOM, the enter transition for
 * the non-modal overlay panels. Classes go on via `classList` in the
 * constructor rather than a binding, so the transparent state is there at the
 * first paint.
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
 * Internal. Scale-and-fade sibling of {@link LgFadeIn} for the modal surfaces:
 * transparent at 95% scale from the first paint, in over 300ms.
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
