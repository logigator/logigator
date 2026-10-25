import {
  afterNextRender,
  booleanAttribute,
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
import { lgLabel } from '../../tokens/labels';

/**
 * The {@link WindowService} outlet: every open window as an absolutely
 * positioned child, so the host doubles as their drag/resize bounds. The host
 * is pointer-transparent and each window re-enables its own pointer events;
 * stacking against sibling overlays is a `z-*` class the consumer passes.
 *
 * A `fullscreen` outlet renders each window as an outlet-filling takeover
 * instead. Every outlet in the tree renders **all** open windows, so keep at
 * most one alive: two would instantiate every window's content twice.
 */
@Component({
  selector: 'lg-window-outlet',
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
        [closeLabel]="closeLabel()"
        [backLabel]="backLabel()"
      />
    }
  `
})
export class LgWindowOutlet {
  /** Render windows as outlet-filling takeovers instead of floating panels. */
  readonly fullscreen = input(false, { transform: booleanAttribute });
  /** ARIA label for every window's close button; localize it. */
  readonly closeLabel = input(lgLabel('close'));
  /** ARIA label for the fullscreen back button; localize it. */
  readonly backLabel = input(lgLabel('back'));

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
