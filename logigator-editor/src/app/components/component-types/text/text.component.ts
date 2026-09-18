import { Component } from '../../component';
import { textComponentConfig, TextOptions } from './text.config';
import { Direction, textMeta } from '@logigator/core';
import { ConnectionPointGraphics } from '../../../rendering/graphics/connection-point.graphics';
import { scaleForScale } from '../../../connection-points/connection-point';
import { BitmapText, Graphics, Rectangle } from 'pixi.js';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY, monoTextWidth } from '../../../utils/text-fit';
import { rotatedBoxIntersects } from '../../component-geometry';

export class TextComponent extends Component<TextOptions> {
  public readonly config = textComponentConfig;
  public override readonly ignoresWireCollision = true;

  constructor(options: TextOptions) {
    super(textMeta, options);
  }

  /**
   * A text or font-size edit resizes {@link cullBounds}, so the element must be
   * re-bucketed in the quad tree, which the base's visual-only redraw does not
   * do. `portsChange$` is the re-file signal; this component has no ports, so
   * it fires with empty sets and the wire/connection-point work no-ops.
   */
  protected override onOptionsChanged(): void {
    const ports = this.connectionPoints;
    super.onOptionsChanged();
    this.portsChange$.next({
      oldPorts: ports,
      newPorts: this.connectionPoints
    });
  }

  /**
   * The label's glyph box in the unrotated (E) frame, hanging off the anchor
   * dot's right edge at y = 0.5. `up`/`down` are the fractions of the line
   * height above and below that centre: the W anchor flip mirrors them, so the
   * label stays on the far side of the dot whichever way the element faces.
   * Width is arithmetic (Roboto Mono: 0.6 em/glyph), so it is right before the
   * glyph atlas is baked.
   */
  private get _labelBox(): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } {
    const fontSize = this.options.fontSize.value;
    const lines = this.options.text.value.split('\n');
    const width =
      Math.max(...lines.map((l) => monoTextWidth(l, fontSize))) * PX;
    const height = lines.length * fontSize * PX;
    const [up, down] =
      this.direction === Direction.W ? [0.45, 0.55] : [0.55, 0.45];
    return {
      x0: 1,
      y0: 0.5 - up * height,
      x1: 1 + width,
      y1: 0.5 + down * height
    };
  }

  /** {@link _labelBox} plus the 1×1 anchor cell the label hangs off. */
  private get _drawnBox(): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } {
    const label = this._labelBox;
    return {
      x0: 0,
      y0: Math.min(0, label.y0),
      x1: Math.max(1, label.x1),
      y1: Math.max(1, label.y1)
    };
  }

  // The label overflows the 1×1 grid footprint far to the side, so culling
  // needs its full extent or the text vanishes once the anchor cell pans off
  // screen. gridBounds stays 1×1, leaving collision unchanged. Rounded outward
  // to whole cells so the box always over-covers.
  public override get cullBounds(): Rectangle {
    const { x0, y0, x1, y1 } = this._drawnBox;
    return this._rotatedBox(
      Math.floor(x0),
      Math.floor(y0),
      Math.ceil(x1),
      Math.ceil(y1)
    );
  }

  // The label is drawn, so it is what a click aims at: the glyph box selects
  // the element like the anchor cell does. Unrounded — the pick needs the box
  // the user sees, not the cull box built to over-cover it.
  public override get pickBounds(): Rectangle {
    const { x0, y0, x1, y1 } = this._drawnBox;
    return this._rotatedBox(x0, y0, x1, y1);
  }

  /** Allocation-free mirror of {@link pickBounds} — the two must agree. */
  public override intersectsPickBounds(rect: Rectangle): boolean {
    const { x0, y0, x1, y1 } = this._drawnBox;
    return rotatedBoxIntersects(
      this.direction,
      this.position,
      x0,
      y0,
      x1,
      y1,
      rect
    );
  }

  protected draw(): void {
    const dot = new Graphics();
    dot.context = this.geometryService.getGraphicsContext(
      ConnectionPointGraphics
    );
    // White-base shared context, themed by tint, like a real connection point.
    this.onApplyTheme(
      () => (dot.tint = this.themingService.currentTheme().wire)
    );
    dot.pivot.set(0.5, 0.5);
    dot.position.set(0.5, 0.5);
    // A 1×1 unit square, sized by the shared connection-point curve.
    this.onApplyScale((scale) => dot.scale.set(scaleForScale(scale)));
    this.addChild(dot);

    // fontSize is a user-set pixel value; scale.set(PX) takes the label from
    // pixel space to grid space.
    const label = new BitmapText({
      text: this.options.text.value,
      style: {
        fontFamily: CANVAS_FONT_FAMILY,
        fontSize: this.options.fontSize.value,
        // White base, themed via tint — see Component._drawSymbol.
        fill: 0xffffff
      }
    });
    this.onApplyTheme(
      () => (label.tint = this.themingService.currentTheme().fontTint)
    );
    label.scale.set(PX);
    // W rotates the component 180°, which would flip the glyphs upside-down.
    // Counter-rotating by π keeps them upright; flipping the anchor mirrors the
    // layout so the text still sits on the far side of the dot.
    if (this.direction === Direction.W) {
      label.anchor.set(1, 0.55);
      label.rotation = Math.PI;
    } else {
      label.anchor.set(0, 0.55);
    }
    label.position.set(1, 0.5);
    this.addChild(label);
  }
}
