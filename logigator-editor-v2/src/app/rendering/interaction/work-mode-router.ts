import { Point, Rectangle } from 'pixi.js';
import { Subscription } from 'rxjs';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { Project } from '../../project/project';
import { Component, PortSide } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { roundToGrid, roundToHalfGrid } from '../../utils/grid';
import { DragSession } from '../drag-session';
import { ComponentPlacementSession } from '../sessions/component-placement.session';
import { PastePlacementSession } from '../sessions/paste-placement.session';
import { WireDrawingSession } from '../sessions/wire-drawing.session';
import { SelectRectSession } from '../sessions/select-rect.session';
import { SelectionMoveSession } from '../sessions/selection-move.session';
import { EraseSession } from '../sessions/erase.session';
import { WireConnectionSession } from '../sessions/wire-connection.session';
import { PanSession } from '../sessions/pan.session';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../../utils/get-di';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import { TogglePortNegationAction } from '../../actions/actions/toggle-port-negation.action';
import { LayoutService } from '../../layout/layout.service';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { PointerInput } from './pointer-input';
import { PointerToolTarget } from './pointer-controller';

/** Click tolerance (grid units) for hitting a port in PORT_NEGATION mode. */
const PORT_HIT_TOLERANCE = 0.5;

interface PortHit {
  comp: Component;
  side: PortSide;
  index: number;
}

/**
 * The board's tool target: routes the primary-pointer stream from the
 * {@link PointerController} into per-mode {@link DragSession}s and owns the
 * active session's lifecycle (start/commit/cancel, Escape-cancel, the render
 * ticker around a drag). Also hosts the click-actions that never become
 * sessions (port-negation toggling) and the paste flow (a `Project` emits a
 * paste request; the router opens the placement session on it).
 *
 * The router targets one project at a time — `setProject` re-homes it when
 * the active tab changes, cancelling any in-flight session on the old one.
 * Sessions render into the project's floating layer, which stays a purely
 * visual host.
 */
export class WorkModeRouter implements PointerToolTarget {
  private _project: Project | null = null;
  private _mode: WorkMode = WorkMode.PAN;
  private _componentToPlace: ComponentConfig | null = null;
  private _activeDrag: DragSession | null = null;

  private _pasteSub: Subscription | null = null;
  private readonly _cancelSub: Subscription;
  private readonly _layout = getStaticDI(LayoutService);
  private readonly _customComponents = getStaticDI(CustomComponentService);

  // Bumped on every gesture end / cancel / context switch so an in-flight
  // placement circuit load (a first, uncached cloud master) can tell whether the
  // gesture that started it is still live before opening the session.
  private _placementLoadSeq = 0;

