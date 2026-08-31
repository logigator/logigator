import { Subscription } from 'rxjs';
import { Point, Rectangle } from 'pixi.js';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { DragSession } from '../drag-session';
import { PastePlacementSession } from '../sessions/paste-placement.session';
import { SelectionMoveSession } from '../sessions/selection-move.session';
import { groupGridBounds } from '../sessions/rotate-elements';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { getStaticDI } from '../../utils/get-di';
import { canvasToGrid, PointerInput } from './pointer-input';
import { PointerToolTarget } from './pointer-controller';
import { BoardTool, ToolHost } from './tools/board-tool';
import { PanTool } from './tools/pan.tool';
import { PlacementTool } from './tools/placement.tool';
import { WireTool } from './tools/wire.tool';
import { SelectTool } from './tools/select.tool';
import { EraseTool } from './tools/erase.tool';
import { SimulationTool } from './tools/simulation.tool';

/**
 * The board's tool target: dispatches the primary-pointer stream from the
 * {@link PointerController} to the active mode's {@link BoardTool} and owns
 * the session lifecycle (start/commit/cancel, Escape, the undo lock and render
 * ticker around a drag). Mode behavior lives in `tools/`. Paste stays
 * router-level because it is event-initiated, not mode-initiated.
 *
 * One project at a time; `setProject` re-homes the router and cancels any
 * in-flight session on the old one.
 */
export class WorkModeRouter implements PointerToolTarget, ToolHost {
  private _project: Project | null = null;
  private _mode: WorkMode = WorkMode.PAN;
  private _activeDrag: DragSession | null = null;

  // Canvas-local position of the resting cursor; touch never sets it and
  // leaving the canvas clears it. Screen space, not grid space: pan and zoom
  // move the camera without a pointer move, so a recorded grid coordinate
  // would go stale.
  private _cursorScreen: Point | null = null;

  private _pasteSub: Subscription | null = null;
  private _rotateSub: Subscription | null = null;
  private readonly _cancelSub: Subscription;
  private readonly _selectionShortcutSubs: Subscription[];
  private readonly _shortcuts = getStaticDI(ShortcutService);

  private readonly _placementTool = new PlacementTool();
  private readonly _tools = new Map<WorkMode, BoardTool>([
    [WorkMode.PAN, new PanTool()],
    [WorkMode.COMPONENT_PLACEMENT, this._placementTool],
    [WorkMode.WIRE_TOOL, new WireTool()],
    [WorkMode.SELECT, new SelectTool(WorkMode.SELECT)],
    [WorkMode.SELECT_EXACT, new SelectTool(WorkMode.SELECT_EXACT)],
    [WorkMode.ERASE, new EraseTool()],
    [WorkMode.SIMULATION, new SimulationTool()]
  ]);

  // See ToolHost.gestureSeq: bumped on every gesture end / cancel / context
  // switch, so an async tool can tell whether its gesture is still live.
  private _gestureSeq = 0;

  constructor() {
    this._cancelSub = this._shortcuts
      .on(ShortcutActionEnum.CANCEL)
      .subscribe(() => this._onCancel());
    this._selectionShortcutSubs = [
      this._shortcuts
        .on(ShortcutActionEnum.ROTATE_SELECTION)
        .subscribe(() => this._onRotate(1)),
      this._shortcuts
        .on(ShortcutActionEnum.ROTATE_SELECTION_CCW)
        .subscribe(() => this._onRotate(3)),
      this._shortcuts
        .on(ShortcutActionEnum.MOVE_SELECTION_UP)
        .subscribe(() => this._onMoveSelection(0, -1)),
      this._shortcuts
        .on(ShortcutActionEnum.MOVE_SELECTION_DOWN)
        .subscribe(() => this._onMoveSelection(0, 1)),
      this._shortcuts
        .on(ShortcutActionEnum.MOVE_SELECTION_LEFT)
        .subscribe(() => this._onMoveSelection(-1, 0)),
      this._shortcuts
        .on(ShortcutActionEnum.MOVE_SELECTION_RIGHT)
        .subscribe(() => this._onMoveSelection(1, 0))
    ];
  }

  public destroy(): void {
    this.abortActiveDrag();
    if (this._project) this._activeTool?.deactivate?.(this._project);
    this._pasteSub?.unsubscribe();
    this._rotateSub?.unsubscribe();
    this._cancelSub.unsubscribe();
    for (const sub of this._selectionShortcutSubs) sub.unsubscribe();
  }

