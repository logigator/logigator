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
   * A text or font-size edit resizes {@link cullBounds}, so the element has to
   * be re-bucketed in the quad tree — the base's redraw only rebuilds the
   * visuals. `portsChange$` is the established re-file signal, and this
   * component has no ports, so it fires with empty port sets (wire integration
   * and connection-point updates no-op).
   */
  protected override onOptionsChanged(): void {
    const ports = this.connectionPoints;
    super.onOptionsChanged();
    this.portsChange$.next({
      oldPorts: ports,
      newPorts: this.connectionPoints
    });
  }

  // The rendered label overflows the 1×1 grid footprint far to the side, so
  // report its full extent for culling — otherwise the label vanishes once the
  // 1×1 anchor cell pans off screen while its glyphs are still visible.
  // gridBounds stays 1×1, so selection and collision are unchanged. Width is
  // arithmetic (Roboto Mono: 0.6 em/glyph), correct on the first insert and on
  // file-load before the glyph atlas is baked.
  public override get cullBounds(): Rectangle {
    const fontSize = this.options.fontSize.value;
    const lines = this.options.text.value.split('\n');
    const widthGrid =
      Math.max(...lines.map((l) => monoTextWidth(l, fontSize))) * PX;
    const heightGrid = lines.length * fontSize * PX;
    // Local content box in the unrotated (E) frame: the dot cell [0, 1] plus the
    // label, which starts at x = 1 and is vertically centred on y = 0.5 (anchor
    // 0.55). Round outward to whole grid cells so the box always over-covers.
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
    // The shared dot context is a white base (see ConnectionPointGraphics);
    // the theme's wire color is applied as tint, like a real connection point.
    this.onApplyTheme(
      () => (dot.tint = this.themingService.currentTheme().wire)
    );
    dot.pivot.set(0.5, 0.5);
    dot.position.set(0.5, 0.5);
    // ConnectionPointGraphics is a 1×1 unit square; size it identically to a
    // connection point via the shared size curve.
    this.onApplyScale((scale) => dot.scale.set(scaleForScale(scale)));
    this.addChild(dot);

    // fontSize is a user-set pixel value; scale.set(PX) converts the label
    // from pixel space to grid space so it can be positioned in grid units.
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
}
