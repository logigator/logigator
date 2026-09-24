import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Material-style click ripple: a short-lived span at the pointer location that
 * scales out and fades in `currentColor`. The host is made
 * `position: relative; overflow: hidden`.
 */
@Directive({
  selector: '[lgRipple]',
  host: {
    class: 'relative overflow-hidden',
    '(pointerdown)': 'onPointerDown($event)'
  }
})
export class LgRipple {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onPointerDown(event: PointerEvent): void {
    const el = this.host.nativeElement;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.cssText =
      `position:absolute;border-radius:9999px;pointer-events:none;` +
      `background:currentColor;opacity:0.15;width:${size}px;height:${size}px;` +
      `left:${event.clientX - rect.left - size / 2}px;` +
      `top:${event.clientY - rect.top - size / 2}px;transform:scale(0);`;
    el.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transition =
        'transform 0.4s ease-out, opacity 0.5s ease-out';
      ripple.style.transform = 'scale(1)';
      ripple.style.opacity = '0';
    });
    // The timeout covers a transition that never fires, under reduced motion
    // or a `transition: none` override.
    const remove = () => ripple.remove();
    ripple.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 600);
  }
}
