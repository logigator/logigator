import { computed, signal, Signal } from '@angular/core';
import { GamepadControlId, NameMap } from '@logigator/core';
import { TranslationService } from '../../../translation/translation.service';
import { getStaticDI } from '../../../utils/get-di';
import type { DocsTarget } from '../../../documentation/docs-target';
import { DOCS_LINKS } from '../../../documentation/docs-links';
import {
  GamepadHardwareService,
  GamepadPadTarget
} from '../../../inspection/gamepad/gamepad-hardware.service';
import { ComponentInspection, InputRoute } from '../../component-inspection';
import type { GamepadComponent } from './gamepad.component';
import { GamepadInspectionComponent } from './gamepad-inspection.component';

/** The holder prefix of a keyboard key, followed by its `code`. */
const KEY_HOLDER = 'key:';
/** The holder prefix of a pointer, followed by its `pointerId`. */
const POINTER_HOLDER = 'ptr:';
/** The holder prefix of a controller input, followed by `<index>:<input>`. */
const PAD_HOLDER = 'pad:';

/**
 * A gamepad played in its window. Every source that can hold a control — a
 * key, a pointer, a physical controller's input — is a **holder** of it,
 * named `key:<code>`, `ptr:<pointerId>` or `pad:<index>:<input>`. A control
 * is pressed while it has a holder, and only the moments it gains its first
 * holder or loses its last one reach the {@link InputRoute}, as a press or
 * release of the control's slot. Holding a key and clicking the same control,
 * then letting go of either, keeps the control held. A control the pad does
 * not have takes no holder.
 *
 * What one input event changes — a key, a pointer's move, every holder a
 * focus loss lets go of — or one controller poll ({@link batch}) reaches the
 * route as **one** operation, so the controls it presses together reach the
 * circuit on the same tick.
 *
 * What the window draws as pressed is the component's own slot state, not
 * the holders: {@link pressed} re-reads it on every frame and after every
 * route call, so a press that arrived any other way shows too, and a press
 * the simulation dropped does not.
 *
 * The inspection is a {@link GamepadHardwareService} target from opening to
 * closing, whether a view of it is on screen or not: a controller keeps
 * playing a pad behind another sheet tab, and its assignment outlives a view
 * rebuilt in another frame.
 */
