import { Point, Rectangle } from 'pixi.js';
import { Subscription } from 'rxjs';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { Project } from '../../project/project';
import { Component, PortSide } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { roundToGrid, roundToHalfGrid } from '../../utils/grid';
import { DragSession } from '../drag-session';
import { PlacementGhost } from '../placement-ghost';
import { ComponentPlacementSession } from '../sessions/component-placement.session';
import { PastePlacementSession } from '../sessions/paste-placement.session';
import { WireToolSession } from '../sessions/wire-tool.session';
import { SelectRectSession } from '../sessions/select-rect.session';
import { SelectionMoveSession } from '../sessions/selection-move.session';
import { EraseSession } from '../sessions/erase.session';
import { PanSession } from '../sessions/pan.session';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../../utils/get-di';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import { TogglePortNegationAction } from '../../actions/actions/toggle-port-negation.action';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { PointerInput } from './pointer-input';
import { PointerToolTarget } from './pointer-controller';
import { ScissorKeyState } from './scissor-key-state';

/** Tap tolerance (grid units) for hitting a port with the wire tool. */
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
 * ticker around a drag). Also hosts the wire tool's tap actions (port
 * negation, connection toggling) and the paste flow (a `Project` emits a
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

  // Hover preview in placement mode: the component the next press would place,
  // following the cursor before any press. Torn down whenever its context
  // changes (mode/project/palette selection) or a session takes over.
  private _hoverGhost: PlacementGhost | null = null;
  private _hoverGhostConfig: ComponentConfig | null = null;

  private _pasteSub: Subscription | null = null;
  private readonly _cancelSub: Subscription;
  private readonly _customComponents = getStaticDI(CustomComponentService);
  private readonly _shortcuts = getStaticDI(ShortcutService);
  private readonly _scissorKey: ScissorKeyState = {
    isHeld: () => this._shortcuts.isHeld(ShortcutActionEnum.SELECT_SCISSOR),
    change$: this._shortcuts.heldChange$
  };

  // Bumped on every gesture end / cancel / context switch so an in-flight
  // placement circuit load (a first, uncached cloud master) can tell whether the
  // gesture that started it is still live before opening the session.
  private _placementLoadSeq = 0;

  constructor() {
    this._cancelSub = this._shortcuts
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => this.abortActiveDrag());
  }

  public destroy(): void {
    this.abortActiveDrag();
    this._destroyHoverGhost();
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
    this._destroyHoverGhost();
    if (this._mode === WorkMode.WIRE_TOOL) {
      this._project?.floatingLayer.hideWireToolGhosts();
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
    this._destroyHoverGhost();
    this._project?.selectionManager.clear();
    if (this._mode === WorkMode.WIRE_TOOL) {
      this._project?.floatingLayer.hideWireToolGhosts();
    }
    this._mode = value;
    this._project?.triggerTicker('single');
  }

  public set componentToPlace(value: ComponentConfig | null) {
    if (value !== this._hoverGhostConfig) {
      // The palette selection changed under the preview — the next hover
      // rebuilds the ghost from the new config.
      this._destroyHoverGhost();
    }
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
      case WorkMode.WIRE_TOOL: {
        // Cloned before the inline rounding below: the tap fallback needs the
        // unsnapped position for the port hit test.
        const tapPoint = input.grid.clone();
        this._startDrag(
          new WireToolSession(
            project,
            project.floatingLayer.dragLayer,
            roundToHalfGrid(input.grid, true),
            () => this._wireTap(project, tapPoint)
          )
        );
        break;
      }
      case WorkMode.SELECT:
      case WorkMode.SELECT_EXACT: {
        const localPoint = input.grid;
        // The persistent grab rect (the marquee as drawn) is the drag target
        // where one exists, so the gaps inside it are grabbable too; rect-less
        // selections (single click) fall back to element bounds.
        if (project.selectionManager.isGrabbedAt(localPoint)) {
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
              this._mode,
              this._scissorKey
            )
          );
        }
        break;
      }
      case WorkMode.ERASE: {
        this._startDrag(new EraseSession(project, input.grid));
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
    // A press that opened no session still previews like a plain hover.
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
    if (!project) return;
    if (this._mode === WorkMode.WIRE_TOOL) {
      this._updateWireToolGhosts(project, input.grid);
      project.triggerTicker('single');
    } else if (this._mode === WorkMode.COMPONENT_PLACEMENT) {
      this._updatePlacementHoverGhost(project, input.grid);
    }
  }

  /** The pointer left the canvas: hover previews stop applying. */
  public leave(): void {
    this._destroyHoverGhost();
    if (this._mode === WorkMode.WIRE_TOOL) {
      this._project?.floatingLayer.hideWireToolGhosts();
      this._project?.triggerTicker('single');
    }
  }

  /**
   * Previews what a wire-tool tap at the point would do: the negation bubble
   * for a port in reach (which wins over a junction — same precedence as
   * {@link _wireTap}), else the connection-toggle ghost, else nothing.
   */
  private _updateWireToolGhosts(project: Project, gridPoint: Point): void {
    const hit = this._findPortAt(project, gridPoint);
    if (hit) {
      project.floatingLayer.hideConnectionGhost();
      project.floatingLayer.showNegationGhost(
        hit.comp.negationBubbleAnchor(hit.side, hit.index),
        hit.side,
        hit.comp.rotation,
        hit.comp.isPortNegated(hit.side, hit.index)
      );
      return;
    }
    project.floatingLayer.hideNegationGhost();
    const p = roundToHalfGrid(gridPoint);
    const kind = project.topology.connectionToggleKindAt(p);
    if (kind) {
      project.floatingLayer.showConnectionGhost(p, kind);
    } else {
      project.floatingLayer.hideConnectionGhost();
    }
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

  /**
   * Follows the cursor with the component the next press would place —
   * the same ghost (selection look, invalid tint on collision) the placement
   * session shows once the press lands, so the handoff is seamless. Rebuilt
   * when the palette selection changes; skipped while any session is active
   * (its own ghosts own the preview then).
   */
  private _updatePlacementHoverGhost(project: Project, gridPoint: Point): void {
    const config = this._componentToPlace;
    if (this._activeDrag || !config) {
      this._destroyHoverGhost();
      return;
    }
    const snapped = roundToGrid(gridPoint, true);
    if (this._hoverGhost) {
      this._hoverGhost.moveTo(snapped);
    } else {
      // A master previews from its own config — snapshotting stays a
      // commit-time effect of the placement session.
      this._hoverGhost = new PlacementGhost(
        project,
        project.floatingLayer.dragLayer,
        config,
        snapped
      );
      this._hoverGhostConfig = config;
    }
    project.triggerTicker('single');
  }

  private _destroyHoverGhost(): void {
    if (!this._hoverGhost) return;
    this._hoverGhost.destroy();
    this._hoverGhost = null;
    this._hoverGhostConfig = null;
    this._project?.triggerTicker('single');
  }

  private _startDrag(session: DragSession): void {
    // The session's own ghosts take over the preview (for a placement session,
    // a visually identical ghost at the same spot — a seamless handoff).
    this._destroyHoverGhost();
    this._activeDrag = session;
    if (this._project) {
      // Sessions detach elements into the drag layer; a history operation
      // touching them would corrupt the quad tree, so undo/redo are inert
      // until the session ends (its commit registers before the unlock).
      this._project.actionManager.locked = true;
      this._project.triggerTicker('on');
    }
  }

  private _stopDrag(): void {
    this._activeDrag = null;
    if (this._project) {
      this._project.actionManager.locked = false;
      this._project.triggerTicker('off');
    }
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
   * The wire tool's tap action (a press that never moved a whole grid step,
   * so no wire was drawn): a port within tolerance toggles its negation
   * bubble — matching what the hover ghost previews — otherwise the nearest
   * half-grid point toggles the wire connection there (join/split; a no-op
   * when neither applies).
   */
  private _wireTap(project: Project, gridPoint: Point): void {
    const hit = this._findPortAt(project, gridPoint);
    if (hit) {
      project.actionManager.push(
        new TogglePortNegationAction(
          hit.comp.id,
          hit.side,
          hit.index,
          !hit.comp.isPortNegated(hit.side, hit.index)
        )
      );
    } else {
      project.topology.toggleConnectionAt(roundToHalfGrid(gridPoint));
    }
    // The toggle changed what the next tap here would do (split ⇄ join) —
    // re-derive the preview in place instead of leaving the stale ghost.
    this._updateWireToolGhosts(project, gridPoint);
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
