import { computed, signal, Signal } from '@angular/core';
import { BitmapText, Graphics } from 'pixi.js';
import {
  KEYBOARD_DATA_BITS,
  KEYBOARD_GLYPH_COLUMN_WIDTH,
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
  codeFromBits,
  pressFrames,
  readoutText,
  releaseFrame,
  resetFrame,
  tapFrames
} from './ascii';
import { keyboardComponentConfig, KeyboardOptions } from './keyboard.config';

/** The readout's font size for a single character, in pixels. */
const READOUT_FONT_SIZE = 1.4 / PX;
const READOUT_MIN_FONT_SIZE = 0.5 / PX;
/** Width a readout may span inside its box, in pixels. */
const READOUT_ROOM = (KEYBOARD_READOUT_BOX.size - 0.4) / PX;
/** The box's fill alpha while a code is on D. */
const LIT_FILL_ALPHA = 0.4;
/** The box outline's alpha while D is zero. */
const EMPTY_FRAME_ALPHA = 0.4;

/** The key whose code is on `D`. */
export interface KeyboardHeldKey {
  /** The code it put on `D`. */
  readonly code: number;
  /**
   * The physical key holding it, by `KeyboardEvent.code`, which its keyup
   * carries whatever the modifiers; `null` for a key pressed with no physical
   * key behind it.
   */
  readonly key: string | null;
}

/**
 * What a key operation sends its frames through, and asks whether a press
 * still fits behind what the input has pending.
 */
export type KeyboardRoute = Pick<InputRoute, 'send' | 'pending'>;

/**
 * A keyboard: `D0`…`D6` carry the ASCII code of the held key, `STB` pulses on
 * every press. It is not a user input: no slot path and no pointer on the
 * canvas drives it. Its keys are pressed and released through the methods
 * here, which send the frames through the route they are given and keep the
 * one record of which key is on `D` ({@link heldKey}), so every source of
 * keys agrees on it. A press or a text that does not fit behind what the
 * input still has to send is refused whole: nothing is sent, nothing on
 * `D` changes, and the caller is told so.
 *
 * The body is a keycap glyph above a readout box in the glyph column, the port
 * labels beside them. The readout shows the code on the data outputs, each
 * output read ahead of its bubble, so it is the code the keyboard sends; it
 * follows the link state tick by tick, in a watch as on the board. A code
 * changes the readout's text and scale and the box's alphas, never a context.
 */
export class KeyboardComponent extends Component<KeyboardOptions> {
  public readonly config = keyboardComponentConfig;

  // Set by every draw(). Declared rather than initialized: a class-field
  // define would run after the base constructor's first draw and drop them.
  declare private _code: number;
  declare private _readout: BitmapText;
  declare private _frame: Graphics;
  declare private _fill: Graphics;

  // Stamped with the session reset it was pressed in: a stop rebuilds the
  // engine with nothing on D.
  private readonly _held = signal<{
    held: KeyboardHeldKey;
    resets: number;
  } | null>(null);

  /**
   * The key on `D`, or `null` when no key holds it. Transient session state:
   * {@link clearSimState} drops it, and a stop outdates it.
   */
  public readonly heldKey: Signal<KeyboardHeldKey | null> = computed(() => {
    const record = this._held();
    return record && record.resets === this.sessionResets()
      ? record.held
      : null;
  });

  constructor(options: KeyboardOptions) {
    super(keyboardMeta, options);
  }

  /**
   * Puts `code` on `D` with a strobe, held by the physical key `key` or by
   * none. The key held before is let go of without a release of its own.
   * Reports whether the press fit behind what the input still has to send;
   * one that does not sends nothing and leaves the key held before on `D`.
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
    this._held.set({ held: { code, key }, resets: this.sessionResets() });
    return true;
  }

  /**
   * Sets `D` to zero if a key is on it; reports whether one was. A release
   * is a state, so it always fits.
   */
  public releaseKey(route: Pick<InputRoute, 'send'>): boolean {
    if (!this.heldKey()) {
      return false;
    }
    this._held.set(null);
    route.send([releaseFrame()]);
    return true;
  }

  /**
   * Sends `codes` as taps, a press and a release each, in order. A tap takes
   * `D` over, so the key held before counts as released. Reports whether
   * the text fit behind what the input still has to send; one that does not
   * is refused whole — never cut — and sends nothing.
   */
  public tapKeys(route: KeyboardRoute, codes: readonly number[]): boolean {
    if (codes.length === 0) {
      return true;
    }
    const frames = tapFrames(codes);
    if (!fitsInputQueue(route.pending(), frames)) {
      return false;
    }
    this._held.set(null);
    route.send(frames);
    return true;
  }

  /**
   * Drops every frame `route` still has queued and sets every output low on
   * the next tick.
   */
  public cancelKeys(route: Pick<InputRoute, 'cancel'>): void {
    this._held.set(null);
    route.cancel(resetFrame());
  }

  public override clearSimState(): void {
    this._held.set(null);
  }

  public override setPortPowered(portIndex: number, powered: boolean): void {
    super.setPortPowered(portIndex, powered);
    if (portIndex - this.numInputs < KEYBOARD_DATA_BITS) {
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

  private _syncReadout(): void {
    const code = this.readCode();
    if (code !== this._code) {
      this._code = code;
      this._showCode();
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
    const held = this._code !== 0;
    this._fill.alpha = held ? LIT_FILL_ALPHA : 0;
    this._frame.alpha = held ? 1 : EMPTY_FRAME_ALPHA;
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
  }
}
