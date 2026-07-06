import { BitmapText, Container, DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { PX } from '../../../utils/grid';
import { SEGMENT_FONT_7, SEGMENT_FONT_14 } from '../../../utils/segment-font';
import {
  SegmentBase,
  segmentDisplayComponentConfig,
  SegmentDisplayOptions
} from './segment-display.config';

const READOUT_FONT_SIZE = 1.35 / PX;
const BASE_FONT_SIZE = 0.4 / PX;

/**
 * Digits the readout needs for the largest value `inputs` bits can carry —
 * the value is zero-padded to exactly this length.
 */
export function segmentReadoutDigits(
  base: SegmentBase,
  inputs: number
): number {
  switch (base) {
    case SegmentBase.HEX:
      return Math.ceil(inputs / 4);
    case SegmentBase.OCT:
      return Math.ceil(inputs / 3);
    default:
      return Math.ceil(Math.log10(2 ** inputs + 1));
  }
}

/**
 * A display-only readout: not a simulator unit — it renders the binary value
 * on its input nets (input 0 = least significant bit) as a zero-padded number
 * in the configured base, applied through the regular
 * {@link Component.setPortPowered} path.
 */
export class SegmentDisplayComponent extends Component<SegmentDisplayOptions> {
  public readonly config = segmentDisplayComponentConfig;

  private readonly destroy$ = new Subject<void>();

  // Assigned in draw(); the class-field define runs after the base
  // constructor's first draw and resets it to undefined, so a state change
  // arriving before the next rebuild falls back to a full redraw.
  private _readout?: BitmapText;

  constructor(options: SegmentDisplayOptions) {
    super(options.numInputs.value, 0, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.numInputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.numInputs.value;
      });

    // Base changes swap the readout font, digit count and body width.
    this.options.base.onChange$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.redraw();
    });
  }

  public override setPortPowered(portIndex: number, powered: boolean): void {
    super.setPortPowered(portIndex, powered);
    if (this._readout) {
      this._readout.text = this._formatValue();
    } else {
      this.redraw();
    }
  }

  protected get inputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numInputs; i++) {
      labels.push(String(i));
    }
    return labels;
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // Mirrors the legacy geometry (frozen for the v0 anchor math in
  // legacy-anchor.ts): wide enough for the zero-padded readout when
  // horizontal, a fixed 4 when standing upright.
  protected get bodyGridWidth(): number {
    if (this.direction % 2 === 1) {
      return 4;
    }
    return (
      2 +
      segmentReadoutDigits(
        this.options.base.value,
        this.options.numInputs.value
      )
    );
  }

  // At least three rows tall so the readout fits beside few inputs (legacy
  // geometry, mirrored by the frozen LEGACY_MIN_BODY_HEIGHTS entry).
  protected override get bodyGridHeight(): number {
    return Math.max(3, this.numInputs, this.numOutputs);
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);

    const base = this.options.base.value;
    const fontTint = this.themingService.currentTheme().fontTint;

    // Readout and base indicator share one container so the counter-rotation
    // keeps their arrangement intact across component rotations.
    const readout = new BitmapText({
      text: this._formatValue(),
      style: {
        fontFamily: base === SegmentBase.HEX ? SEGMENT_FONT_14 : SEGMENT_FONT_7,
        fontSize: READOUT_FONT_SIZE,
        fill: fontTint
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
        fill: fontTint
      },
      anchor: { x: 0, y: 0.5 }
    });
    baseIndicator.scale.set(PX);
    baseIndicator.position.set(
      readout.width / 2 - (base !== SegmentBase.OCT ? 0.2 : 0),
      readout.height / 2
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

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
