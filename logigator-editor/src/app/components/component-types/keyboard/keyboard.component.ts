import { computed, signal, Signal } from '@angular/core';
import { BitmapText, Graphics } from 'pixi.js';
import {
  KEYBOARD_DATA_BITS,
  KEYBOARD_GLYPH_COLUMN_WIDTH,
  KEYBOARD_KEY_DOWN_OUTPUT,
  keyboardMeta
} from '@logigator/core';
import { Component } from '../../component';
import { fitsInputQueue, type InputRoute } from '../../component-inspection';
import { SimulationService } from '../../../simulation/simulation.service';
import { getStaticDI } from '../../../utils/get-di';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY, fitMonoFontSize } from '../../../utils/text-fit';
import {
  KEYBOARD_READOUT_BOX,
  KeyboardKeycapGraphics,
  KeyboardReadoutFillGraphics,
  KeyboardReadoutFrameGraphics
} from '../../../rendering/graphics/keyboard.graphics';
import {
  cancelFrames,
  codeFromBits,
  pressFrames,
  readoutText,
  releaseFrame,
  tapFrames
} from './ascii';
import { keyboardComponentConfig, KeyboardOptions } from './keyboard.config';

/** The readout's font size for a single character, in pixels. */
const READOUT_FONT_SIZE = 1.4 / PX;
const READOUT_MIN_FONT_SIZE = 0.5 / PX;
/** Width a readout may span inside its box, in pixels. */
const READOUT_ROOM = (KEYBOARD_READOUT_BOX.size - 0.4) / PX;
/** The box's fill alpha while KD is high. */
const LIT_FILL_ALPHA = 0.4;
/** The box outline's alpha while D is zero, before the first character. */
const EMPTY_FRAME_ALPHA = 0.4;

/** The press whose code is on `D`, while a key is down. */
export interface KeyboardHeldKey {
  /** The code it put on `D`. */
  readonly code: number;
  /**
   * The physical key that pressed it, by `KeyboardEvent.code`, which its
   * keyup carries whatever the modifiers; `null` for a press with no
   * physical key behind it. Another key may be the one still down.
   */
  readonly key: string | null;
}

/** Which keys {@link KeyboardComponent.releaseKeys} lets go of. */
export type KeyboardKeys = 'all' | 'physical';

/**
 * What a key operation sends its frames through, and asks whether a press
 * still fits behind what the input has pending.
 */
export type KeyboardRoute = Pick<InputRoute, 'send' | 'pending'>;

/**
 * A keyboard: `D0`…`D6` carry the ASCII code of the last key pressed and
 * keep it, `STB` pulses on every press, and `KD` is high while any key is
 * down. It is not a user input: no slot path and no pointer on the canvas
 * drives it. Its keys are pressed and released through the methods here,
 * which send the frames through the route they are given and keep the one
 * record of which keys are down and which press is on `D`
 * ({@link heldKey}), so every source of keys agrees on them: a press raises
 * `KD` (it stays high under a key pressed over another), and only the last
 * key down going up lowers it. A press or a text that does not fit behind
 * what the input still has to send is refused whole: nothing is sent,
 * nothing on `D` changes, and the caller is told so.
 *
 * The body is a keycap glyph above a readout box in the glyph column, the port
 * labels beside them. The readout shows the code on the data outputs, each
 * output read ahead of its bubble, so it is the code the keyboard sends, and
 * the box lights while `KD` is high; both follow the link state tick by
 * tick, in a watch as on the board. A code changes the readout's text and
 * scale and the box's alphas, never a context.
 */
export class KeyboardComponent extends Component<KeyboardOptions> {
  public readonly config = keyboardComponentConfig;

  // Set by every draw(). Declared rather than initialized: a class-field
  // define would run after the base constructor's first draw and drop them.
  declare private _code: number;
  declare private _lit: boolean;
  declare private _readout: BitmapText;
  declare private _frame: Graphics;
  declare private _fill: Graphics;