  constructor() {
    this._cancelSub = getStaticDI(ShortcutService)
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => this.abortActiveDrag());
  }

  public destroy(): void {
    this.abortActiveDrag();
    this._pasteSub?.unsubscribe();
    this._cancelSub.unsubscribe();
  }

  public get project(): Project | null {
    return this._project;
  }

  /** Re-homes the router: cancels any in-flight session on the old project,
   *  then applies the current mode's side effects to the new one. */
  public setProject(project: Project | null): void {
    this.abortActiveDrag();
    if (this._mode === WorkMode.PORT_NEGATION) {
      this._project?.floatingLayer.hideNegationGhost();
    }
    this._pasteSub?.unsubscribe();
    this._pasteSub = null;

    this._project = project;
    if (!project) return;
    this._pasteSub = project.pasteRequest$.subscribe(({ components, wires }) =>
      this._startPaste(components, wires)
    );
    project.selectionManager.clear();
    project.triggerTicker('single');
  }

  public get mode(): WorkMode {
    return this._mode;
  }

  public setMode(value: WorkMode): void {
    this.abortActiveDrag();
    this._project?.selectionManager.clear();
    if (this._mode === WorkMode.PORT_NEGATION) {
      this._project?.floatingLayer.hideNegationGhost();
    }
    this._mode = value;
    this._project?.triggerTicker('single');
  }

  public set componentToPlace(value: ComponentConfig | null) {
    this._componentToPlace = value;
  }

  /**
   * Cancels an in-progress drag without committing it — each session's
   * `onCancel` reverts its in-progress effect. Fired by Escape, by a second
   * finger landing (the multi-touch gesture takes over), and on project/mode
   * switches.
   */
  public abortActiveDrag(): void {
    // Cancel any not-yet-started placement load too — Escape / mode / project
    // switches must invalidate a gesture whose session has not opened yet.
    this._placementLoadSeq++;
    if (!this._activeDrag) return;
    this._activeDrag.onCancel();
    this._stopDrag();
  }

  public down(input: PointerInput): void {
    const project = this._project;
    if (!project) return;

    if (
      this._activeDrag instanceof PastePlacementSession &&
      !this._activeDrag.isDragging
    ) {
      if (this._activeDrag.containsPoint(input.grid)) {
        this._activeDrag.beginDrag(roundToGrid(input.grid, true));
      } else {
        this.abortActiveDrag();
      }
      return;
    }

    if (this._activeDrag) return;

    switch (this._mode) {
      case WorkMode.PAN: {
        this._startDrag(new PanSession(project, input.global, input.grid));
        break;
      }
      case WorkMode.COMPONENT_PLACEMENT: {
        if (!this._componentToPlace) return;
        void this._beginComponentPlacement(
          project,
          this._componentToPlace,
          roundToGrid(input.grid, true)
        );
        break;
      }
      case WorkMode.WIRE_DRAWING: {
        this._startDrag(
          new WireDrawingSession(
            project,
            project.floatingLayer.dragLayer,
            roundToHalfGrid(input.grid, true)
          )
        );
        break;
      }
      case WorkMode.SELECT:
      case WorkMode.SELECT_EXACT: {
        const localPoint = input.grid;
        if (
          !project.selectionManager.isEmpty &&
          project.selectionManager.containsPoint(localPoint)
        ) {
          this._startDrag(
            new SelectionMoveSession(
              project,
              project.floatingLayer.dragLayer,
              project.selectionManager.selectedComponents,
              project.selectionManager.selectedWires,
              roundToGrid(localPoint, true)
            )
          );
        } else {
          this._startDrag(
            new SelectRectSession(
              project,
              project.floatingLayer,
              localPoint,
              this._mode
            )
          );
        }
        break;
      }
      case WorkMode.ERASE: {
        this._startDrag(new EraseSession(project, input.grid));
        break;
      }
      case WorkMode.WIRE_CONNECTION: {
        this._startDrag(
          new WireConnectionSession(project, roundToHalfGrid(input.grid))
        );
        break;
      }
      case WorkMode.PORT_NEGATION: {
        // A click action, not a drag session: toggle the negation of the port
        // under the cursor through the undo stack.
        const hit = this._findPortAt(project, input.grid);
        if (hit) {
          project.actionManager.push(
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
        // threshold instead activates a button/switch under the cursor.
        this._startDrag(
          new PanSession(project, input.global, input.grid, (clickPoint) =>
            this._emitUserInputAt(project, clickPoint)
          )
        );
        break;
      }
    }
  }

  public move(input: PointerInput): void {
    if (this._activeDrag) {
      this._activeDrag.onMove(input);
      return;
    }
    // A press that opened no session (negation mode) still previews like a
    // plain hover.
    this.hover(input);
  }

  public up(): void {
    // The pointer is released: invalidate any placement load still in flight so
    // its session never opens for a gesture that has already ended.
    this._placementLoadSeq++;
    const session = this._activeDrag;
    if (!session) return;
    if (!session.canEnd()) return;
    session.onEnd();
    this._stopDrag();
  }

  public cancel(): void {
    this.abortActiveDrag();
  }

  public hover(input: PointerInput): void {
    const project = this._project;
    if (!project || this._mode !== WorkMode.PORT_NEGATION) return;
    const hit = this._findPortAt(project, input.grid);
    if (hit) {
      project.floatingLayer.showNegationGhost(
        hit.comp.negationBubbleAnchor(hit.side, hit.index),
        hit.side,
        hit.comp.rotation
      );
    } else {
      project.floatingLayer.hideNegationGhost();
    }
    project.triggerTicker('single');
  }

  /**
   * Opens a component-placement session, ensuring a cloud custom master's
   * circuit is loaded first — the load is deferred to place-time, not
   * palette-select. The ensure is a microtask no-op for built-ins, browser
   * masters, and already-loaded masters, so the session opens before any
   * pointer-up; only a first, uncached cloud master actually awaits a request.
   * If the gesture ends or the context changes during that await, the
   * `_placementLoadSeq` guard (bumped by {@link up}/{@link abortActiveDrag})
   * keeps the stale load from opening a session with no pointer to drive it.
   */
  private async _beginComponentPlacement(
    project: Project,
    config: ComponentConfig,
    startGrid: Point
  ): Promise<void> {
    const seq = ++this._placementLoadSeq;
    const ready = await this._customComponents.ensureMasterCircuit(config.type);
    if (
      !ready ||
      seq !== this._placementLoadSeq ||
      this._activeDrag ||
      this._project !== project ||
      this._mode !== WorkMode.COMPONENT_PLACEMENT
    ) {
      return;
    }
    this._startDrag(
      new ComponentPlacementSession(
        project,
        project.floatingLayer.dragLayer,
        startGrid,
        config
      )
    );
  }

  private _startPaste(components: Component[], wires: Wire[]): void {
    const project = this._project;
    if (!project) return;
    this.abortActiveDrag();
    project.selectionManager.clear();
    this._startDrag(
      new PastePlacementSession(
        project,
        project.floatingLayer.dragLayer,
        components,
        wires
      )
    );
  }

  private _startDrag(session: DragSession): void {
    this._activeDrag = session;
    this._project?.triggerTicker('on');
  }

  private _stopDrag(): void {
    this._activeDrag = null;
    this._project?.triggerTicker('off');
  }

  /**
   * Activates the component whose body contains the grid-space point, if any:
   * a button/switch emits user input, an inspectable component (its config
   * declares an inspection) emits an inspect request. The simulation-mode tap
   * handler — the only canvas interaction allowed while editing is locked.
   */
  private _emitUserInputAt(project: Project, localPoint: Point): void {
    const queryRect = new Rectangle(
      localPoint.x - 0.5,
      localPoint.y - 0.5,
      1,
      1
    );
    for (const comp of project.queryComponentsInRange(queryRect)) {
      if (!comp.bodyGridBounds.contains(localPoint.x, localPoint.y)) {
        continue;
      }
      const type = comp.config.type;
      if (
        type === BuiltInComponentType.BUTTON ||
        type === BuiltInComponentType.SWITCH
      ) {
        project.emitUserInput(comp);
        break;
      }
      if (comp.config.inspection) {
        project.emitInspectRequest(comp);
        break;
      }
    }
  }

  /**
   * Nearest negatable port to a grid-space point, within tolerance. Uses the
   * quad-tree range query (never iterates every component) and rejects placed
   * custom instances — their external ports are not independently negatable.
   */
  private _findPortAt(project: Project, localPoint: Point): PortHit | null {
    const queryRect = new Rectangle(
      localPoint.x - PORT_HIT_TOLERANCE,
      localPoint.y - PORT_HIT_TOLERANCE,
      PORT_HIT_TOLERANCE * 2,
      PORT_HIT_TOLERANCE * 2
    );
    for (const comp of project.queryComponentsInRange(queryRect)) {
      if (comp.config.type >= CUSTOM_TYPE_ID_BASE) continue;
      const points = comp.connectionPoints;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - localPoint.x;
        const dy = points[i].y - localPoint.y;
        if (dx * dx + dy * dy <= PORT_HIT_TOLERANCE * PORT_HIT_TOLERANCE) {
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
}
