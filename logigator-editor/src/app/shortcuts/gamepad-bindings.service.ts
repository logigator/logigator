import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  Signal,
  signal
} from '@angular/core';
import { GAMEPAD_CONTROLS, GamepadControlId } from '@logigator/core';
import {
  fixedKeyLabel,
  keyIcon as iconForCode,
  layoutKeyLabel
} from './gamepad-key-labels';

/** Every gamepad control's key, as a `KeyboardEvent.code`; `null` is unbound. */
export type GamepadBindings = Readonly<Record<GamepadControlId, string | null>>;

/** One bound key as a keycap draws it. */
export interface GamepadKeyCap {
  readonly code: string;
  /** Text label, in the user's layout where the browser reports it. */
  readonly label: string;
  /** Phosphor icon class drawn instead of `label`, or `null`. */
  readonly icon: string | null;
}

export const GAMEPAD_KEYS_STORAGE_KEY = 'logigator.gamepad.keys';

const STORAGE_VERSION = 1;

/** The SNES-emulator convention: D-pad on the arrows, face buttons on ZXAS. */
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  a: 'KeyX',
  b: 'KeyZ',
  x: 'KeyS',
  y: 'KeyA',
  l: 'KeyQ',
  r: 'KeyW',
  select: 'ShiftRight',
  start: 'Enter'
};

/**
 * Keys a control never takes: Escape closes the window or leaves the
 * simulation, and Tab moves focus out of the pad.
 */
const UNBINDABLE_CODES: ReadonlySet<string> = new Set(['Escape', 'Tab']);

interface KeyboardLayoutMapLike {
  entries(): IterableIterator<[string, string]>;
}

interface NavigatorWithKeyboard {
  keyboard?: { getLayoutMap?(): Promise<KeyboardLayoutMapLike> };
}

/**
 * The keyboard keys that play a gamepad's controls, shared by every gamepad
 * and persisted in localStorage. Bindings are by `KeyboardEvent.code`, the
 * key's position, so a Shift or Caps Lock that changes `key` between keydown
 * and keyup still releases the control it pressed. No two controls share a
 * code.
 */
@Injectable({
  providedIn: 'root'
})
export class GamepadBindingsService {
  private readonly _bindings = signal<GamepadBindings>(readStoredBindings());

  /** Every control's bound code, `null` for an unbound control. */
  public readonly bindings: Signal<GamepadBindings> =
    this._bindings.asReadonly();

  private readonly _controlByCode = computed(() => {
    const byCode = new Map<string, GamepadControlId>();
    const bindings = this._bindings();
    for (const control of GAMEPAD_CONTROLS) {
      const code = bindings[control];
      if (code !== null) byCode.set(code, control);
    }
    return byCode;
  });

  /** The browser's code → character map for the user's layout, once loaded. */
  private readonly _layout = signal<ReadonlyMap<string, string> | null>(null);

  /** Every control's keycap, `null` for an unbound control. */
  public readonly keyCaps: Signal<
    Readonly<Record<GamepadControlId, GamepadKeyCap | null>>
  > = computed(() => {
    const bindings = this._bindings();
    const caps = {} as Record<GamepadControlId, GamepadKeyCap | null>;
    for (const control of GAMEPAD_CONTROLS) {
      const code = bindings[control];
      caps[control] =
        code === null
          ? null
          : { code, label: this.keyLabel(code), icon: iconForCode(code) };
    }
    return caps;
  });

  constructor() {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== GAMEPAD_KEYS_STORAGE_KEY) return;
      this._bindings.set(readStoredBindings());
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('storage', onStorage)
    );
    this.loadLayoutMap();
  }

  /** The control `code` plays, or `null` when it is unbound. */
  public controlFor(code: string): GamepadControlId | null {
    return this._controlByCode().get(code) ?? null;
  }

  /** Whether `code` can be bound to a control at all. */
  public isBindable(code: string): boolean {
    return code !== '' && !UNBINDABLE_CODES.has(code);
  }

  /**
   * Binds `code` to `control`. A control already holding `code` takes
   * `control`'s previous key in exchange, and is returned so the change can
   * be pointed out; otherwise the result is `null`. An unbindable code
   * changes nothing.
   */
  public assign(
    control: GamepadControlId,
    code: string
  ): GamepadControlId | null {
    if (!this.isBindable(code)) return null;
    const current = this._bindings();
    if (current[control] === code) return null;
    const other = this.controlFor(code);
    const next = { ...current, [control]: code };
    if (other !== null) next[other] = current[control];
    this.write(next);
    return other;
  }

  /** Unbinds `control`. */
  public clear(control: GamepadControlId): void {
    if (this._bindings()[control] === null) return;
    this.write({ ...this._bindings(), [control]: null });
  }

  /** Restores every control's default key. */
  public reset(): void {
    this.write({ ...DEFAULT_GAMEPAD_BINDINGS });
  }

  /**
   * The keycap label for `code`. Keys the layout map covers read in the
   * user's layout once it has loaded; the rest come from a fixed table.
   * Reactive: a template or `computed` reading it updates when the map loads.
   */
  public keyLabel(code: string): string {
    const character = this._layout()?.get(code);
    return character ? layoutKeyLabel(character) : fixedKeyLabel(code);
  }

  /** The Phosphor icon class a keycap draws for `code`, or `null` for text. */
  public keyIcon(code: string): string | null {
    return iconForCode(code);
  }

  private write(bindings: GamepadBindings): void {
    this._bindings.set(bindings);
    try {
      localStorage.setItem(
        GAMEPAD_KEYS_STORAGE_KEY,
        JSON.stringify({ v: STORAGE_VERSION, keys: bindings })
      );
    } catch {
      /* storage unavailable or full — the bindings hold for this session */
    }
  }

  /**
   * Chromium reports the user's layout through the Keyboard API, so `KeyZ`
   * reads `Y` on a German keyboard. Elsewhere, and where the call is refused
   * (an embedding frame without permission), labels stay on the fixed table.
   */
  private loadLayoutMap(): void {
    const keyboard = (navigator as NavigatorWithKeyboard).keyboard;
    if (typeof keyboard?.getLayoutMap !== 'function') return;
    try {
      keyboard.getLayoutMap().then(
        (map) => this._layout.set(new Map(map.entries())),
        () => undefined
      );
    } catch {
      /* the API exists but throws synchronously — keep the fixed table */
    }
  }
}

/**
 * The stored bindings, resolved per control: a missing, malformed or
 * unbindable entry falls back to that control's default, and so does every
 * control when the record is unreadable or of an unknown version. A code
 * already claimed by an earlier control in port order leaves the later one
 * unbound.
 */
function readStoredBindings(): GamepadBindings {
  let stored: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(GAMEPAD_KEYS_STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (
      isRecord(parsed) &&
      parsed['v'] === STORAGE_VERSION &&
      isRecord(parsed['keys'])
    ) {
      stored = parsed['keys'];
    }
  } catch {
    /* unreadable storage — every control takes its default */
  }

  const bindings = {} as Record<GamepadControlId, string | null>;
  const taken = new Set<string>();
  for (const control of GAMEPAD_CONTROLS) {
    const entry = stored[control];
    let code: string | null;
    if (entry === null) code = null;
    else if (
      typeof entry === 'string' &&
      entry !== '' &&
      !UNBINDABLE_CODES.has(entry)
    )
      code = entry;
    else code = DEFAULT_GAMEPAD_BINDINGS[control];

    if (code !== null && taken.has(code)) code = null;
    if (code !== null) taken.add(code);
    bindings[control] = code;
  }
  return bindings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
