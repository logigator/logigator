import { Component } from '../../component';
import { textComponentConfig, TextOptions } from './text.config';
import { Direction, textMeta } from '@logigator/core';
import { ConnectionPointGraphics } from '../../../rendering/graphics/connection-point.graphics';
import { scaleForScale } from '../../../connection-points/connection-point';
import { BitmapText, Graphics, Rectangle } from 'pixi.js';
import { PX } from '../../../utils/grid';
import { CANVAS_FONT_FAMILY, monoTextWidth } from '../../../utils/text-fit';

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

  // The label overflows the 1×1 grid footprint far to the side, so culling
  // needs its full extent or the text vanishes once the anchor cell pans off
  // screen. gridBounds stays 1×1, leaving selection and collision unchanged.
  // Width is arithmetic (Roboto Mono: 0.6 em/glyph), so it is right before the
  // glyph atlas is baked.
  public override get cullBounds(): Rectangle {
    const fontSize = this.options.fontSize.value;
    const lines = this.options.text.value.split('\n');
    const widthGrid =
      Math.max(...lines.map((l) => monoTextWidth(l, fontSize))) * PX;
    const heightGrid = lines.length * fontSize * PX;
    // Local content box in the unrotated (E) frame: the dot cell [0, 1] plus
    // the label from x = 1, centred on y = 0.5. Rounded outward to whole cells
    // so the box always over-covers.
    const x0 = 0;
    const x1 = 1 + widthGrid;
    const y0 = Math.min(0, 0.5 - 0.55 * heightGrid);
    const y1 = Math.max(1, 0.5 + 0.45 * heightGrid);
    return this._rotatedBox(
      Math.floor(x0),
      Math.floor(y0),
      Math.ceil(x1),
      Math.ceil(y1)
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
