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
import { GamepadControlId } from '@logigator/core';
import { LgButton } from '@logigator/ui';
import { GamepadKeyboardService } from '../../../inspection/gamepad/gamepad-keyboard.service';
import { LayoutService } from '../../../layout/layout.service';
import { GamepadBindingsService } from '../../../shortcuts/gamepad-bindings.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';
import type { GamepadInspection } from './gamepad-inspection';
import {
  GamepadPadComponent,
  GamepadPadPointer
} from './pad/gamepad-pad.component';
import { PAD_VIEWBOX } from './pad/gamepad-pad-layout';

/** The element framing the view: the window, or the sheet's panel. */
const FRAME_SELECTOR = '[role="dialog"]';

/** How long a control whose key moved in a swap stays highlighted. */
const FLASH_MS = 600;

/**
 * The gamepad's window: the pad in `play` mode over a status footer. Keys
 * reach the pad while focus is anywhere inside the frame hosting it, so the
 * view registers that frame with {@link GamepadKeyboardService} and takes the
 * focus itself when it opens, so keys work at once.
 *
 * On compact the pad fills the sheet with enlarged hit regions, and the
 * footer and keycap chips show only once a keyboard is known to be at hand:
 * a fine pointer exists, or a key has been pressed since the view opened.
 *
 * The footer's Assign keys switches the inspection to assigning: the pad
 * draws in `assign`, and the view leaves {@link GamepadKeyboardService} for
 * as long as it lasts, so every key reaches the view itself. Picking a
 * control starts a capture, and the next keydown on the view settles it:
 * Escape cancels, Backspace or Delete unbinds, Tab moves focus as ever, and
 * any other key is assigned. A captured key is consumed where it lands, so it
 * neither closes the window nor fires a shortcut. Focus leaving the captured
 * control ends the capture.
 */
@Component({
  selector: 'app-gamepad-inspection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GamepadPadComponent, LgButton, TranslateDirective],
  host: {
    class: 'flex h-full flex-col gap-2 outline-none',
    tabindex: '-1',
    '(pointerdown)': 'claimFocus()',
    '(keydown)': 'onKeyDown($event)',
    '(focusout)': 'onFocusOut($event)'
  },
  template: `
    <div
      class="flex min-h-0 grow items-center justify-center [container-type:size]"
    >
      <app-gamepad-pad
        [style.width]="padWidth"
        [controls]="inspection().controls"
        [names]="inspection().names"
        [mode]="assigning() ? 'assign' : 'play'"
        [pressed]="inspection().pressed()"
        [keyCaps]="keyCaps()"
        [keyboardActive]="focused()"
        [keyboardPresent]="keyboardPresent()"
        [enlarged]="compact()"
        [capturing]="capturing()"
        [flashed]="flashed()"
        (controlDown)="onControlDown($event)"
        (controlUp)="onControlUp($event)"
        (controlSelect)="onControlSelect($event)"
      />
    </div>
    <div class="sr-only" aria-live="polite">{{ announcement() }}</div>
    @if (showFooter()) {
      <div
        *appTranslate="let t"
        class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      >
        @if (assigning()) {
          <span class="text-muted">
            {{ t('components.def.GAMEPAD.assign.hint') }}
          </span>
          <span class="grow"></span>
          <button
            lgButton
            size="sm"
            severity="secondary"
            text
            (onClick)="resetKeys()"
          >
            {{ t('components.def.GAMEPAD.assign.reset') }}
          </button>
          <button lgButton size="sm" (onClick)="leaveAssign()">
            {{ t('components.def.GAMEPAD.assign.done') }}
          </button>
        } @else {
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
          <button
            lgButton
            size="sm"
            severity="secondary"
            outlined
            (onClick)="enterAssign()"
          >
            {{ t('components.def.GAMEPAD.window.assignKeys') }}
          </button>
        }
      </div>
    }
  `
})
export class GamepadInspectionComponent {
  public readonly inspection = input.required<GamepadInspection>();

  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly keyboard = inject(GamepadKeyboardService);
  private readonly bindings = inject(GamepadBindingsService);
  private readonly translation = inject(TranslationService);
  private readonly layout = inject(LayoutService);

  protected readonly keyCaps = this.bindings.keyCaps;
  protected readonly compact = this.layout.isCompact;

  protected readonly assigning = computed(() => this.inspection().assigning());
  /** The control the next key is assigned to, or `null`. */
  public readonly capturing = signal<GamepadControlId | null>(null);
  /** The control a swap just gave another key, while it is highlighted. */
  public readonly flashed = signal<GamepadControlId | null>(null);
  /** What the polite live region says about the last assign-mode step. */
  protected readonly announcement = signal('');

  /** Whether focus is inside the frame, which is when keys reach the pad. */
  protected readonly focused = signal(false);
  private readonly keySeen = signal(false);
  private readonly finePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(any-pointer: fine)').matches;

