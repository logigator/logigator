import { Container, Graphics, Point, PointData, Rectangle } from 'pixi.js';
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

  // Persistent grab rect over the committed selection (the drag target after
  // the marquee is released). Lazily created; styled like the live marquee so
  // release-to-persist feels continuous. Sized via scale on a unit rect —
  // fill-only, so no zoom retuning is needed.
  private _selectionRect: Graphics | null = null;
  // The rect's base position (grid units); a mid-move offset adds onto it.
  private readonly _selectionRectBase = new Point();

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

  /** Shows the selection grab rect over the given grid-space bounds. */
  public showSelectionRect(rect: Rectangle): void {
    const g = this._ensureSelectionRect();
    this._selectionRectBase.set(rect.x, rect.y);
    g.position.copyFrom(this._selectionRectBase);
    g.scale.set(rect.width, rect.height);
    g.visible = true;
  }

  public hideSelectionRect(): void {
    if (this._selectionRect) {
      this._selectionRect.visible = false;
    }
  }

  /**
   * Displaces the selection rect from its base position while a move session
   * drags the selection — the session mirrors its dragLayer offset here so the
   * rect rides along with the ghosts. Reset to (0, 0) on drop/cancel; the
   * post-commit redraw then re-fits the rect to the new bounds.
   */
  public setSelectionRectOffset(offset: PointData): void {
    this._selectionRect?.position.set(
      this._selectionRectBase.x + offset.x,
      this._selectionRectBase.y + offset.y
    );
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

  private _ensureSelectionRect(): Graphics {
    if (!this._selectionRect) {
      const rect = new Graphics();
      rect.rect(0, 0, 1, 1);
      rect.alpha = 0.3;
      rect.fill(0x0);
      // Below the drag layer so move ghosts render above the rect.
      this.addChildAt(rect, 0);
      this._selectionRect = rect;
    }
    return this._selectionRect;
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
