import { Rectangle } from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { cutWire } from '../wires/wire-cut';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { ActionContainer } from '../actions/action-container';
import { SerializedWire } from '../wires/serialized-wire.model';
import { ConnectionPoint } from '../connection-points/connection-point';
import type { Project } from './project';

interface PendingCut {
  // Originals as they existed pre-cut. Used to restore on rollback and to
  // build the RemoveWiresAction inside the claimed ActionContainer.
  originalsSerialized: SerializedWire[];
  // IDs of the new pieces that the scissor created and added to the project.
  // Used by rollback to find and remove them via project.removeWire(id).
  newPieceIds: number[];
  // Snapshot of the new pieces at the post-cut position. Used by claim to
  // build the AddWiresAction so undo of the combined cut+move action restores
  // the pieces at their post-cut positions before the move undo runs.
  newPiecesSerialized: SerializedWire[];
}

export class SelectionManager {
  static readonly SELECTION_TINT = 0x888888;

  private readonly _selectedComponents = new Set<Component>();
  private readonly _selectedWires = new Set<Wire>();
  private readonly _selectionChange$ = new Subject<void>();
  private _pendingCut: PendingCut | null = null;
  private _tintedConnectionPoints: ConnectionPoint[] = [];

  constructor(private readonly project: Project) {}

  public commit(rect: Rectangle, mode: WorkMode): void {
    if (rect.width === 0 && rect.height === 0) {
      this._commitSingleClick(rect.x, rect.y);
    } else {
      this._commitRect(rect, mode);
    }
  }

  private _commitRect(rect: Rectangle, mode: WorkMode): void {
    this.clear();

    for (const component of this.project.queryComponentsInRange(rect)) {
      component.tint = SelectionManager.SELECTION_TINT;
      this._selectedComponents.add(component);
    }

    if (mode === WorkMode.SELECT_EXACT) {
      this._scissorAndSelectWires(rect);
    } else {
      for (const wire of this.project.queryWiresInRange(rect)) {
        wire.tint = SelectionManager.SELECTION_TINT;
        this._selectedWires.add(wire);
      }
    }

    this.retintCps();
    this._selectionChange$.next();
  }

  private _scissorAndSelectWires(rect: Rectangle): void {
    // Snapshot before mutating: queryWiresInRange returns a single-use generator
    // and the quad-tree is updated synchronously by the addWire/removeWire calls.
    const candidates = Array.from(this.project.queryWiresInRange(rect));

    const wiresToKeep: Wire[] = [];
    const wiresToCut: Wire[] = [];
    const newPieces: Wire[] = [];
    const insideIds = new Set<number>();

    for (const wire of candidates) {
      const result = cutWire(wire, rect);
      if (result.kind === 'skip') continue;
      if (result.kind === 'keep') {
        wiresToKeep.push(wire);
        continue;
      }
      wiresToCut.push(wire);
      result.pieces.forEach((p, idx) => {
        const newWire = new Wire(p.direction, p.length);
        newWire.position.set(p.position.x, p.position.y);
        newPieces.push(newWire);
        if (idx === result.insideIndex) {
          insideIds.add(newWire.id);
        }
      });
    }

    if (wiresToCut.length > 0) {
      // Tentative cut: mutate the project directly so the inside piece is a
      // real selectable Wire, but DO NOT push to ActionManager. The cut becomes
      // a real action only when the selection is committed via a real
      // modification (currently: SelectionMoveSession.onEnd with hasMove).
      // Cancelling the selection (clear, mode change, Escape, undo) calls
      // _rollbackPendingCut which restores the originals.
      const originalsSerialized = wiresToCut.map((w) => Wire.serialize(w));
      const newPiecesSerialized = newPieces.map((w) => Wire.serialize(w));

      // Match the action-container order (remove originals, then add pieces)
      // so the CP manager and quad tree see the same transitions as undo/redo.
      for (const wire of wiresToCut) {
        this.project.removeWire(wire.id);
      }
      for (const piece of newPieces) {
        this.project.addWire(piece);
      }

      this._pendingCut = {
        originalsSerialized,
        newPieceIds: newPieces.map((p) => p.id),
        newPiecesSerialized
      };
    }

    for (const wire of wiresToKeep) {
      if (wire.destroyed) continue;
      wire.tint = SelectionManager.SELECTION_TINT;
      this._selectedWires.add(wire);
    }

    // Inside pieces are live in the project now; select them directly by ID.
    // No re-query is needed because we added them synchronously above.
    if (insideIds.size > 0) {
      for (const piece of newPieces) {
        if (!piece.destroyed && insideIds.has(piece.id)) {
          piece.tint = SelectionManager.SELECTION_TINT;
          this._selectedWires.add(piece);
        }
      }
    }
  }

