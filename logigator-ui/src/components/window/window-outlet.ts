import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal
} from '@angular/core';
import { WindowSize } from './window-config';
import { LgWindow } from './window';
import { WindowService } from './window.service';

/**
 * The {@link WindowService} outlet: renders every open window as an absolutely
 * positioned child, so the host element doubles as the windows' drag/resize
 * bounds. Place it inside the container the windows should float over (e.g.
 * the editor's board area) — the host is pointer-transparent, each window
 * re-enables its own pointer events. Stacking against sibling overlays is the
 * consumer's business: pass a `z-*` class on the element.
 *
 * A `fullscreen` outlet renders every window as an outlet-filling takeover
 * (back button, no drag/resize) instead — a compact-breakpoint alternative.
 * Every outlet in the tree renders **all** open windows, so keep at most one
 * outlet alive at a time (e.g. swap a floating and a fullscreen one under a
 * breakpoint condition); two live outlets would instantiate every window's
 * content twice.
 */
@Component({
  selector: 'lg-window-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgWindow],
  host: {
    class: 'pointer-events-none absolute inset-0 block'
  },
  template: `
    @for (window of windows(); track window.id) {
      <lg-window
        [entry]="window"
        [bounds]="bounds()"
        [fullscreen]="fullscreen()"
      />
    }
  `
})
export class LgWindowOutlet {
  /** Render windows as outlet-filling takeovers instead of floating panels. */
  readonly fullscreen = input(false, { transform: booleanAttribute });

  protected readonly windows = inject(WindowService).windows;

  /** The host's measured size — the clamping bounds handed to each window. */
  protected readonly bounds = signal<WindowSize>({ width: 0, height: 0 });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure(host);
      // Guarded for test environments without ResizeObserver.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.measure(host));
        observer.observe(host);
        destroyRef.onDestroy(() => observer.disconnect());
      }
    });
  }

  private measure(host: HTMLElement): void {
    this.bounds.set({ width: host.clientWidth, height: host.clientHeight });
  }
}
