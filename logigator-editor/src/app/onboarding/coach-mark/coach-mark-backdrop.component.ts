import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/** Padding (px) between the highlight ring and the target's bounding box. */
const RING_PAD = 6;

/**
 * The tutorial's click-through dim: a soft full-viewport shade plus a highlight
 * ring around the current target, drawing the eye without masking or blocking
 * input (per the tolerant interaction model — the user can act on anything at
 * any time). Purely visual; `pointer-events` stay off throughout.
 *
 * `targetRect` is the target's viewport rect (or null for centered, targetless
 * steps); the controller refreshes it on scroll/resize so the ring tracks.
 */
@Component({
  selector: 'app-coach-mark-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-0" aria-hidden="true">
      <div class="absolute inset-0 bg-black/30 backdrop-brightness-95"></div>
      @if (ring(); as r) {
        <div
          class="absolute rounded-md ring-2 ring-primary transition-all duration-150"
          [style.left.px]="r.left"
          [style.top.px]="r.top"
          [style.width.px]="r.width"
          [style.height.px]="r.height"
        ></div>
      }
    </div>
  `
})
export class CoachMarkBackdropComponent {
  public readonly targetRect = input<DOMRect | null>(null);

  protected readonly ring = computed(() => {
    const rect = this.targetRect();
    if (!rect) return null;
    return {
      left: rect.left - RING_PAD,
      top: rect.top - RING_PAD,
      width: rect.width + RING_PAD * 2,
      height: rect.height + RING_PAD * 2
    };
  });
}