  // The keys down and the press on D, stamped with the session reset they
  // were pressed in: a stop rebuilds the engine with every output low.
  private readonly _down = signal<{
    held: KeyboardHeldKey;
    keys: ReadonlySet<string | null>;
    resets: number;
  } | null>(null);

  private readonly _current = computed(() => {
    const record = this._down();
    return record && record.resets === this.sessionResets() ? record : null;
  });

  /**
   * The press on `D` while a key is down, `KD` high; `null` while none is.
   * It stays the same object while the keys down change under it, until
   * the next press. Transient session state: {@link clearSimState} drops
   * it, and a stop outdates it.
   */
  public readonly heldKey: Signal<KeyboardHeldKey | null> = computed(
    () => this._current()?.held ?? null
  );

  constructor(options: KeyboardOptions) {
    super(keyboardMeta, options);
  }

  /**
   * Puts `code` on `D` with a strobe and `KD` high, the key `key` down — a
   * physical key, or none. Keys already down stay down, so `KD` stays high
   * until every one of them is up. Reports whether the press fit behind
   * what the input still has to send; one that does not sends nothing and
   * changes nothing.
   */
  public pressKey(
    route: KeyboardRoute,
    code: number,
    key: string | null = null
  ): boolean {
    const frames = pressFrames(code);
    if (!fitsInputQueue(route.pending(), frames)) {
      return false;
    }
    route.send(frames);
    const keys = new Set(this._current()?.keys);
    keys.add(key);
    this._down.set({
      held: { code, key },
      keys,
      resets: this.sessionResets()
    });
    return true;
  }

  /**
   * Holds `code` down with the key `key`: a press, unless `code` is on `D`
   * with a key down already, which `key` then joins without a strobe.
   * Reports whether it fit, as {@link pressKey} does.
   */
  public holdKey(
    route: KeyboardRoute,
    code: number,
    key: string | null = null
  ): boolean {
    const current = this._current();
    if (current?.held.code !== code) {
      return this.pressKey(route, code, key);
    }
    this._down.set({ ...current, keys: new Set([...current.keys, key]) });
    return true;
  }

  /**
   * Lets go of the key `key`. Only the last key down going up sends the
   * release, `KD` low; `D` keeps its code. Reports whether `key` was down.
   * A release is a state, so it always fits.
   */
  public releaseKey(
    route: Pick<InputRoute, 'send'>,
    key: string | null
  ): boolean {
    const current = this._current();
    if (!current?.keys.has(key)) {
      return false;
    }
    const keys = new Set(current.keys);
    keys.delete(key);
    this._setKeys(route, current, keys);
    return true;
  }

  /**
   * Lets go of every key down, or of every physical one, sending the
   * release if no key is left down. Reports whether a key was let go of.
   */
  public releaseKeys(
    route: Pick<InputRoute, 'send'>,
    which: KeyboardKeys = 'all'
  ): boolean {
    const current = this._current();
    if (!current) {
      return false;
    }
    const keys = new Set(
      which === 'all' ? [] : [...current.keys].filter((key) => key === null)
    );
    if (keys.size === current.keys.size) {
      return false;
    }
    this._setKeys(route, current, keys);
    return true;
  }

  /**
   * Sends `codes` as taps, a press and a release each, in order. A tap ends
   * with `KD` low, so every key down before counts as released. Reports
   * whether the text fit behind what the input still has to send; one that
   * does not is refused whole — never cut — and sends nothing.
   */
  public tapKeys(route: KeyboardRoute, codes: readonly number[]): boolean {
    if (codes.length === 0) {
      return true;
    }
    const frames = tapFrames(codes);
    if (!fitsInputQueue(route.pending(), frames)) {
      return false;
    }
    this._down.set(null);
    route.send(frames);
    return true;
  }

  /**
   * Drops every frame `route` still has queued and lets go of every key:
   * `STB` low on the next tick, `KD` low on the one after, `D` kept (see
   * `cancelFrames`).
   */
  public cancelKeys(route: Pick<InputRoute, 'cancel'>): void {
    this._down.set(null);
    route.cancel(cancelFrames());
  }

  public override clearSimState(): void {
    this._down.set(null);
  }

