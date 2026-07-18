import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/** Padding (px) between the highlight ring/cutout and the target's box. */
const RING_PAD = 6;
/** Corner radius (px) of the punched-out target region. */
const HOLE_RADIUS = 6;

interface Hole {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/**
 * The tutorial's click-through dim: a soft full-viewport shade with real holes
 * punched out around whatever the current step wants the user to act on — the
 * anchored target (a palette item, tool, button) and the board canvas — so the
 * dim never sits over something the step tells the user to interact with. The
 * target also gets a highlight ring. Purely visual; `pointer-events` stay off
 * throughout (per the tolerant interaction model — the user can act on anything
 * at any time).
 *
 * `targetRect` is the anchored target's viewport rect (or null for centered,
 * targetless steps); `canvasRect` is the board's rect. The controller refreshes
 * both on scroll/resize so the holes and ring track.
 */
@Component({
  selector: 'app-coach-mark-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-0" aria-hidden="true">
      <svg class="absolute inset-0 h-full w-full">
        <defs>
          <mask id="coach-mark-spotlight">
            <rect width="100%" height="100%" fill="white" />
            @for (h of holes(); track $index) {
              <rect
                [attr.x]="h.left"
                [attr.y]="h.top"
                [attr.width]="h.width"
                [attr.height]="h.height"
                [attr.rx]="h.radius"
                [attr.ry]="h.radius"
                fill="black"
              />
            }
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="black"
          fill-opacity="0.3"
          mask="url(#coach-mark-spotlight)"
        />
      </svg>
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
  public readonly canvasRect = input<DOMRect | null>(null);

  /** Regions cut out of the dim: the board canvas and the padded target. */
  protected readonly holes = computed<Hole[]>(() => {
    const out: Hole[] = [];
    const canvas = this.canvasRect();
    if (canvas) {
      out.push({
        left: canvas.left,
        top: canvas.top,
        width: canvas.width,
        height: canvas.height,
        radius: 0
      });
    }
    const ring = this.ring();
    if (ring) out.push({ ...ring, radius: HOLE_RADIUS });
    return out;
  });

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
