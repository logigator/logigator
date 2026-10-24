import { signal, Signal } from '@angular/core';
import { BitmapText, Container, Graphics } from 'pixi.js';
import {
  TERMINAL_LABEL_COLUMN_WIDTH,
  terminalMeta,
  terminalScreen,
  TerminalScreen,
  TerminalValues
} from '@logigator/core';
import { Component } from '../../component';
import { SimulationService } from '../../../simulation/simulation.service';
import type { RecordWatch } from '../../../simulation/worker/simulation-worker.service';
import { getStaticDI } from '../../../utils/get-di';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY } from '../../../utils/text-fit';
import {
  TerminalCursorGraphics,
  TerminalFrameGraphics
} from '../../../rendering/graphics/terminal.graphics';
import { strokeScaleFor } from '../../../rendering/graphics/stroke-scale';
import { TerminalScreenBuffer, TerminalScreenView } from './terminal-screen';
import { terminalComponentConfig, TerminalOptions } from './terminal.config';

/** The cursor block's alpha, low enough to show the character under it. */
const CURSOR_ALPHA = 0.5;
/** The frame's alpha outside a session, when nothing can print. */
const IDLE_FRAME_ALPHA = 0.4;

/** Starts a watch over a terminal's recorder that hands its reads to `onRead`. */
export type TerminalRecordSource = (
  onRead: (first: number, values: Uint32Array) => void
) => RecordWatch | null;

/**
 * A text screen: each rising `CLK` writes the byte on `D0`…`D7`, which the
 * engine records and the host hands over through {@link applyRecords}. The
 * screen and its scrollback are {@link screen}, transient session state that
 * a pause keeps and {@link clearSimState} drops.
 *
 * A session reads the records from its start whether a window is open or
 * not: {@link setSimulating} watches the board's own terminal, and a watch
 * level hands its copy the copy's recorder through {@link readRecords}.
 *
 * The body is the port labels' column beside a framed screen, which stays
 * upright in every direction. Each screen row is one text, rewritten only
 * when its row changed; the cursor is a block moved by position and shown by
 * alpha while a session runs.
 */
export class TerminalComponent extends Component<TerminalOptions> {
  public readonly config = terminalComponentConfig;

  // Set by draw(), the screen by the first one. Declared rather than
  // initialized: a class-field define would run after the base constructor's
  // first draw and drop them.
  declare private _screen: TerminalScreenBuffer;
  declare private _nextRecord: number;
  declare private _active: boolean;
  declare private _box: TerminalScreen;
  declare private _rowTexts: BitmapText[];
  declare private _cursor: Graphics;
  declare private _frame: Graphics;
  declare private _drawnVersion: number;

  private readonly _version = signal(0);
  private _records: RecordWatch | null = null;

  /**
   * The screen's {@link TerminalScreenBuffer.version} after the last change
   * folded in or cleared, for a view that reads {@link screen}.
   */
  public readonly version: Signal<number> = this._version.asReadonly();

  constructor(options: TerminalOptions) {
    super(terminalMeta, options);
  }

  /** The screen and its scrollback; changed only through this component. */
  public get screen(): TerminalScreenView {
    return this._screen;
  }

  /**
   * Folds the records `first`, `first + 1`, … into the screen, each one the
   * byte on `D`. A `first` past the next record expected means the ones
   * between were lost, which the scrollback marks; records already folded
   * are skipped.
   */
  public applyRecords(first: number, values: Uint32Array): void {
    if (first > this._nextRecord) {
      this._screen.markLost(first - this._nextRecord);
    }
    const skip = Math.max(0, this._nextRecord - first);
    if (skip < values.length) {
      this._screen.write(values, skip);
      this._nextRecord = first + values.length;
    }
    this._showScreen();
  }

  /**
   * Folds in what the watch `source` starts reads, in place of any watch
   * read before, until {@link stopReadingRecords} or the session's end.
   */
  public readRecords(source: TerminalRecordSource): void {
    this._records?.close();
    this._records = source((first, values) => this.applyRecords(first, values));
  }

  public stopReadingRecords(): void {
    this._records?.close();
    this._records = null;
  }

