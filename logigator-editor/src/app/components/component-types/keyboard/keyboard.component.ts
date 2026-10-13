import { BitmapText, Graphics } from 'pixi.js';
import {
  KEYBOARD_DATA_BITS,
  KEYBOARD_GLYPH_COLUMN_WIDTH,
  keyboardMeta
} from '@logigator/core';
import { Component } from '../../component';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY, fitMonoFontSize } from '../../../utils/text-fit';
import {
  KEYBOARD_READOUT_BOX,
  KeyboardKeycapGraphics,
  KeyboardReadoutFillGraphics,
  KeyboardReadoutFrameGraphics
} from '../../../rendering/graphics/keyboard.graphics';
import { codeFromBits, readoutText } from './ascii';
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

/**
 * A keyboard: `D0`…`D6` carry the ASCII code of the held key, `STB` pulses on
 * every press. The canvas component holds no simulation state of its own and
 * is not a user input: no slot path and no pointer on the canvas drives it.
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

  constructor(options: KeyboardOptions) {
    super(keyboardMeta, options);
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
