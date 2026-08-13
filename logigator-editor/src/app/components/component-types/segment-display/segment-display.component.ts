import { BitmapText, Container } from 'pixi.js';
import { Component } from '../../component';
import { PX } from '../../../utils/grid';
import {
  SEGMENT_FONT_7,
  SEGMENT_FONT_14,
  SEGMENT_FONT_METRICS
} from '../../../utils/segment-font';
import {
  SegmentBase,
  segmentDisplayMeta,
  segmentReadoutDigits
} from '@logigator/core';
import {
  segmentDisplayComponentConfig,
  SegmentDisplayOptions
} from './segment-display.config';

const READOUT_FONT_SIZE = 1.35 / PX;
const BASE_FONT_SIZE = 0.4 / PX;

/**
 * A display-only readout: not a simulator unit — it renders the binary value
 * on its input nets (input 0 = least significant bit) as a zero-padded number
 * in the configured base, applied through the regular
 * {@link Component.setPortPowered} path.
 */
export class SegmentDisplayComponent extends Component<SegmentDisplayOptions> {
  public readonly config = segmentDisplayComponentConfig;

  // Assigned in draw(); the class-field define runs after the base
  // constructor's first draw and resets it to undefined, so a state change
  // arriving before the next rebuild falls back to a full redraw.
  private _readout?: BitmapText;

  constructor(options: SegmentDisplayOptions) {
    super(segmentDisplayMeta, options);
  }

  public override setPortPowered(portIndex: number, powered: boolean): void {
    super.setPortPowered(portIndex, powered);
    if (this._readout) {
      this._readout.text = this._formatValue();
    } else {
      this.redraw();
    }
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);

    const base = this.options.base.value;
    const font = base === SegmentBase.HEX ? SEGMENT_FONT_14 : SEGMENT_FONT_7;
    const text = this._formatValue();

    // Readout and base indicator share one container so the counter-rotation
    // keeps their arrangement intact across component rotations.
    const readout = new BitmapText({
      text,
      style: {
        fontFamily: font,
        fontSize: READOUT_FONT_SIZE,
        // White base, themed via tint — see Component._drawSymbol.
        fill: 0xffffff
      },
      anchor: { x: 0.5, y: 0.5 }
    });
    readout.scale.set(PX);
    this._readout = readout;

    const baseIndicator = new BitmapText({
      text:
        base === SegmentBase.DEC ? '10' : base === SegmentBase.HEX ? '16' : '8',
      style: {
        fontFamily: SEGMENT_FONT_7,
        fontSize: BASE_FONT_SIZE,
        fill: 0xffffff
      },
      anchor: { x: 0, y: 0.5 }
    });
    baseIndicator.scale.set(PX);
    this.onApplyTheme(() => {
      const fontTint = this.themingService.currentTheme().fontTint;
      readout.tint = fontTint;
      baseIndicator.tint = fontTint;
    });
    // The readout extents are computed arithmetically (see
    // SEGMENT_FONT_METRICS) — measuring the BitmapText here resolves through
    // a fallback font when the component draws before the atlases install.
    const metrics = SEGMENT_FONT_METRICS[font];
    const readoutEm = READOUT_FONT_SIZE * PX;
    baseIndicator.position.set(
      (text.length * metrics.advance * readoutEm) / 2 -
        (base !== SegmentBase.OCT ? 0.2 : 0),
      (metrics.lineHeight * readoutEm) / 2
    );

    const display = new Container();
    display.addChild(readout);
    display.addChild(baseIndicator);
    display.position.set(this.bodyGridWidth / 2, this.bodyGridHeight / 2);
    this.registerRotationCounterContainer(display);
    this.addChild(display);
  }

  private _formatValue(): string {
    let value = 0;
    for (let i = this.numInputs - 1; i >= 0; i--) {
      value = (value << 1) | (this.isPortPowered(i) ? 1 : 0);
    }
    const base = this.options.base.value;
    const radix =
      base === SegmentBase.HEX ? 16 : base === SegmentBase.OCT ? 8 : 10;
    return value
      .toString(radix)
      .padStart(segmentReadoutDigits(base, this.numInputs), '0');
  }
}
