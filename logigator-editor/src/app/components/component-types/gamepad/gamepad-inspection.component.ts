import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal
} from '@angular/core';
import { GamepadKeyboardService } from '../../../inspection/gamepad/gamepad-keyboard.service';
import { LayoutService } from '../../../layout/layout.service';
import { GamepadBindingsService } from '../../../shortcuts/gamepad-bindings.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import type { GamepadInspection } from './gamepad-inspection';
import {
  GamepadPadComponent,
  GamepadPadPointer
} from './pad/gamepad-pad.component';
import { PAD_VIEWBOX } from './pad/gamepad-pad-layout';

/** The element framing the view: the window, or the sheet's panel. */
const FRAME_SELECTOR = '[role="dialog"]';

/**
 * The gamepad's window: the pad in `play` mode over a status footer. Keys
 * reach the pad while focus is anywhere inside the frame hosting it, so the
 * view registers that frame with {@link GamepadKeyboardService} and takes the
 * focus itself when it opens, so keys work at once.
 *
 * On compact the pad fills the sheet with enlarged hit regions, and the
 * footer and keycap chips show only once a keyboard is known to be at hand:
 * a fine pointer exists, or a key has been pressed since the view opened.
 */
@Component({
  selector: 'app-gamepad-inspection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GamepadPadComponent, TranslateDirective],
  host: {
    class: 'flex h-full flex-col gap-2 outline-none',
    tabindex: '-1',
    '(pointerdown)': 'claimFocus()'
  },
  template: `
    <div
      class="flex min-h-0 grow items-center justify-center [container-type:size]"
    >
      <app-gamepad-pad
        [style.width]="padWidth"
        [controls]="inspection().controls"
        [names]="inspection().names"
        mode="play"
        [pressed]="inspection().pressed()"
        [keyCaps]="keyCaps()"
        [keyboardActive]="focused()"
        [keyboardPresent]="keyboardPresent()"
        [enlarged]="compact()"
        (controlDown)="onControlDown($event)"
        (controlUp)="onControlUp($event)"
      />
    </div>
    @if (showFooter()) {
      <div
        *appTranslate="let t"
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      >
        @if (focused()) {
          <span class="flex items-center gap-1.5 text-primary">
            <i class="ph ph-keyboard" aria-hidden="true"></i>
            {{ t('components.def.GAMEPAD.window.keyboardActive') }}
          </span>
        } @else {
          <span class="text-muted">
            {{ t('components.def.GAMEPAD.window.keyboardInactive') }}
          </span>
        }
        <span class="grow"></span>
        <!-- Controls beside the status, right-aligned: the controller
             select, then the Assign keys toggle. -->
      </div>
    }
  `
})
export class GamepadInspectionComponent {
  public readonly inspection = input.required<GamepadInspection>();

  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly keyboard = inject(GamepadKeyboardService);
  private readonly layout = inject(LayoutService);

  protected readonly keyCaps = inject(GamepadBindingsService).keyCaps;
  protected readonly compact = this.layout.isCompact;

  /** Whether focus is inside the frame, which is when keys reach the pad. */
  protected readonly focused = signal(false);
  private readonly keySeen = signal(false);
  private readonly finePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(any-pointer: fine)').matches;

  protected readonly keyboardPresent = computed(
    () => this.finePointer || this.keySeen()
  );
  protected readonly showFooter = computed(
    () => !this.compact() || this.keyboardPresent()
  );

  /** As wide as the area allows without the pad outgrowing its height. */
  protected readonly padWidth = `min(100cqw, calc(100cqh * ${PAD_VIEWBOX.width} / ${PAD_VIEWBOX.height}))`;

  /** The window or sheet panel; keys route by focus inside it. */
  private frame: HTMLElement = this.host;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const listeners = new AbortController();
    let unregister: (() => void) | null = null;

    // Any key at all says a keyboard is attached; a key the pad plays is
    // consumed before this sees it, and is counted in `keyDown` instead.
    window.addEventListener('keydown', () => this.keySeen.set(true), {
      capture: true,
      once: true,
      signal: listeners.signal
    });

    afterNextRender(() => {
      this.frame =
        this.host.parentElement?.closest<HTMLElement>(FRAME_SELECTOR) ??
        this.host;
      const frame = this.frame;
      frame.addEventListener('focusin', () => this.focused.set(true), {
        signal: listeners.signal
      });
      frame.addEventListener(
        'focusout',
        (e) => {
          const next = e.relatedTarget;
          this.focused.set(next instanceof Node && frame.contains(next));
        },
        { signal: listeners.signal }
      );

      const inspection = this.inspection();
      unregister = this.keyboard.register({
        host: frame,
        keyDown: (control, code) => {
          this.keySeen.set(true);
          inspection.keyDown(control, code);
        },
        keyUp: (control, code) => inspection.keyUp(control, code),
        releaseKeys: () => inspection.releaseKeys()
      });

      this.host.focus({ preventScroll: true });
      this.focused.set(frame.contains(document.activeElement));
    });

    destroyRef.onDestroy(() => {
      listeners.abort();
      unregister?.();
      // The view can go while the inspection stays (a breakpoint flip moves
      // it to another frame); no pointer can let go of this view any more.
      this.inspection().releasePointers();
    });
  }

  /**
   * A press anywhere in the view hands it the keyboard, even where the
   * browser gives a clicked button no focus.
   */
  protected claimFocus(): void {
    if (!this.frame.contains(document.activeElement)) {
      this.host.focus({ preventScroll: true });
    }
  }

  protected onControlDown({ control, pointerId }: GamepadPadPointer): void {
    this.inspection().pointerDown(control, pointerId);
  }

  protected onControlUp({ control, pointerId }: GamepadPadPointer): void {
    this.inspection().pointerUp(control, pointerId);
  }
}