  public get project(): Project | null {
    return this._project;
  }

  public get mode(): WorkMode {
    return this._mode;
  }

  public get hasActiveSession(): boolean {
    return this._activeDrag !== null;
  }

  public get gestureSeq(): number {
    return this._gestureSeq;
  }

  public bumpGestureSeq(): number {
    return ++this._gestureSeq;
  }

  private get _activeTool(): BoardTool | undefined {
    return this._tools.get(this._mode);
  }

  /** Re-homes the router: cancels any in-flight session on the old project,
   *  then applies the current mode's side effects to the new one. */
  public setProject(project: Project | null): void {
    this.abortActiveDrag();
    // A destroyed outgoing project has no previews left to tear down.
    if (this._project && !this._project.destroyed) {
      this._activeTool?.deactivate?.(this._project);
    }
    this._pasteSub?.unsubscribe();
    this._pasteSub = null;
    this._rotateSub?.unsubscribe();
    this._rotateSub = null;
    this._cursorScreen = null;

    this._project = project;
    if (!project) return;
    this._pasteSub = project.pasteRequest$.subscribe(({ components, wires }) =>
      this._startPaste(components, wires)
    );
    this._rotateSub = project.rotateRequest$.subscribe((steps) =>
      this._onRotate(steps)
    );
    project.selectionManager.clear();
    project.triggerTicker('single');
  }

  public setMode(value: WorkMode): void {
    this.abortActiveDrag();
    if (this._project) this._activeTool?.deactivate?.(this._project);
    this._project?.selectionManager.clear();
    this._mode = value;
    this._project?.triggerTicker('single');
  }

  public set componentToPlace(value: ComponentConfig | null) {
    this._placementTool.setConfig(value);
  }

  /**
   * Unwinds one layer of interaction state per press: in-progress drag, then
   * live selection, then the current tool, so repeated Escape ends at the pan
   * tool. Routed through `WorkModeService` so the toolbar highlight follows;
   * simulation stays put under its editing lock.
   */
  private _onCancel(): void {
    // Abort first: also invalidates a pending placement load via gestureSeq,
    // even with no session open.
    const hadDrag = this._activeDrag !== null;
    this.abortActiveDrag();
    if (hadDrag) return;

    const selection = this._project?.selectionManager;
    if (selection && !selection.isEmpty) {
      selection.clear();
      this._project?.triggerTicker('single');
      return;
    }

    if (this._mode !== WorkMode.PAN && this._mode !== WorkMode.SIMULATION) {
      getStaticDI(WorkModeService).setMode(WorkMode.PAN);
    }
  }

  /** Cancels an in-progress drag without committing it. */
  public abortActiveDrag(): void {
    // Invalidates a not-yet-started placement load too.
    this._gestureSeq++;
    if (!this._activeDrag) return;
    this._activeDrag.onCancel();
    this._stopDrag();
  }

  public down(input: PointerInput): void {
    const project = this._project;
    if (!project) return;

    if (this._activeDrag) {
      // A session outliving its opening gesture decides what a new press
      // means; anything else ignores extra presses.
      if (this._activeDrag.onDown && !this._activeDrag.onDown(input)) {
        this.abortActiveDrag();
      }
      return;
    }

    this._activeTool?.down(project, input, this);
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
    // Invalidate any in-flight placement load: its gesture has ended.
    this._gestureSeq++;
    const session = this._activeDrag;
    if (!session) return;
    if (!session.canEnd()) {
      // An invalid release either discards the session or freezes it in place
      // for repositioning; a frozen one is told, so it drops its anchor.
      if (session.discardOnInvalidRelease) this.abortActiveDrag();
      else session.onInvalidRelease?.();
      return;
    }
    session.onEnd();
    this._stopDrag();
  }

  public cancel(): void {
    this.abortActiveDrag();
  }

  public hover(input: PointerInput): void {
    const project = this._project;
    if (!project) return;
    // A lifted finger leaves no cursor behind, so touch keeps paste on the
    // centre fallback.
    if (input.pointerType !== 'touch') {
      this._cursorScreen = input.global.clone();
    }
    this._activeTool?.hover?.(project, input, this);
  }

  /** The pointer left the canvas: hover previews stop applying. */
  public leave(): void {
    this._cursorScreen = null;
    if (!this._project) return;
    this._activeTool?.deactivate?.(this._project);
  }

  /** Opens a session for the active gesture (ToolHost contract). */
  public startSession(session: DragSession): void {
    this._startDrag(session);
  }

