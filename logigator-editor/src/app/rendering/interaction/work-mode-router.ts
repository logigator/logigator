import { Subscription } from 'rxjs';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { DragSession } from '../drag-session';
import { PastePlacementSession } from '../sessions/paste-placement.session';
import { SelectionMoveSession } from '../sessions/selection-move.session';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { getStaticDI } from '../../utils/get-di';
import { PointerInput } from './pointer-input';
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
 * the session lifecycle the tools open into (start/commit/cancel,
 * Escape-cancel, the undo lock and render ticker around a drag). Mode
 * behavior itself — what a press opens, what a hover previews — lives in the
 * tools under `tools/`. The paste flow stays router-level: it is
 * event-initiated (a `Project` emits a paste request), not mode-initiated.
 *
 * The router targets one project at a time — `setProject` re-homes it when
 * the active tab changes, cancelling any in-flight session on the old one.
 * Sessions render into the project's floating layer, which stays a purely
 * visual host.
 */
export class WorkModeRouter implements PointerToolTarget, ToolHost {
  private _project: Project | null = null;
  private _mode: WorkMode = WorkMode.PAN;
  private _activeDrag: DragSession | null = null;

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
  // switch so an async tool (the placement circuit load) can tell whether the
  // gesture that started it is still live before opening its session.
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
    // The outgoing project is destroyed whenever a tab closed or a document
    // loaded — there are no previews left on it to tear down.
    if (this._project && !this._project.destroyed) {
      this._activeTool?.deactivate?.(this._project);
    }
    this._pasteSub?.unsubscribe();
    this._pasteSub = null;
    this._rotateSub?.unsubscribe();
    this._rotateSub = null;

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
   * The cancel shortcut (Escape) unwinds one layer of interaction state per
   * press: an in-progress drag first, then a live selection, then the current
   * tool — so a repeated Escape always ends up back at the pan tool from any
   * mode. The pan escalation routes through `WorkModeService` so the toolbar
   * highlight follows; simulation stays put (its editing lock forbids the swap).
   */
  private _onCancel(): void {
    // Always abort first: cancels any live session and invalidates a pending
    // placement load (the gestureSeq bump), even with no session open yet.
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

  /**
   * Cancels an in-progress drag without committing it — each session's
   * `onCancel` reverts its in-progress effect. Fired by Escape, by a second
   * finger landing (the multi-touch gesture takes over), and on project/mode
   * switches.
   */
  public abortActiveDrag(): void {
    // Invalidate any not-yet-started placement load too — Escape / mode /
    // project switches must cancel a gesture whose session has not opened yet.
    this._gestureSeq++;
    if (!this._activeDrag) return;
    this._activeDrag.onCancel();
    this._stopDrag();
  }

  public down(input: PointerInput): void {
    const project = this._project;
    if (!project) return;

    if (this._activeDrag) {
      // A session that outlives its opening gesture (paste placement) decides
      // what a new press means; anything else ignores extra presses.
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
    // The pointer is released: invalidate any placement load still in flight
    // so its session never opens for a gesture that has already ended.
    this._gestureSeq++;
    const session = this._activeDrag;
    if (!session) return;
    if (!session.canEnd()) {
      // An invalid release either discards the session (placement) or leaves
      // it frozen in place (move / paste) for the user to reposition — a
      // frozen session is told, so it can let go of the ended gesture's anchor.
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
    this._activeTool?.hover?.(project, input, this);
  }

  /** The pointer left the canvas: hover previews stop applying. */
  public leave(): void {
    if (!this._project) return;
    this._activeTool?.deactivate?.(this._project);
  }

  /** Opens a session for the active gesture (ToolHost contract). */
  public startSession(session: DragSession): void {
    this._startDrag(session);
  }

  /**
   * Routes a rotate request (shortcut or toolbar/selection-bar button): an
   * active session with turnable content spins in place; otherwise the
   * committed selection rotates (see _startSelectionRotate). Inert in
   * simulation mode — the editing lock applies.
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
   * After a discrete rotate/move on an already-open session: commit the moment
   * a floating (not-yet-grabbed) selection edit becomes collision-free, so a
   * recovery turn/step lands like the first op does instead of leaving a valid
   * group floating until it is reverted by a click-off. `_stopDrag` (not a bare
   * `onEnd`) is required here — unlike the first-op path, `_startDrag` already
   * set `_activeDrag` and locked the action manager.
   */
  private _commitIfFloatingAndValid(): void {
    const session = this._activeDrag;
    if (!session?.isAwaitingGrab?.() || !session.canEnd()) return;
    session.onEnd();
    this._stopDrag();
  }

  /**
   * Rotates the committed selection around its snapped centre through the
   * selection-move session machinery: detach, turn, integrate, one undoable
   * container (coalescing a live scissor cut). A collision-free result
   * commits synchronously — the user sees an in-place rotate. A colliding one
   * keeps the session open: the red-tinted group floats (still selected)
   * until it is dragged or turned somewhere valid; Escape or a press off the
   * selection reverts the rotation.
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
   * Routes a move request (arrow keys): an active session's floating content
   * shifts one grid unit in place; otherwise the committed selection moves
   * (see _startSelectionMove). Inert in simulation mode — the editing lock
   * applies.
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

  /**
   * Moves the committed selection one grid step through the selection-move
   * session machinery: detach, shift, integrate, one undoable container
   * (coalescing a live scissor cut). A collision-free result commits
   * synchronously — the user sees an in-place move. A colliding one keeps the
   * session open exactly like a colliding rotate: the red-tinted group floats
   * (still selected) until further arrow presses or a drag land it somewhere
   * valid; Escape or a press off the selection reverts the move.
   */
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
    // The session's ghosts own the canvas preview now.
    this._activeTool?.onSessionStart?.();
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
}