  // A zero-area rect fails PixiJS Rectangle.intersects(), so we build a 1×1
  // query rect and post-filter with gridBounds.contains().
  private _commitSingleClick(px: number, py: number): void {
    this.clear();

    const queryRect = new Rectangle(px - 0.5, py - 0.5, 1, 1);

    let bestComponent: Component | null = null;
    let bestComponentArea = Infinity;

    for (const component of this.project.queryComponentsInRange(queryRect)) {
      const bounds = component.gridBounds;
      if (!component.destroyed && bounds.contains(px, py)) {
        const area = bounds.width * bounds.height;
        if (area < bestComponentArea) {
          bestComponentArea = area;
          bestComponent = component;
        }
      }
    }

    let bestWire: Wire | null = null;
    let bestWireArea = Infinity;

    for (const wire of this.project.queryWiresInRange(queryRect)) {
      const bounds = wire.gridBounds;
      if (!wire.destroyed && bounds.contains(px, py)) {
        const area = bounds.width * bounds.height;
        if (area < bestWireArea) {
          bestWireArea = area;
          bestWire = wire;
        }
      }
    }

    // Tie-break: smaller bounding-box area = more precisely-aimed target.
    if (
      bestComponent !== null &&
      (bestWire === null || bestComponentArea <= bestWireArea)
    ) {
      bestComponent.tint = SelectionManager.SELECTION_TINT;
      this._selectedComponents.add(bestComponent);
    } else if (bestWire !== null) {
      bestWire.tint = SelectionManager.SELECTION_TINT;
      this._selectedWires.add(bestWire);
    }

    this.retintCps();
    this._selectionChange$.next();
  }

  // Re-evaluates which connection points should be tinted based on the current
  // selection. Called after initial selection and after a drag-move recomputes CPs.
  public retintCps(): void {
    for (const cp of this._tintedConnectionPoints) {
      if (!cp.destroyed) cp.tint = 0xffffff;
    }

    const points = [];
    for (const wire of this._selectedWires) {
      if (!wire.destroyed) {
        const [start, end] = wire.connectionPoints;
        points.push(start, end);
      }
    }
    for (const comp of this._selectedComponents) {
      if (!comp.destroyed) {
        for (const port of comp.connectionPoints) {
          points.push(port);
        }
      }
    }

    this._tintedConnectionPoints =
      this.project.connectionPoints.getCpsAtPoints(points);
    for (const cp of this._tintedConnectionPoints) {
      cp.tint = SelectionManager.SELECTION_TINT;
    }
  }

  public clear(): void {
    // Roll back any tentative scissor cut first so cancelled selections leave
    // the project in its pre-cut state. The rollback mutates the project
    // directly and bypasses ActionManager — see _scissorAndSelectWires.
    this._rollbackPendingCutInternal();

    for (const component of this._selectedComponents) {
      if (!component.destroyed) {
        component.tint = 0xffffff;
      }
    }
    for (const wire of this._selectedWires) {
      if (!wire.destroyed) {
        wire.tint = 0xffffff;
      }
    }
    for (const cp of this._tintedConnectionPoints) {
      if (!cp.destroyed) cp.tint = 0xffffff;
    }
    this._tintedConnectionPoints = [];
    this._selectedComponents.clear();
    this._selectedWires.clear();
    this._selectionChange$.next();
  }