  protected readonly keyboardPresent = computed(
    () => this.finePointer || this.keySeen()
  );
  /** Assign mode keeps its footer, Done included, wherever it is resumed. */
  protected readonly showFooter = computed(
    () => !this.compact() || this.keyboardPresent() || this.assigning()
  );

  /** As wide as the area allows without the pad outgrowing its height. */
  protected readonly padWidth = `min(100cqw, calc(100cqh * ${PAD_VIEWBOX.width} / ${PAD_VIEWBOX.height}))`;

  /** The window or sheet panel; keys route by focus inside it. */
  private frame: HTMLElement = this.host;
  /** Stops key routing to this view; `null` while it is not routed to. */
  private unregisterKeys: (() => void) | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const listeners = new AbortController();

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

      if (!this.inspection().assigning()) this.routeKeys();

      this.host.focus({ preventScroll: true });
      this.focused.set(frame.contains(document.activeElement));
    });

    destroyRef.onDestroy(() => {
      listeners.abort();
      clearTimeout(this.flashTimer);
      this.stopRoutingKeys();
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

  /**
   * Switches to assigning keys. Leaving the keyboard service releases the
   * keys the pad holds, and the inspection lets go of everything else.
   */
  public enterAssign(): void {
    if (this.inspection().assigning()) return;
    this.stopRoutingKeys();
    this.inspection().setAssigning(true);
    this.announcement.set('');
    // The toggle that had the focus is about to go; the keys stay here.
    this.host.focus({ preventScroll: true });
  }

  /** Back to playing, with the keys routed to the pad again. */
  public leaveAssign(): void {
    if (!this.inspection().assigning()) return;
    this.capturing.set(null);
    this.inspection().setAssigning(false);
    this.announcement.set('');
    this.routeKeys();
    this.host.focus({ preventScroll: true });
  }

  protected resetKeys(): void {
    this.capturing.set(null);
    this.bindings.reset();
    this.announcement.set(
      this.translation.translate('components.def.GAMEPAD.assign.resetDone')
    );
  }

  /** Picking the capturing control again cancels its capture. */
  protected onControlSelect(control: GamepadControlId): void {
    if (this.capturing() === control) {
      this.capturing.set(null);
      this.announcement.set('');
      return;
    }
    this.capturing.set(control);
    this.announcement.set(
      this.translation.translate('components.def.GAMEPAD.assign.prompt', {
        control: this.spokenName(control)
      })
    );
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const control = this.capturing();
    if (control === null || e.isComposing) return;
    if (e.key === 'Tab' || e.code === 'Tab') return;

    e.preventDefault();
    e.stopPropagation();
    // A held key repeating, such as the Enter that started the capture.
    if (e.repeat) return;

    if (e.key === 'Escape' || e.code === 'Escape') {
      this.capturing.set(null);
      this.announcement.set('');
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      this.bindings.clear(control);
      this.capturing.set(null);
      this.announcement.set(
        this.translation.translate('components.def.GAMEPAD.assign.cleared', {
          control: this.spokenName(control)
        })
      );
      return;
    }
    if (!this.bindings.isBindable(e.code)) return;

    const swapped = this.bindings.assign(control, e.code);
    this.capturing.set(null);
    const params = {
      control: this.spokenName(control),
      key: this.bindings.keyLabel(e.code)
    };
    if (swapped === null) {
      this.announcement.set(
        this.translation.translate(
          'components.def.GAMEPAD.assign.assigned',
          params
        )
      );
      return;
    }
    this.flash(swapped);
    this.announcement.set(
      this.translation.translate('components.def.GAMEPAD.assign.swapped', {
        ...params,
        other: this.spokenName(swapped)
      })
    );
  }

  /** The capture belongs to its control's focus, and ends with it. */
  protected onFocusOut(e: FocusEvent): void {
    const control = this.capturing();
    if (control === null) return;
    const next = e.relatedTarget;
    if (next instanceof HTMLElement && next.dataset['control'] === control) {
      return;
    }
    this.capturing.set(null);
  }

  private routeKeys(): void {
    if (this.unregisterKeys) return;
    const inspection = this.inspection();
    this.unregisterKeys = this.keyboard.register({
      host: this.frame,
      keyDown: (control, code) => {
        this.keySeen.set(true);
        inspection.keyDown(control, code);
      },
      keyUp: (control, code) => inspection.keyUp(control, code),
      releaseKeys: () => inspection.releaseKeys()
    });
  }

  private stopRoutingKeys(): void {
    const unregister = this.unregisterKeys;
    this.unregisterKeys = null;
    unregister?.();
  }

  private flash(control: GamepadControlId): void {
    clearTimeout(this.flashTimer);
    this.flashed.set(control);
    this.flashTimer = setTimeout(() => this.flashed.set(null), FLASH_MS);
  }

  private spokenName(control: GamepadControlId): string {
    return this.translation.translate(
      `components.def.GAMEPAD.controls.${control}` as const
    );
  }
}
