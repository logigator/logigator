import { Container, Graphics, Point } from 'pixi.js';
import { Component, PortSide } from '../components/component';
import { Wire } from '../wires/wire';
import { ConnectionPoint } from '../connection-points/connection-point';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from './graphics-provider.service';
import {
  NegationBubbleGraphics,
  scaleForScale
} from './graphics/negation-bubble.graphics';

/**
 * The transient overlay above the committed circuit: hosts drag-session
 * ghosts (placement previews, moved selections, paste ghosts) in its
 * `dragLayer` and the port-negation hover preview. Purely visual — input
 * routing and session lifecycle live in the `WorkModeRouter`.
 */
export class FloatingLayer extends Container {
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >();

  // Ghost bubble shown under the cursor while in PORT_NEGATION mode, previewing
  // the port the next click would toggle. Lazily created, hidden when no port
  // is in range.
  private _negationHoverGhost: Graphics | null = null;

  // Latest zoom scale, so the negation ghost can size itself screen-constant on
  // show (drag-session children get it fanned out in updateScale instead).
  private _currentScale = 1;

  constructor() {
    super();
    this.addChild(this._dragLayer);
  }

  /** The container drag sessions parent their ghost elements into. */
  public get dragLayer(): Container<Component | Wire | ConnectionPoint> {
    return this._dragLayer;
  }

  public updateScale(scale: number) {
    this._currentScale = scale;
    for (const child of this._dragLayer.children) {
      child.applyScale(scale);
    }
    if (this._negationHoverGhost?.visible) {
      this._sizeNegationGhost(this._negationHoverGhost, scale);
    }
  }

  /**
   * Shows the negation preview bubble pinned to a grid-space body-edge anchor,
   * matching the real bubble: tangent-pivoted, rotated with the component, and
   * grown outward at the current zoom's size.
   */
  public showNegationGhost(
    anchor: Point,
    side: PortSide,
    rotation: number
  ): void {
    const ghost = this._ensureNegationHoverGhost();
    ghost.position.copyFrom(anchor);
    ghost.pivot.set(side === 'in' ? 0.5 : -0.5, 0);
    ghost.rotation = rotation;
    this._sizeNegationGhost(ghost, this._currentScale);
    ghost.visible = true;
  }

  public hideNegationGhost(): void {
    if (this._negationHoverGhost) {
      this._negationHoverGhost.visible = false;
    }
  }

  // Sizes the ghost like a real bubble: transform sets the dot size, the
  // zoom-dependent context keeps the border a fixed 1px (see
  // NegationBubbleGraphics).
  private _sizeNegationGhost(ghost: Graphics, scale: number): void {
    ghost.context = getStaticDI(GraphicsProviderService).getGraphicsContext(
      NegationBubbleGraphics,
      scale
    );
    ghost.scale.set(scaleForScale(scale));
  }

  private _ensureNegationHoverGhost(): Graphics {
    if (!this._negationHoverGhost) {
      const ghost = new Graphics();
      ghost.alpha = 0.5;
      // Above components/wires since the floating layer is the top child of
      // gridSpace; shares its grid-unit coordinate space.
      this.addChild(ghost);
      this._negationHoverGhost = ghost;
    }
    return this._negationHoverGhost;
  }
}