  // Builds the ActionContainer for a tentative cut so the caller can fold it
  // into a larger committed action (currently: SelectionMoveSession's move
  // container). Clears _pendingCut without rolling back — the caller is now
  // responsible for the cut. Returns null when nothing is pending.
  public claimPendingCut(): ActionContainer | null {
    if (!this._pendingCut) return null;
    const cut = this._pendingCut;
    this._pendingCut = null;
    return new ActionContainer(
      new RemoveWiresAction(...cut.originalsSerialized),
      new AddWiresAction(...cut.newPiecesSerialized)
    );
  }

  // Called by ActionManager.undo so Ctrl+Z while a tentative cut is active
  // reverts the cut instead of consuming the real undo stack. Returns true
  // when something was rolled back.
  //
  // TODO: this is not safe during an in-flight SelectionMoveSession — the
  // inside pieces are detached from the quad tree (held by dragLayer), so
  // project.removeWire(id) below silently skips them while the originals are
  // still re-added. Result is a duplicate-ID tree. Undo during drag is a
  // pre-existing gap (the move actions aren't tracked either); fix both
  // together when adding a drag-aware undo guard.
  public rollbackPendingCut(): boolean {
    if (!this._pendingCut) return false;
    this._rollbackPendingCutInternal();
    this._selectionChange$.next();
    return true;
  }

  public get hasPendingCut(): boolean {
    return this._pendingCut !== null;
  }

  private _rollbackPendingCutInternal(): void {
    if (!this._pendingCut) return;
    const cut = this._pendingCut;
    this._pendingCut = null;

    // Remove the cut pieces (project.removeWire calls evict, which drops them
    // from _selectedWires automatically).
    for (const id of cut.newPieceIds) {
      this.project.removeWire(id);
    }
    // Re-add the originals at their pre-cut positions.
    for (const serial of cut.originalsSerialized) {
      this.project.addWire(Wire.deserialize(serial));
    }
  }

  // Called from Project.removeComponent/removeWire before destroy() to prevent
  // the set from holding a dead Container reference.
  public evict(element: Component | Wire): void {
    let changed: boolean;
    if (element instanceof Component) {
      changed = this._selectedComponents.delete(element);
    } else {
      changed = this._selectedWires.delete(element);
    }
    if (changed) {
      this._selectionChange$.next();
    }
  }

  public containsPoint(gridPoint: { x: number; y: number }): boolean {
    for (const component of this._selectedComponents) {
      if (
        !component.destroyed &&
        component.gridBounds.contains(gridPoint.x, gridPoint.y)
      ) {
        return true;
      }
    }
    for (const wire of this._selectedWires) {
      if (
        !wire.destroyed &&
        wire.gridBounds.contains(gridPoint.x, gridPoint.y)
      ) {
        return true;
      }
    }
    return false;
  }

  public boundingBox(): Rectangle | null {
    if (this.isEmpty) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const component of this._selectedComponents) {
      if (component.destroyed) continue;
      const b = component.gridBounds;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.right > maxX) maxX = b.right;
      if (b.bottom > maxY) maxY = b.bottom;
    }

    for (const wire of this._selectedWires) {
      if (wire.destroyed) continue;
      const b = wire.gridBounds;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.right > maxX) maxX = b.right;
      if (b.bottom > maxY) maxY = b.bottom;
    }

    if (minX === Infinity) return null;
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  public get isEmpty(): boolean {
    return (
      this._selectedComponents.size === 0 && this._selectedWires.size === 0
    );
  }

  public get selectionChange$(): Observable<void> {
    return this._selectionChange$.asObservable();
  }

  public get selectedComponents(): ReadonlySet<Component> {
    return this._selectedComponents;
  }

  public get selectedWires(): ReadonlySet<Wire> {
    return this._selectedWires;
  }
}
