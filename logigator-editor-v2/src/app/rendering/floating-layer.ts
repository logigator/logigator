import {
  Container,
  DestroyOptions,
  FederatedPointerEvent,
  Graphics,
  Point,
  Rectangle
} from 'pixi.js';
import { Subscription } from 'rxjs';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { Component, PortSide } from '../components/component';
import { roundToGrid, roundToHalfGrid } from '../utils/grid';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { DragSession } from './drag-session';
import { ComponentPlacementSession } from './sessions/component-placement.session';
import { PastePlacementSession } from './sessions/paste-placement.session';
import { WireDrawingSession } from './sessions/wire-drawing.session';
import { SelectRectSession } from './sessions/select-rect.session';
import { SelectionMoveSession } from './sessions/selection-move.session';
import { EraseSession } from './sessions/erase.session';
import { WireConnectionSession } from './sessions/wire-connection.session';
import { PanSession } from './sessions/pan.session';
import { ConnectionPoint } from '../connection-points/connection-point';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../utils/get-di';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../components/component-type.enum';
import { TogglePortNegationAction } from '../actions/actions/toggle-port-negation.action';
import { GraphicsProviderService } from './graphics-provider.service';
import { NegationBubbleGraphics } from './graphics/negation-bubble.graphics';
import { LayoutService } from '../layout/layout.service';

/** Click tolerance (grid units) for hitting a port in PORT_NEGATION mode. */
const PORT_HIT_TOLERANCE = 0.25;
/** Widened tolerance for fat-finger taps on touch devices. */
const PORT_HIT_TOLERANCE_TOUCH = 0.5;

interface PortHit {
  comp: Component;
  side: PortSide;
  index: number;
}

export class FloatingLayer extends Container {
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >();

  private _mode: WorkMode = WorkMode.PAN;
  private _componentToPlace: ComponentConfig | null = null;
  private _activeDrag: DragSession | null = null;

  // Ghost bubble shown under the cursor while in PORT_NEGATION mode, previewing
  // the port the next click would toggle. Lazily created, hidden when no port
  // is in range.
  private _negationHoverGhost: Graphics | null = null;

  private _cancelSub?: Subscription;

  private readonly _layout = getStaticDI(LayoutService);

