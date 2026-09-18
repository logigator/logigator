import { Container, Graphics, Point, PointData, Rectangle } from 'pixi.js';
import { Component, PortSide } from '../components/component';
import { Wire } from '../wires/wire';
import {
  ConnectionPoint,
  scaleForScale as cpScaleForScale
} from '../connection-points/connection-point';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from './graphics-provider.service';
import {
  NegationBubbleGraphics,
  scaleForScale
} from './graphics/negation-bubble.graphics';
import { ThemingService } from '../theming/theming.service';

/**
 * The transient overlay above the committed circuit: drag-session ghosts in
 * its `dragLayer`, plus the wire tool's hover previews. Purely visual; input
 * routing and session lifecycle live in the `WorkModeRouter`.
 */
export class FloatingLayer extends Container {
  // Its own render group: a drag moves the layer, and a render group's
  // transform reaches its contents as the group's matrix instead of being
  // pushed down the tree. Without it every ghost and every visual child of a
  // ghost is re-derived and re-batched on each frame of the drag.
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >({ isRenderGroup: true });

  // Previews the negation a tap on the hovered port would toggle: translucent
  // to add, opaque invalid-tinted over the existing bubble to remove.
  private _negationHoverGhost: Graphics | null = null;

  // Previews a toggleable wire connection: 'split' the CP dot a tap creates,
  // 'join' the existing dot tinted invalid. The drawn zoom is tracked so a
  // show after zooming while hidden redraws.
  private _connectionGhost: Graphics | null = null;
  private _connectionGhostKind: 'join' | 'split' | null = null;
  private _connectionGhostScale: number | null = null;

  // Persistent grab rect over the committed selection. Sized via scale on a
  // unit rect — fill-only, so no zoom retuning is needed.
  private _selectionRect: Graphics | null = null;
  // The rect's base position (grid units); a mid-move offset adds onto it.
  private readonly _selectionRectBase = new Point();

  // Latest zoom scale, so the negation ghost sizes itself screen-constant on
  // show; drag-session children get it fanned out in updateScale.
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
    if (this._connectionGhost?.visible && this._connectionGhostKind) {
      this._drawConnectionGhost(
        this._connectionGhost,
        this._connectionGhostKind,
        scale
      );
    }
  }

  /**
   * Shows the negation preview bubble pinned to a grid-space body-edge
   * anchor, matching the real bubble. `willRemove` covers an existing bubble
   * opaquely in the invalid color instead of previewing a new one.
   */
  public showNegationGhost(
    anchor: Point,
    side: PortSide,
    rotation: number,
    willRemove: boolean
  ): void {
    const ghost = this._ensureNegationHoverGhost();
    ghost.position.copyFrom(anchor);
    ghost.pivot.set(side === 'in' ? 0.5 : -0.5, 0);
    ghost.rotation = rotation;
    this._sizeNegationGhost(ghost, this._currentScale);
    // The context's fill is white, so the tint is the ghost's color.
    ghost.tint = willRemove
      ? getStaticDI(ThemingService).currentTheme().invalid
      : 0xffffff;
    ghost.alpha = willRemove ? 1 : 0.5;
    ghost.visible = true;
  }

  public hideNegationGhost(): void {
    if (this._negationHoverGhost) {
      this._negationHoverGhost.visible = false;
    }
  }

  /**
   * Shows the connection-toggle preview at a half-grid point: 'split' is the
   * translucent CP dot a tap would create, 'join' tints the existing dot the
   * invalid color for the removal a tap would perform.
   */
  public showConnectionGhost(p: PointData, kind: 'join' | 'split'): void {
    const ghost = this._ensureConnectionGhost();
    ghost.position.copyFrom(p);
    // updateScale only redraws a visible ghost, so a stale drawn scale from a
    // zoom during the hidden period forces a redraw too.
    if (
      this._connectionGhostKind !== kind ||
      this._connectionGhostScale !== this._currentScale
    ) {
      this._connectionGhostKind = kind;
      this._drawConnectionGhost(ghost, kind, this._currentScale);
    }
    ghost.visible = true;
  }

  public hideConnectionGhost(): void {
    if (this._connectionGhost) {
      this._connectionGhost.visible = false;
    }
  }

  /** Hides both wire-tool hover previews (negation bubble, connection dot). */
  public hideWireToolGhosts(): void {
    this.hideNegationGhost();
    this.hideConnectionGhost();
  }

  public get negationGhostVisible(): boolean {
    return this._negationHoverGhost?.visible ?? false;
  }

  public get connectionGhostVisible(): boolean {
    return this._connectionGhost?.visible ?? false;
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
   * Displaces the selection rect from its base position, mirroring a move
   * session's dragLayer offset so the rect rides with the ghosts. Reset to
   * (0, 0) on drop/cancel, where the redraw re-fits it to the new bounds.
   */
  public setSelectionRectOffset(offset: PointData): void {
    this._selectionRect?.position.set(
      this._selectionRectBase.x + offset.x,
      this._selectionRectBase.y + offset.y
    );
  }

  // Transform sets the dot size; the zoom-dependent context keeps the border
  // a fixed 1px.
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
      // Above the drag layer, so the rect stays in front of moved ghosts.
      this.addChild(rect);
      this._selectionRect = rect;
    }
    return this._selectionRect;
  }

  private _ensureNegationHoverGhost(): Graphics {
    if (!this._negationHoverGhost) {
      const ghost = new Graphics();
      // Tint/alpha are per-show. Shares gridSpace's grid-unit coordinates.
      this.addChild(ghost);
      this._negationHoverGhost = ghost;
    }
    return this._negationHoverGhost;
  }

  private _ensureConnectionGhost(): Graphics {
    if (!this._connectionGhost) {
      const ghost = new Graphics();
      this.addChild(ghost);
      this._connectionGhost = ghost;
    }
    return this._connectionGhost;
  }

  // Drawn per kind/zoom rather than from a shared context: both variants need
  // CP-curve sizing at the current zoom. Same square as a real CP dot.
  private _drawConnectionGhost(
    ghost: Graphics,
    kind: 'join' | 'split',
    scale: number
  ): void {
    const theme = getStaticDI(ThemingService).currentTheme();
    const size = cpScaleForScale(scale);
    const half = size / 2;
    ghost.clear();
    ghost.rect(-half, -half, size, size);
    ghost.fill(kind === 'split' ? theme.wire : theme.invalid);
    ghost.alpha = kind === 'split' ? 0.5 : 1;
    this._connectionGhostScale = scale;
  }
}
