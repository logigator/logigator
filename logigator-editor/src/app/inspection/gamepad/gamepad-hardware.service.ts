import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
  Signal,
  untracked
} from '@angular/core';
import { GamepadControlId } from '@logigator/core';
import { SimulationService } from '../../simulation/simulation.service';
import { FRAME_SCHEDULER } from '../../simulation/worker/simulation-worker.service';
import {
  controllerLabel,
  GamepadInputs,
  standardHolds
} from './gamepad-hardware-mapping';

/**
 * A gamepad played by a physical controller. `input` names what holds the
 * control, `<controller index>:<input>`, so the stick and the D-pad holding
 * one control are two holders.
 */
export interface GamepadPadTarget {
  /** `input` started holding `control`. */
  padDown(control: GamepadControlId, input: string): void;
  /** `input` stopped holding `control`. */
  padUp(control: GamepadControlId, input: string): void;
  /** Every control a controller holds lets go at once, without a `padUp`. */
  releasePad(): void;
}

/** A connected controller as the window lists it. */
export interface GamepadController {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  /** Whether the browser maps it to the W3C `standard` layout. */
  readonly supported: boolean;
}

/** The part of a browser `Gamepad` this service reads. */
export type GamepadReading = GamepadInputs &
  Pick<Gamepad, 'index' | 'id' | 'mapping' | 'connected'>;

type GetGamepads = () => readonly (GamepadReading | null)[];

const NO_HOLDS: ReadonlyMap<string, GamepadControlId> = new Map();

/**
 * Plays gamepads from physical controllers through the browser Gamepad API.
 * Unlike the keyboard, a controller does not follow focus: it is **assigned**
 * to one target, and plays it whichever window has focus, so two controllers
 * play two pads at once.
 *
 * A controller belongs to at most one target, and assigning it elsewhere
 * moves it. A target registering, or one left without a controller when one
 * connects, takes a free supported controller unless its last choice was
 * none; a target that comes back keeps its last controller while that is
 * still free. Assignments last for the session: controller indices are not
 * stable across reconnects.
 *
 * The API has no input events. While a controller is assigned, the
 * simulation is ready and the page is visible, one frame callback reads every
 * controller and hands each target only what changed since the last frame.
 * Whenever polling stops, every controller hold is released.
 */
@Injectable({
  providedIn: 'root'
})
export class GamepadHardwareService {
  private readonly document = inject(DOCUMENT);
  private readonly simulation = inject(SimulationService);
  private readonly scheduler = inject(FRAME_SCHEDULER);

  private readonly getGamepads: GetGamepads | null;
  /**
   * Whether the browser offers the Gamepad API here at all; it is withheld
   * outside a secure context. Without it the service does nothing.
   */
  public readonly available: boolean;

  private readonly _controllers = signal<readonly GamepadController[]>([]);
  /** Every connected controller, by index; empty until one reports in. */
  public readonly controllers = this._controllers.asReadonly();

  /** Registrations per target, so a target registered twice stays until both go. */
  private readonly _registrations = new Map<GamepadPadTarget, number>();
  private readonly _assignments = signal<ReadonlyMap<GamepadPadTarget, number>>(
    new Map()
  );
  private readonly _assignmentSignals = new WeakMap<
    GamepadPadTarget,
    Signal<number | null>
  >();
  /** Each target's last choice, outliving its registration. */
  private readonly _choices = new WeakMap<GamepadPadTarget, number | null>();
  /** What each target's controller held on the last frame. */
  private readonly _held = new Map<
    GamepadPadTarget,
    ReadonlyMap<string, GamepadControlId>
  >();

  private readonly _visible = signal(true);
  private readonly _polls = computed(
    () =>
      this._assignments().size > 0 &&
      this.simulation.isReady() &&
      this._visible()
  );
  private _frame: number | null = null;
  private _listeners: AbortController | null = null;

  constructor() {
    const navigator = this.document.defaultView?.navigator;
    const getGamepads = navigator?.getGamepads as unknown;
    this.getGamepads =
      typeof getGamepads === 'function'
        ? () => (getGamepads as GetGamepads).call(navigator)
        : null;
    this.available = this.getGamepads !== null;

    effect(() => {
      const polls = this._polls();
      untracked(() => this.setPolling(polls));
    });
    inject(DestroyRef).onDestroy(() => {
      this._listeners?.abort();
      this.cancelFrame();
    });
  }