  constructor(private readonly project: Project) {
    super();

    this.interactiveChildren = false;
    this.eventMode = 'static';

    this.boundsArea = new Rectangle(
      -Number.MAX_VALUE / 2,
      -Number.MAX_VALUE / 2,
      Number.MAX_VALUE,
      Number.MAX_VALUE
    );
    this.hitArea = this.boundsArea;

    this.addChild(this._dragLayer);

    this.on('pointerdown', this.onPointerDown);

    this._cancelSub = getStaticDI(ShortcutService)
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => {
        if (this._activeDrag) {
          this._activeDrag.onCancel();
          this._stopDrag();
        }
      });
  }

  public updateScale(scale: number) {
    for (const child of this._dragLayer.children) {
      child.applyScale(scale);
    }
  }

  public get mode(): WorkMode {
    return this._mode;
  }

  public set mode(value: WorkMode) {
    if (this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
    this.project.selectionManager.clear();
    if (this._mode === WorkMode.PORT_NEGATION) {
      this._exitNegationMode();
    }
    this._mode = value;
    if (value === WorkMode.PORT_NEGATION) {
      this._enterNegationMode();
    }
    this.project.triggerTicker('single');
  }

  public get componentToPlace(): ComponentConfig | null {
    return this._componentToPlace;
  }

  public set componentToPlace(value: ComponentConfig | null) {
    this._componentToPlace = value;
  }

  /**
   * Cancels any in-progress single-pointer drag without committing it — each
   * session's `onCancel` reverts its in-progress effect. Called when a second
   * finger lands so the multi-touch gesture can take over without the
   * first-finger tool action registering (see plan §10).
   */
  public abortActiveDrag(): void {
    if (this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
  }

  public startPasteSession(components: Component[], wires: Wire[]): void {
    if (this._activeDrag) {
      this._activeDrag.onCancel();
      this._stopDrag();
    }
    this.project.selectionManager.clear();
    this._startDrag(
      new PastePlacementSession(
        this.project,
        this._dragLayer,
        components,
        wires
      )
    );
  }

  private onPointerDown(e: FederatedPointerEvent) {
    if (e.button !== 0) return;

    if (
      this._activeDrag instanceof PastePlacementSession &&
      !this._activeDrag.isDragging
    ) {
      const localPoint = e.getLocalPosition(this.project.gridSpace);
      if (this._activeDrag.containsPoint(localPoint)) {
        this._activeDrag.beginDrag(roundToGrid(localPoint, true));
      } else {
        this._activeDrag.onCancel();
        this._stopDrag();
      }
      return;
    }

    if (this._activeDrag) return;

    switch (this._mode) {
      case WorkMode.PAN: {
        this._startDrag(
          new PanSession(
            this.project,
            e.global.clone(),
            e.getLocalPosition(this.project.gridSpace)
          )
        );
        break;
      }
      case WorkMode.COMPONENT_PLACEMENT: {
        if (!this._componentToPlace) return;
        const startPos = roundToGrid(
          e.getLocalPosition(this.project.gridSpace),
          true
        );
        this._startDrag(
          new ComponentPlacementSession(this.project, this._dragLayer, startPos)
        );
        break;
      }
      case WorkMode.WIRE_DRAWING: {
        const startPos = roundToHalfGrid(
          e.getLocalPosition(this.project.gridSpace),
          true
        );
        this._startDrag(
          new WireDrawingSession(this.project, this._dragLayer, startPos)
        );
        break;
      }
      case WorkMode.SELECT:
      case WorkMode.SELECT_EXACT: {
        const localPoint = e.getLocalPosition(this.project.gridSpace);
        if (
          !this.project.selectionManager.isEmpty &&
          this.project.selectionManager.containsPoint(localPoint)
        ) {
          this._startDrag(
            new SelectionMoveSession(
              this.project,
              this._dragLayer,
              this.project.selectionManager.selectedComponents,
              this.project.selectionManager.selectedWires,
              roundToGrid(localPoint, true)
            )
          );
        } else {
          this._startDrag(
            new SelectRectSession(this.project, this, localPoint, this._mode)
          );
        }
        break;
      }
      case WorkMode.ERASE: {
        const startPos = e.getLocalPosition(this.project.gridSpace);
        this._startDrag(new EraseSession(this.project, startPos));
        break;
      }
      case WorkMode.WIRE_CONNECTION: {
        const startPos = roundToHalfGrid(
          e.getLocalPosition(this.project.gridSpace)
        );
        this._startDrag(new WireConnectionSession(this.project, startPos));
        break;
      }
      case WorkMode.PORT_NEGATION: {
        // A click action, not a drag session: toggle the negation of the port
        // under the cursor through the undo stack.
        const hit = this._findPortAt(
          e.getLocalPosition(this.project.gridSpace)
        );
        if (hit) {
          this.project.actionManager.push(
            new TogglePortNegationAction(
              hit.comp.id,
              hit.side,
              hit.index,
              !hit.comp.isPortNegated(hit.side, hit.index)
            )
          );
        }
        break;
      }
      case WorkMode.SIMULATION: {
        // Editing stays structurally locked, but one-finger / left-drag pans
        // the viewport like the hand tool. A tap that never crosses the pan
        // threshold instead activates a button/lever under the cursor.
        this._startDrag(
          new PanSession(
            this.project,
            e.global.clone(),
            e.getLocalPosition(this.project.gridSpace),
            (clickPoint) => this._emitUserInputAt(clickPoint)
          )
        );
        break;
      }
    }
  }

  /**
   * Activates the component whose body contains the grid-space point, if any:
   * a button/lever emits user input, an inspectable component (its config
   * declares an inspection) emits an inspect request. The simulation-mode tap
   * handler — the only canvas interaction allowed while editing is locked.
   */
  private _emitUserInputAt(localPoint: Point): void {
    const queryRect = new Rectangle(
      localPoint.x - 0.5,
      localPoint.y - 0.5,
      1,
      1
    );
    for (const comp of this.project.queryComponentsInRange(queryRect)) {
      if (!comp.bodyGridBounds.contains(localPoint.x, localPoint.y)) {
        continue;
      }
      const type = comp.config.type;
      if (
        type === BuiltInComponentType.BUTTON ||
        type === BuiltInComponentType.LEVER
      ) {
        this.project.emitUserInput(comp);
        break;
      }
      if (comp.config.inspection) {
        this.project.emitInspectRequest(comp);
        break;
      }
    }
  }

  private onPointerMove(e: FederatedPointerEvent) {
    this._activeDrag?.onMove(e);
  }

  private onPointerUp() {
    const session = this._activeDrag;
    if (!session) return;
    if (!session.canEnd()) return;
    session.onEnd();
    this._stopDrag();
  }

  private _startDrag(session: DragSession): void {
    this._activeDrag = session;
    this.on('pointerup', this.onPointerUp);
    this.on('pointerupoutside', this.onPointerUp);
    this.on('pointermove', this.onPointerMove);
    this.project.triggerTicker('on');
  }

  private _stopDrag(): void {
    this.off('pointerup', this.onPointerUp);
    this.off('pointerupoutside', this.onPointerUp);
    this.off('pointermove', this.onPointerMove);
    this._activeDrag = null;
    this.project.triggerTicker('off');
  }

  /**
   * Nearest negatable port to a grid-space point, within tolerance. Uses the
   * quad-tree range query (never iterates every component) and rejects placed
   * custom instances — their external ports are not independently negatable.
   */
  private _findPortAt(localPoint: Point): PortHit | null {
    const tolerance = this._layout.isTouch()
      ? PORT_HIT_TOLERANCE_TOUCH
      : PORT_HIT_TOLERANCE;
    const queryRect = new Rectangle(
      localPoint.x - tolerance,
      localPoint.y - tolerance,
      tolerance * 2,
      tolerance * 2
    );
    for (const comp of this.project.queryComponentsInRange(queryRect)) {
      if (comp.config.type >= CUSTOM_TYPE_ID_BASE) continue;
      const points = comp.connectionPoints;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - localPoint.x;
        const dy = points[i].y - localPoint.y;
        if (dx * dx + dy * dy <= tolerance * tolerance) {
          const side: PortSide = i < comp.numInputs ? 'in' : 'out';
          return {
            comp,
            side,
            index: side === 'in' ? i : i - comp.numInputs
          };
        }
      }
    }
    return null;
  }

  private _enterNegationMode(): void {
    this.cursor = 'pointer';
    this.on('pointermove', this._onNegationHover);
  }

  private _exitNegationMode(): void {
    this.cursor = 'default';
    this.off('pointermove', this._onNegationHover);
    if (this._negationHoverGhost) {
      this._negationHoverGhost.visible = false;
    }
  }

  private _onNegationHover(e: FederatedPointerEvent): void {
    const hit = this._findPortAt(e.getLocalPosition(this.project.gridSpace));
    if (hit) {
      const ghost = this._ensureNegationHoverGhost();
      ghost.position.copyFrom(
        hit.comp.negationBubbleAnchor(hit.side, hit.index)
      );
      ghost.visible = true;
    } else if (this._negationHoverGhost) {
      this._negationHoverGhost.visible = false;
    }
    this.project.triggerTicker('single');
  }

  private _ensureNegationHoverGhost(): Graphics {
    if (!this._negationHoverGhost) {
      const ghost = new Graphics(
        getStaticDI(GraphicsProviderService).getGraphicsContext(
          NegationBubbleGraphics,
          false
        )
      );
      ghost.alpha = 0.5;
      // Above components/wires since the floating layer is the top child of
      // gridSpace; shares its grid-unit coordinate space.
      this.addChild(ghost);
      this._negationHoverGhost = ghost;
    }
    return this._negationHoverGhost;
  }

  override destroy(options?: DestroyOptions) {
    this._cancelSub?.unsubscribe();
    super.destroy(options);
  }
}
