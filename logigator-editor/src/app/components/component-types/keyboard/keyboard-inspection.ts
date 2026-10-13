import { computed, signal, Signal } from '@angular/core';
import { TranslationService } from '../../../translation/translation.service';
import { SimulationService } from '../../../simulation/simulation.service';
import { getStaticDI } from '../../../utils/get-di';
import { ComponentInspection, InputRoute } from '../../component-inspection';
import { pressFrame, releaseFrame, resetFrame, tapFrames } from './ascii';
import type { KeyboardComponent } from './keyboard.component';
import { KeyboardInspectionComponent } from './keyboard-inspection.component';

/** How many characters the window's history keeps. */
export const KEYBOARD_HISTORY_LENGTH = 64;

/** One character the window sent. */
export interface KeyboardHistoryEntry {
  /** Unique within the inspection, in sending order. */
  readonly id: number;
  readonly code: number;
}

/** The physical key whose code is on `D`. */
interface HeldKey {
  /** Its `KeyboardEvent.code`, which its keyup carries whatever the modifiers. */
  readonly key: string;
  /** The history entry it sent. */
  readonly entry: number;
}

/**
 * A keyboard typed into from its window. Every character goes out through
 * the {@link InputRoute} as frames: a key going down is a press frame, its
 * code on `D` and a strobe, and the key on `D` going up is a release frame.
 * Text that arrives without a key (a paste, a soft keyboard's word, the Type
 * text dialog) goes out as taps, a press and a release per character.
 *
 * At most one physical key is on `D`: a press takes it over from the key
 * held before, and so does a tap, so the earlier key's release sends
 * nothing. Only the key on `D` going up releases it.
 *
 * What the window shows of the circuit — the code on `D`, how many
 * characters are still queued — is re-read on every frame. The history of
 * characters sent is the inspection's own, and a stop clears it.
 */
export class KeyboardInspection extends ComponentInspection {
  public readonly kind = 'keyboard';
  public readonly renderer = KeyboardInspectionComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 420, height: 230 },
    min: { width: 300, height: 180 }
  };

  private readonly simulation = getStaticDI(SimulationService);

  private readonly _history = signal<readonly KeyboardHistoryEntry[]>([]);
  /** The last {@link KEYBOARD_HISTORY_LENGTH} characters sent, oldest first. */
  public readonly history = this._history.asReadonly();

  private readonly _held = signal<HeldKey | null>(null);
  /** The history entry of the key held on `D`, or `null`. */
  public readonly heldEntry = computed(() => this._held()?.entry ?? null);

  private readonly _code = signal(0);
  /** The code on `D` as the circuit sees it, ahead of any bubble. */
  public readonly code = this._code.asReadonly();

  private readonly _pending = signal(0);
  /** How many characters are queued and not yet on `D`. */
  public readonly pending = this._pending.asReadonly();

  private nextEntry = 0;
  private seenResets: number;

  constructor(
    public readonly component: KeyboardComponent,
    private readonly route: InputRoute
  ) {
    super();
    const translation = getStaticDI(TranslationService);
    this.title = computed(() =>
      translation.translate('components.def.KEYBOARD.name')
    );
    this.seenResets = this.simulation.resets();
    this.refresh();
  }

  /**
   * The physical key `key` went down, sending `code`: `D` takes it, and the
   * key is the one whose release sets `D` to zero.
   */
  public press(key: string, code: number): void {
    const frame = pressFrame(code);
    this.route.send([frame]);
    const [entry] = this.record([code]);
    this._held.set({ key, entry });
  }

  /** The physical key `key` went up; only the key on `D` sends a release. */
  public release(key: string): void {
    if (this._held()?.key !== key) return;
    this.releaseHeld();
  }

  /** Releases the key on `D`, if a physical key is: the focus went away. */
  public releaseHeld(): void {
    if (!this._held()) return;
    this._held.set(null);
    this.route.send([releaseFrame()]);
  }

  /**
   * Sends `codes` as taps, in order. A tap takes `D` over, so the key held
   * before counts as released and its keyup sends nothing.
   */
  public type(codes: readonly number[]): void {
    if (codes.length === 0) return;
    const frames = tapFrames(codes);
    this._held.set(null);
    this.route.send(frames);
    this.record(codes);
  }

  /** Drops every character still queued and sets `D` to zero at once. */
  public cancel(): void {
    this._held.set(null);
    this.route.cancel(resetFrame());
    this._pending.set(0);
  }

  public override onFrame(): void {
    const resets = this.simulation.resets();
    if (resets !== this.seenResets) {
      // The rebuilt engine has nothing on D and nothing queued.
      this.seenResets = resets;
      this._held.set(null);
      this._history.set([]);
    }
    this.refresh();
  }

  /** Nothing stays on `D` once the window closes. */
  public override destroy(): void {
    this.releaseHeld();
  }

  /** Appends `codes` to the history, returning their entry ids. */
  private record(codes: readonly number[]): number[] {
    const added = codes.map((code) => ({ id: this.nextEntry++, code }));
    this._history.update((history) =>
      [...history, ...added].slice(-KEYBOARD_HISTORY_LENGTH)
    );
    return added.map((entry) => entry.id);
  }

  private refresh(): void {
    this._code.set(this.component.readCode());
    this._pending.set(this.route.pending());
  }
}