  public override setPortPowered(portIndex: number, powered: boolean): void {
    super.setPortPowered(portIndex, powered);
    const output = portIndex - this.numInputs;
    if (output < KEYBOARD_DATA_BITS || output === KEYBOARD_KEY_DOWN_OUTPUT) {
      this._syncReadout();
    }
  }

  // Entering and leaving a session flips every negated bit with no link change
  // behind it.
  public override setSimulating(active: boolean): void {
    super.setSimulating(active);
    this._syncReadout();
  }

  /** The label column: the body beside the glyph column. */
  protected override get portLabelRoom(): number {
    return this.bodyGridWidth - KEYBOARD_GLYPH_COLUMN_WIDTH;
  }

  /**
   * The code on the data outputs, each read ahead of its bubble: what the
   * keyboard sends, as the readout shows it.
   */
  public readCode(): number {
    return codeFromBits((bit) => this.isOutputHigh(bit));
  }

  private sessionResets(): number {
    return getStaticDI(SimulationService).resets();
  }

  /** Whether `KD` is high, read ahead of its bubble, as the box shows it. */
  private readKeyDown(): boolean {
    return this.isOutputHigh(KEYBOARD_KEY_DOWN_OUTPUT);
  }

  /**
   * Sets `keys` as the keys down, sending the release once none is left.
   * The press on `D` stays the same record while any key is down.
   */
  private _setKeys(
    route: Pick<InputRoute, 'send'>,
    current: { held: KeyboardHeldKey; resets: number },
    keys: ReadonlySet<string | null>
  ): void {
    if (keys.size > 0) {
      this._down.set({ ...current, keys });
      return;
    }
    this._down.set(null);
    route.send([releaseFrame()]);
  }

  private _syncReadout(): void {
    const code = this.readCode();
    const lit = this.readKeyDown();
    if (code !== this._code) {
      this._code = code;
      this._showCode();
    }
    if (lit !== this._lit) {
      this._lit = lit;
      this._showLit();
    }
  }

  private _showCode(): void {
    const text = readoutText(this._code);
    this._readout.text = text;
    // A mnemonic wider than the box shrinks by scale, not by font size: the
    // glyphs come from one atlas size either way.
    this._readout.scale.set(
      (PX *
        fitMonoFontSize(
          text,
          READOUT_ROOM,
          READOUT_FONT_SIZE,
          READOUT_MIN_FONT_SIZE
        )) /
        READOUT_FONT_SIZE
    );
    this._frame.alpha = this._code !== 0 ? 1 : EMPTY_FRAME_ALPHA;
  }

  private _showLit(): void {
    this._fill.alpha = this._lit ? LIT_FILL_ALPHA : 0;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(KeyboardKeycapGraphics, scale)
    );

    const fill = new Graphics(
      this.geometryService.getGraphicsContext(KeyboardReadoutFillGraphics)
    );
    this.onApplyTheme(
      () => (fill.tint = this.themingService.currentTheme().ledOn)
    );
    this.addChild(fill);
    const frame = this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        KeyboardReadoutFrameGraphics,
        scale
      )
    );

    const readout = new BitmapText({
      text: '',
      style: {
        fontFamily: CANVAS_FONT_FAMILY,
        fontSize: READOUT_FONT_SIZE,
        // White base, themed via tint — see Component._drawSymbol.
        fill: 0xffffff
      },
      anchor: { x: 0.5, y: 0.5 }
    });
    this.onApplyTheme(
      () => (readout.tint = this.themingService.currentTheme().fontTint)
    );
    // The box is a square centred here, so the upright text stays inside it
    // in every direction.
    readout.position.set(
      KEYBOARD_GLYPH_COLUMN_WIDTH / 2,
      KEYBOARD_READOUT_BOX.y + KEYBOARD_READOUT_BOX.size / 2
    );
    this.registerRotationCounterContainer(readout);
    this.addChild(this.addText(readout));

    this._fill = fill;
    this._frame = frame;
    this._readout = readout;
    this._code = this.readCode();
    this._showCode();
    this._lit = this.readKeyDown();
    this._showLit();
  }
}
