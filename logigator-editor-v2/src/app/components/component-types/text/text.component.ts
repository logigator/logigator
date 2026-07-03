import { Component } from '../../component';
import { textComponentConfig, TextOptions } from './text.config';
import { Direction } from '../../../utils/direction';
import { ConnectionPointGraphics } from '../../../rendering/graphics/connection-point.graphics';
import { ConnectionPoint } from '../../../connection-points/connection-point';
import { DestroyOptions, Graphics, Text } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY } from '../../../utils/text-fit';

export class TextComponent extends Component<TextOptions> {
  public readonly config = textComponentConfig;
  public override readonly ignoresWireCollision = true;

  private readonly _destroy$ = new Subject<void>();

  constructor(options: TextOptions) {
    super(0, 0, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
        this.redraw();
      });
    this.options.text.onChange$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.redraw());
    this.options.fontSize.onChange$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.redraw());
  }

  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 1;
  }

  protected override get bodyGridHeight(): number {
    return 1;
  }

  protected draw(): void {
    const dot = new Graphics();
    dot.context = this.geometryService.getGraphicsContext(
      ConnectionPointGraphics
    );
    dot.pivot.set(0.5, 0.5);
    dot.position.set(0.5, 0.5);
    // ConnectionPointGraphics is a 1×1 unit square; size it identically to a
    // connection point (zoom-dependent screen px) expressed in grid units.
    this.onApplyScale((scale) =>
      dot.scale.set((ConnectionPoint.screenSizePxForScale(scale) * PX) / scale)
    );
    this.addChild(dot);

    // fontSize is a user-set pixel value; scale.set(PX) converts the label
    // from pixel space to grid space so it can be positioned in grid units.
    const label = this.trackTextResolution(
      new Text({
        text: this.options.text.value,
        style: {
          fontFamily: CANVAS_FONT_FAMILY,
          fontSize: this.options.fontSize.value,
          fill: this.themingService.currentTheme().fontTint
        }
      })
    );
    label.scale.set(PX);
    // For W direction the component is rotated 180°, which would flip the glyphs upside-down.
    // Counter-rotating the label by π keeps glyphs upright; flipping the anchor mirrors
    // the layout so the text still sits on the far side of the dot (left instead of right).
    if (this.direction === Direction.W) {
      label.anchor.set(1, 0.55);
      label.rotation = Math.PI;
    } else {
      label.anchor.set(0, 0.55);
    }
    label.position.set(1, 0.5);
    this.addChild(label);
  }

  public override destroy(options?: DestroyOptions): void {
    this._destroy$.next();
    super.destroy(options);
  }
}
