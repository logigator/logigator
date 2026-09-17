import { Point, Rectangle } from 'pixi.js';
import { Project } from '../../../project/project';
import { Component, PortSide } from '../../../components/component';
import { Wire } from '../../../wires/wire';
import { CUSTOM_TYPE_ID_BASE } from '../../../components/component-type.enum';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { Action } from '../../../actions/action';
import { TogglePortNegationAction } from '../../../actions/actions/toggle-port-negation.action';
import { roundToHalfGrid } from '../../../utils/grid';
import { WireToolSession } from '../../sessions/wire-tool.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/** Tap tolerance (grid units) for hitting a port with the wire tool. */
const PORT_HIT_TOLERANCE = 0.5;

interface PortHit {
  comp: Component;
  side: PortSide;
  index: number;
}

/**
 * A selection as it stood. Held as ids: a take-back replaces the nodes it
 * undoes, so instances would be dead by the time the selection is restored.
 */
interface SelectionSnapshot {
  componentIds: number[];
  wireIds: number[];
  grabRect: Rectangle | null;
}

/** What a tap did, for a press that might have to take it back. */
interface TapOutcome {
  /** The project the tap ran on: a take-back only ever applies to this one. */
  project: Project;
  /** The click run the tap's press belonged to — see {@link _collapseDoubleClick}. */
  clickCount: number;
  /** The circuit action the tap recorded, if it changed the circuit at all. */
  action: Action | null;
  /**
   * The selection the tap ran against: every take-back restores it, since a
   * toggle can consume a selected wire and its undo adds it back unselected.
   */
  previousSelection: SelectionSnapshot;
}

/**
 * The wire tool: a drag draws wires (via {@link WireToolSession}); a press
 * that never leaves its grid step is a tap, resolved in the order the hover
 * ghost previews — a port within tolerance toggles its negation bubble,
 * otherwise the nearest half-grid point toggles the wire connection there
 * (join/split), otherwise the tap selects what is under it (the select tool's
 * plain click). Both circuit actions outrank the selection: a tap that can
 * change the circuit always does.
 *
 * Two taps in a row are one double click, not two taps: the second press takes
 * the first tap back — its action, and the selection it ran against — and
 * swallows its own tap.
 */