  /**
   * An active session with turnable content spins in place; otherwise the
   * committed selection rotates. Inert in simulation mode.
   */
  private _onRotate(steps: number): void {
    if (!this._project || this._mode === WorkMode.SIMULATION) return;
    if (this._activeDrag) {
      this._activeDrag.rotate?.(steps);
      this._commitIfFloatingAndValid();
      return;
    }
    this._startSelectionRotate(steps);
  }

  /**
   * Commits the moment a floating (not-yet-grabbed) selection edit becomes
   * collision-free, so a recovery turn/step lands like the first op did.
   * `_stopDrag` rather than a bare `onEnd`: `_startDrag` already set
   * `_activeDrag` and locked the action manager.
   */
  private _commitIfFloatingAndValid(): void {
    const session = this._activeDrag;
    if (!session?.isAwaitingGrab?.() || !session.canEnd()) return;
    session.onEnd();
    this._stopDrag();
  }

  /**
   * Rotates the committed selection around its snapped centre through the
   * selection-move session: detach, turn, integrate, one undoable container.
   * Collision-free commits synchronously; a colliding result keeps the session
   * open with the group floating until it lands somewhere valid.
   */
  private _startSelectionRotate(steps: number): void {
    const project = this._project;
    if (!project) return;
    const selection = project.selectionManager;
    if (selection.isEmpty) return;

    const session = new SelectionMoveSession(
      project,
      project.floatingLayer.dragLayer,
      selection.selectedComponents,
      selection.selectedWires,
      null
    );
    session.rotate(steps);
    if (session.canEnd()) {
      session.onEnd();
      return;
    }
    this._startDrag(session);
  }

  /**
   * An active session's floating content shifts one grid unit; otherwise the
   * committed selection moves. Inert in simulation mode.
   */
  private _onMoveSelection(dx: number, dy: number): void {
    if (!this._project || this._mode === WorkMode.SIMULATION) return;
    if (this._activeDrag) {
      this._activeDrag.moveBy?.(dx, dy);
      this._commitIfFloatingAndValid();
      return;
    }
    this._startSelectionMove(dx, dy);
  }

  /** Moves the committed selection one grid step; see
   *  {@link _startSelectionRotate} for the floating-until-valid behavior. */
  private _startSelectionMove(dx: number, dy: number): void {
    const project = this._project;
    if (!project) return;
    const selection = project.selectionManager;
    if (selection.isEmpty) return;

    const session = new SelectionMoveSession(
      project,
      project.floatingLayer.dragLayer,
      selection.selectedComponents,
      selection.selectedWires,
      null
    );
    session.moveBy(dx, dy);
    if (session.canEnd()) {
      session.onEnd();
      return;
    }
    this._startDrag(session);
  }

  private _startPaste(components: Component[], wires: Wire[]): void {
    const project = this._project;
    if (!project) return;
    this.abortActiveDrag();
    project.selectionManager.clear();
    this._positionPasteGroup(project, components, wires);
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
   * Centres a pasted group on the cursor, or on the viewport when there is
   * none — the fresh instances carry the copied coordinates, which may be off
   * screen. The shift stays whole grid units: components sit on the lattice
   * and wires on its half-step offsets, and both must keep doing so.
   */
  private _positionPasteGroup(
    project: Project,
    components: Component[],
    wires: Wire[]
  ): void {
    const bounds = groupGridBounds(components, wires);
    if (!bounds) return;
    const target = this._cursorScreen
      ? canvasToGrid(project, this._cursorScreen)
      : this._viewCentre(project);
    const dx = Math.round(target.x - (bounds.x + bounds.width / 2));
    const dy = Math.round(target.y - (bounds.y + bounds.height / 2));
    if (dx === 0 && dy === 0) return;
    for (const c of components) {
      c.position.set(c.position.x + dx, c.position.y + dy);
    }
    for (const w of wires) {
      w.position.set(w.position.x + dx, w.position.y + dy);
    }
  }

  /** Grid position the viewport is centred on. */
  private _viewCentre(project: Project): Point {
    const view = project.viewport.gridView(new Rectangle());
    return new Point(view.x + view.width / 2, view.y + view.height / 2);
  }

  private _startDrag(session: DragSession): void {
    this._activeTool?.onSessionStart?.();
    this._activeDrag = session;
    if (this._project) {
      // Sessions detach elements into the drag layer, where a history
      // operation would corrupt the quad tree, so undo/redo stay inert until
      // the session ends (its commit registers before the unlock).
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
}
