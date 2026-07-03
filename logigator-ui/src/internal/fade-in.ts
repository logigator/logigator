import { Directive, ElementRef, inject } from '@angular/core';
import { afterPaint } from './after-paint';

/**
 * Fades its host in when it enters the DOM — the enter transition for the
 * non-modal overlay panels (Tooltip, Menu, Popover, ConfirmPopup, Select). The
 * classes
 * go on via `classList` in the constructor (not a class binding) so the
 * transparent "from" state is present at the very first paint even though
 * bindings only apply on the first change-detection tick; {@link afterPaint}
 * then lifts it and the 200ms opacity transition runs.
 *
 * Internal — not part of the public API.
 */
@Directive({ selector: '[lgFadeIn]' })
export class LgFadeIn {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    el.classList.add('opacity-0', 'transition-opacity', 'duration-200');
    afterPaint(() => el.classList.remove('opacity-0'));
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
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    el.classList.add(
      'opacity-0',
      'scale-95',
      'transition',
      'duration-300',
      'ease-out'
    );
    afterPaint(() => el.classList.remove('opacity-0', 'scale-95'));
  }
}