export class WireTool implements BoardTool {
  private _lastTap: TapOutcome | null = null;

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    // Cloned before the inline rounding below: the tap fallback needs the
    // unsnapped position for the port hit test.
    const tapPoint = input.grid.clone();
    const continued = this._collapseDoubleClick(project, input.clickCount);
    host.startSession(
      new WireToolSession(
        project,
        project.floatingLayer.dragLayer,
        roundToHalfGrid(input.grid, true),
        () => this._tap(project, tapPoint, input.clickCount, continued)
      )
    );
  }

  public hover(project: Project, input: PointerInput): void {
    // A record describes one board: the first move over another one drops it.
    if (this._lastTap && this._lastTap.project !== project) {
      this._lastTap = null;
    }
    this._updateGhosts(project, input.grid);
    project.triggerTicker('single');
  }

  public deactivate(project: Project): void {
    // The record belongs to a context this tool has left.
    this._lastTap = null;
    project.floatingLayer.hideWireToolGhosts();
    project.triggerTicker('single');
  }

  /**
   * Previews what a tap at the point would do: the negation bubble for a port
   * in reach (which wins over a junction — same precedence as
   * {@link _applyTap}), else the connection-toggle ghost, else nothing.
   */
  private _updateGhosts(project: Project, gridPoint: Point): void {
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

  private _tap(
    project: Project,
    gridPoint: Point,
    clickCount: number,
    suppressed: boolean
  ): void {
    // A suppressed tap is the second half of a double click, and the press has
    // already taken the first half back: only the preview refreshes.
    if (!suppressed) {
      this._lastTap = this._applyTap(project, gridPoint, clickCount);
    }
    // The toggle changed what the next tap here would do (split ⇄ join) — and
    // a collapse changed it back — so re-derive the preview in place instead
    // of leaving the stale ghost.
    this._updateGhosts(project, gridPoint);
  }

  /**
   * Runs the tap in its precedence order and reports what it did: port
   * negation, else the junction toggle, else the select click. The click point
   * is the unsnapped one the port hit test uses — the selection picks what the
   * pointer is really on, not what a junction snap would round it to.
   */
  private _applyTap(
    project: Project,
    gridPoint: Point,
    clickCount: number
  ): TapOutcome {
    const previousSelection = this._snapshotSelection(project);
    const hit = this._findPortAt(project, gridPoint);
    const action = hit
      ? this._togglePortNegation(project, hit)
      : project.topology.toggleConnectionAt(roundToHalfGrid(gridPoint));

    if (!action) {
      this._selectAt(project, gridPoint);
    }
    return { project, clickCount, action, previousSelection };
  }

  /** The selection as it stands, for a take-back to put back. */
  private _snapshotSelection(project: Project): SelectionSnapshot {
    const selection = project.selectionManager;
    return {
      componentIds: [...selection.selectedComponents].map((c) => c.id),
      wireIds: [...selection.selectedWires].map((w) => w.id),
      grabRect: selection.grabRect()
    };
  }

  /** Flips the port's negation bubble and records it, returning the action. */
  private _togglePortNegation(project: Project, hit: PortHit): Action {
    const action = new TogglePortNegationAction(
      hit.comp.id,
      hit.side,
      hit.index,
      !hit.comp.isPortNegated(hit.side, hit.index)
    );
    project.actionManager.push(action);
    return action;
  }

  /** Selects the smallest element under the point, or clears the selection. */
  private _selectAt(project: Project, gridPoint: Point): void {
    project.selectionManager.commit(
      new Rectangle(gridPoint.x, gridPoint.y, 0, 0),
      WorkMode.SELECT
    );
  }

  /**
   * Whether this press continues a double click, taking the previous tap back
   * as it does — its action out of the history, and the selection it ran
   * against. The count must be the previous press's plus one: presses this
   * tool never saw leave no record, so the click after one is its own gesture.
   */
  private _collapseDoubleClick(project: Project, clickCount: number): boolean {
    const last = this._lastTap;
    this._lastTap = null;
    // The count, not just its being past the first, is what pairs the presses:
    // a press the router keeps to itself (paste placement takes its own
    // presses) advances the run without leaving a record, and the click after
    // it belongs to that gesture, not to this record.
    if (
      !last ||
      last.project !== project ||
      last.clickCount !== clickCount - 1
    ) {
      return false;
    }
    if (last.action && !project.actionManager.retract(last.action)) {
      return false;
    }
    this._restoreSelection(project, last.previousSelection);
    return true;
  }

  /**
   * Puts a selection back as it stood: ids resolved against the project as it
   * stands now, grab rect included, dots re-derived against that rect.
   */
  private _restoreSelection(
    project: Project,
    snapshot: SelectionSnapshot
  ): void {
    const selection = project.selectionManager;
    selection.select(
      snapshot.componentIds
        .map((id) => project.getComponentById(id))
        .filter((c): c is Component => c !== undefined),
      snapshot.wireIds
        .map((id) => project.getWireById(id))
        .filter((w): w is Wire => w !== undefined)
    );
    selection.freezeGrabRect(snapshot.grabRect);
    selection.retintCps();
  }

  /**
   * Nearest negatable port to a grid-space point, within tolerance. Rejects
   * placed custom instances: their external ports are not independently
   * negatable.
   *
   * Two tips coincide where an output stub meets an input head-on, so reach
   * alone cannot say which port a tap means. The pick is the port whose
   * bubble anchor is nearest — the side of the tip the pointer is on, which
   * is the bubble the hover ghost draws.
   */
  private _findPortAt(project: Project, localPoint: Point): PortHit | null {
    const queryRect = new Rectangle(
      localPoint.x - PORT_HIT_TOLERANCE,
      localPoint.y - PORT_HIT_TOLERANCE,
      PORT_HIT_TOLERANCE * 2,
      PORT_HIT_TOLERANCE * 2
    );
    let best: PortHit | null = null;
    let bestAnchorDist = Infinity;
    for (const comp of project.queryComponentsInRange(queryRect)) {
      if (comp.config.type >= CUSTOM_TYPE_ID_BASE) continue;
      const points = comp.connectionPoints;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - localPoint.x;
        const dy = points[i].y - localPoint.y;
        if (dx * dx + dy * dy > PORT_HIT_TOLERANCE * PORT_HIT_TOLERANCE) {
          continue;
        }
        const side: PortSide = i < comp.numInputs ? 'in' : 'out';
        const index = side === 'in' ? i : i - comp.numInputs;
        const anchor = comp.negationBubbleAnchor(side, index);
        const ax = anchor.x - localPoint.x;
        const ay = anchor.y - localPoint.y;
        const anchorDist = ax * ax + ay * ay;
        if (anchorDist < bestAnchorDist) {
          bestAnchorDist = anchorDist;
          best = { comp, side, index };
        }
      }
    }
    return best;
  }
}