  public override clearSimState(): void {
    this._screen.reset();
    this._nextRecord = 0;
    this._showScreen();
  }

  // Entering reads the compiled board's terminal of this id from its first
  // record; a watch copy's id is in no compiled board, so it reads nothing.
  public override setSimulating(active: boolean): void {
    super.setSimulating(active);
    this._active = active;
    this._showActive();
    if (active) {
      const simulation = getStaticDI(SimulationService);
      this.readRecords((onRead) => simulation.watchRecords(this.id, onRead));
    } else {
      this.stopReadingRecords();
    }
  }

  /** The label column: the screen takes the rest of the body. */
  protected override get portLabelRoom(): number {
    return TERMINAL_LABEL_COLUMN_WIDTH;
  }

  private get _values(): TerminalValues {
    return {
      columns: this.options.columns.value,
      rows: this.options.rows.value,
      textSize: this.options.textSize.value
    };
  }

  /** Rewrites the rows changed since the last call and moves the cursor. */
  private _showScreen(): void {
    const screen = this._screen;
    if (screen.version === this._drawnVersion) {
      return;
    }
    for (let row = 0; row < this._rowTexts.length; row++) {
      if (screen.rowVersion(row) > this._drawnVersion) {
        this._rowTexts[row].text = screen.rowText(row);
      }
    }
    this._placeCursor();
    this._drawnVersion = screen.version;
    this._version.set(screen.version);
  }

  private _placeCursor(): void {
    const { width, height, advance, lineHeight } = this._box;
    this._cursor.position.set(
      -width / 2 + this._screen.cursorColumn * advance,
      -height / 2 + this._screen.cursorRow * lineHeight
    );
  }

  private _showActive(): void {
    this._cursor.alpha = this._active ? CURSOR_ALPHA : 0;
    this._frame.alpha = this._active ? 1 : IDLE_FRAME_ALPHA;
  }

  protected draw(): void {
    const values = this._values;
    // The screen outlives a redraw; only a new size starts it over.
    if (!this._screen) {
      this._screen = new TerminalScreenBuffer(values.columns, values.rows);
      this._nextRecord = 0;
    } else if (
      this._screen.columns !== values.columns ||
      this._screen.rows !== values.rows
    ) {
      this._screen.resize(values.columns, values.rows);
      this._nextRecord = 0;
    }

    this.addBody(this.bodyGridWidth, this.bodyGridHeight);

    const box = terminalScreen(values, this.direction);
    const display = new Container();
    display.position.set(box.centerX, box.centerY);
    this.registerRotationCounterContainer(display);

    const frame = new Graphics();
    this.onApplyScale(
      (scale) =>
        (frame.context = this.geometryService.getGraphicsContext(
          TerminalFrameGraphics,
          box.width,
          box.height,
          strokeScaleFor(scale)
        ))
    );
    display.addChild(frame);

    const cursor = new Graphics(
      this.geometryService.getGraphicsContext(TerminalCursorGraphics)
    );
    cursor.scale.set(box.advance, box.lineHeight);
    display.addChild(cursor);

    const rowTexts: BitmapText[] = [];
    for (let row = 0; row < values.rows; row++) {
      const text = new BitmapText({
        text: this._screen.rowText(row),
        style: {
          fontFamily: CANVAS_FONT_FAMILY,
          fontSize: box.fontSize / PX,
          // White base, themed via tint — see Component._drawSymbol.
          fill: 0xffffff
        },
        anchor: { x: 0, y: 0.5 }
      });
      text.scale.set(PX);
      text.position.set(
        -box.width / 2,
        -box.height / 2 + (row + 0.5) * box.lineHeight
      );
      rowTexts.push(text);
      display.addChild(this.addText(text));
    }
    this.onApplyTheme(() => {
      const fontTint = this.themingService.currentTheme().fontTint;
      cursor.tint = fontTint;
      for (const text of rowTexts) {
        text.tint = fontTint;
      }
    });
    this.addChild(display);

    this._box = box;
    this._frame = frame;
    this._cursor = cursor;
    this._rowTexts = rowTexts;
    this._drawnVersion = this._screen.version;
    this._placeCursor();
    this._showActive();
  }
}