  /**
   * Lets `target` be assigned a controller, taking a free one at once. The
   * returned function unregisters it, releasing what its controller holds
   * and freeing the controller.
   */
  public register(target: GamepadPadTarget): () => void {
    this.attachListeners();
    const count = this._registrations.get(target) ?? 0;
    this._registrations.set(target, count + 1);
    if (count === 0) this.autoAssign(target);

    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      const left = (this._registrations.get(target) ?? 1) - 1;
      if (left > 0) {
        this._registrations.set(target, left);
        return;
      }
      this._registrations.delete(target);
      this.setAssignment(target, null);
    };
  }

  /** The index of the controller assigned to `target`, or `null`. */
  public assignmentOf(target: GamepadPadTarget): Signal<number | null> {
    let assignment = this._assignmentSignals.get(target);
    if (!assignment) {
      assignment = computed(() => this._assignments().get(target) ?? null);
      this._assignmentSignals.set(target, assignment);
    }
    return assignment;
  }

  /**
   * Assigns controller `index` to `target`, taking it from whichever target
   * had it. Refused (`false`) for an unregistered target and for a
   * controller that is not connected or not supported.
   */
  public assign(index: number, target: GamepadPadTarget): boolean {
    if (!this._registrations.has(target)) return false;
    const controller = this._controllers().find((c) => c.index === index);
    if (!controller?.supported) return false;
    this._choices.set(target, index);
    this.setAssignment(target, index);
    return true;
  }

  /** Leaves `target` without a controller, by choice. */
  public unassign(target: GamepadPadTarget): void {
    if (!this._registrations.has(target)) return;
    this._choices.set(target, null);
    this.setAssignment(target, null);
  }

  /**
   * Points `target` at `index` (or nothing), releasing what it held and
   * taking `index` from its previous holder, who releases too.
   */
  private setAssignment(target: GamepadPadTarget, index: number | null): void {
    const current = this._assignments();
    if ((current.get(target) ?? null) === index) return;
    const next = new Map(current);
    this.release(target);
    next.delete(target);
    if (index !== null) {
      for (const [other, held] of current) {
        if (held !== index || other === target) continue;
        this.release(other);
        next.delete(other);
      }
      next.set(target, index);
    }
    this._assignments.set(next);
    this.setPolling(this._polls());
  }

  /**
   * Gives `target` a controller: the one it chose last if that is free,
   * otherwise the first free supported one, and none if it chose none.
   */
  private autoAssign(target: GamepadPadTarget): void {
    const choice = this._choices.get(target);
    if (choice === null) return;
    const taken = new Set(this._assignments().values());
    const free = this._controllers().filter(
      (c) => c.supported && !taken.has(c.index)
    );
    const pick = free.find((c) => c.index === choice) ?? free[0];
    if (pick) this.setAssignment(target, pick.index);
  }

  private attachListeners(): void {
    if (this._listeners || !this.getGamepads) return;
    this._listeners = new AbortController();
    const view = this.document.defaultView;
    const signal = this._listeners.signal;
    view?.addEventListener('gamepadconnected', () => this.onConnected(), {
      signal
    });
    view?.addEventListener(
      'gamepaddisconnected',
      (e) => this.onDisconnected(e),
      { signal }
    );
    this.document.addEventListener(
      'visibilitychange',
      () => {
        this._visible.set(this.document.visibilityState !== 'hidden');
        this.setPolling(this._polls());
      },
      { signal }
    );
    this._visible.set(this.document.visibilityState !== 'hidden');
    this.readControllers();
  }

  private onConnected(): void {
    this.readControllers();
    for (const target of this._registrations.keys()) {
      if (!this._assignments().has(target)) this.autoAssign(target);
    }
  }

  private onDisconnected(e: Event): void {
    const gone = (e as Partial<GamepadEvent>).gamepad?.index;
    this.readControllers(gone);
    const present = new Set(this._controllers().map((c) => c.index));
    for (const [target, index] of this._assignments()) {
      if (!present.has(index)) this.setAssignment(target, null);
    }
  }

  /** Re-reads the connected controllers, leaving out `gone` if given. */
  private readControllers(gone?: number): void {
    const controllers: GamepadController[] = [];
    for (const pad of this.read()) {
      if (!pad?.connected || pad.index === gone) continue;
      controllers.push({
        index: pad.index,
        id: pad.id,
        label: controllerLabel(pad.index, pad.id),
        supported: pad.mapping === 'standard'
      });
    }
    controllers.sort((a, b) => a.index - b.index);
    this._controllers.set(controllers);
  }

  private read(): readonly (GamepadReading | null)[] {
    return this.getGamepads?.() ?? [];
  }

  private setPolling(polls: boolean): void {
    if (polls) {
      this._frame ??= this.scheduler.request(() => this.poll());
      return;
    }
    this.cancelFrame();
    for (const target of [...this._held.keys()]) this.release(target);
  }

  private cancelFrame(): void {
    if (this._frame === null) return;
    this.scheduler.cancel(this._frame);
    this._frame = null;
  }

  /** One frame: every assigned controller's changes reach its target. */
  private poll(): void {
    this._frame = null;
    const pads = this.read();
    for (const [target, index] of this._assignments()) {
      const pad = pads.find((p) => p?.index === index);
      const next = pad?.connected ? standardHolds(pad) : NO_HOLDS;
      const previous = this._held.get(target) ?? NO_HOLDS;
      if (next.size > 0) this._held.set(target, next);
      else this._held.delete(target);
      for (const [input, control] of previous) {
        if (next.get(input) !== control) {
          target.padUp(control, `${index}:${input}`);
        }
      }
      for (const [input, control] of next) {
        if (previous.get(input) !== control) {
          target.padDown(control, `${index}:${input}`);
        }
      }
    }
    if (this._polls()) {
      this._frame = this.scheduler.request(() => this.poll());
    }
  }

  /** Forgets what `target`'s controller held and tells it, if anything. */
  private release(target: GamepadPadTarget): void {
    const held = this._held.get(target);
    this._held.delete(target);
    if (held && held.size > 0) target.releasePad();
  }
}