export class GamepadInspection
  extends ComponentInspection
  implements GamepadPadTarget
{
  public readonly kind = 'gamepad';
  public readonly renderer = GamepadInspectionComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 460, height: 300 },
    min: { width: 320, height: 220 }
  };

  /** Each control's holders; a control with none has no entry. */
  private readonly holders = new Map<GamepadControlId, Set<string>>();
  /**
   * The slots the running {@link batch} pressed (`true`) or released, by
   * slot, the last change winning; `null` outside one.
   */
  private changes: Map<number, boolean> | null = null;

  private readonly _pressed = signal<ReadonlySet<GamepadControlId>>(new Set());
  /** The controls whose slot is active, as the board shows them. */
  public readonly pressed = this._pressed.asReadonly();

  private readonly _assigning = signal(false);
  /**
   * Whether the window is assigning keys rather than playing. It holds for
   * the inspection's lifetime, so a view rebuilt in another frame resumes it.
   */
  public readonly assigning = this._assigning.asReadonly();

  /** Assigning keys is described with the other keys, playing with the pad. */
  public override readonly docs = computed<DocsTarget>(() =>
    this.assigning() ? DOCS_LINKS.gamepadKeys : DOCS_LINKS.gamepadWindow
  );

  /** The controls at open time; options cannot change during simulation. */
  public readonly controls: readonly GamepadControlId[];
  public readonly names: NameMap;

  private readonly unregisterPad: () => void;

  constructor(
    public readonly component: GamepadComponent,
    private readonly route: InputRoute
  ) {
    super();
    this.controls = component.slotIds;
    this.names = component.options.names.value;
    const translation = getStaticDI(TranslationService);
    this.title = computed(() =>
      translation.translate('components.def.GAMEPAD.name')
    );
    this.refresh();
    this.unregisterPad = getStaticDI(GamepadHardwareService).register(this);
  }

  /** A bound key went down while the window had focus. */
  public keyDown(control: GamepadControlId, code: string): void {
    this.batch(() => this.hold(control, KEY_HOLDER + code));
  }

  public keyUp(control: GamepadControlId, code: string): void {
    this.batch(() => this.letGo(control, KEY_HOLDER + code));
  }

  /** Every key lets go at once: the window lost focus, or the page did. */
  public releaseKeys(): void {
    this.letGoWhere((holder) => holder.startsWith(KEY_HOLDER));
  }

  public pointerDown(control: GamepadControlId, pointerId: number): void {
    this.batch(() => this.hold(control, POINTER_HOLDER + pointerId));
  }

  public pointerUp(control: GamepadControlId, pointerId: number): void {
    this.batch(() => this.letGo(control, POINTER_HOLDER + pointerId));
  }

  /**
   * A pointer moved its hold in one event, letting go of `released` and
   * taking `pressed` — a thumb rolling over the D-pad.
   */
  public pointerMove(
    pointerId: number,
    pressed: readonly GamepadControlId[],
    released: readonly GamepadControlId[]
  ): void {
    const holder = POINTER_HOLDER + pointerId;
    this.batch(() => {
      for (const control of released) this.letGo(control, holder);
      for (const control of pressed) this.hold(control, holder);
    });
  }

  /** Every pointer lets go at once: the view holding them went away. */
  public releasePointers(): void {
    this.letGoWhere((holder) => holder.startsWith(POINTER_HOLDER));
  }

  /** A controller input (`<index>:<input>`) started holding `control`. */
  public padDown(control: GamepadControlId, input: string): void {
    this.batch(() => this.hold(control, PAD_HOLDER + input));
  }

  public padUp(control: GamepadControlId, input: string): void {
    this.batch(() => this.letGo(control, PAD_HOLDER + input));
  }

  /** Every controller input lets go at once: the controller went away. */
  public releasePad(): void {
    this.letGoWhere((holder) => holder.startsWith(PAD_HOLDER));
  }

  /**
   * Runs `run`, whose holds and releases reach the route together, as one
   * operation of every control whose pressed state they changed: one
   * controller poll is one batch. A batch inside a batch joins it.
   */
  public batch(run: () => void): void {
    if (this.changes) {
      run();
      return;
    }
    const changes = new Map<number, boolean>();
    this.changes = changes;
    try {
      run();
    } finally {
      this.changes = null;
    }
    if (changes.size === 0) return;
    this.route.operate(
      [...changes].map(([slot, pressed]) => ({
        slot,
        phase: pressed ? 'press' : 'release'
      }))
    );
    this.refresh();
  }

  /**
   * Switches between playing and assigning keys. Assigning lets go of every
   * holder through the route and takes no new one, so the window plays
   * nothing until it is back to playing.
   */
  public setAssigning(assigning: boolean): void {
    if (this._assigning() === assigning) return;
    this._assigning.set(assigning);
    if (assigning) this.letGoWhere(() => true);
  }

  public override onFrame(): void {
    this.refresh();
  }

  /** Nothing stays held, and no controller stays assigned, once it closes. */
  public override destroy(): void {
    this.unregisterPad();
    this.letGoWhere(() => true);
  }

  private hold(control: GamepadControlId, holder: string): void {
    if (this._assigning() || this.slotOf(control) < 0) return;
    let held = this.holders.get(control);
    if (!held) {
      held = new Set();
      this.holders.set(control, held);
    }
    const first = held.size === 0;
    held.add(holder);
    if (first) this.change(control, true);
  }

  private letGo(control: GamepadControlId, holder: string): void {
    const held = this.holders.get(control);
    if (!held?.delete(holder) || held.size > 0) return;
    this.holders.delete(control);
    this.change(control, false);
  }

  /** Lets go of every matching holder, in one batch. */
  private letGoWhere(matches: (holder: string) => boolean): void {
    this.batch(() => {
      for (const [control, held] of [...this.holders]) {
        for (const holder of [...held]) {
          if (matches(holder)) this.letGo(control, holder);
        }
      }
    });
  }

  /** Records a control's press or release in the running batch. */
  private change(control: GamepadControlId, pressed: boolean): void {
    const slot = this.slotOf(control);
    if (slot >= 0) this.changes?.set(slot, pressed);
  }

  /** The control's slot, read now rather than kept. */
  private slotOf(control: GamepadControlId): number {
    return this.component.slotIds.indexOf(control);
  }

  private refresh(): void {
    const active = new Set<GamepadControlId>();
    this.component.slotIds.forEach((control, slot) => {
      if (this.component.isActive(slot)) active.add(control);
    });
    const current = this._pressed();
    if (
      active.size !== current.size ||
      [...active].some((control) => !current.has(control))
    ) {
      this._pressed.set(active);
    }
  }
}
