import { Point, Rectangle } from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { cutWire } from '../wires/wire-cut';
import { Action } from '../actions/action';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { ActionContainer } from '../actions/action-container';
import { ConnectionPoint } from '../connection-points/connection-point';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import type { Project } from './project';

export class SelectionManager {
  /**
   * Margin (grid units) around the content bounds for grab rects that have no
   * user-drawn shape (programmatic {@link select}, e.g. a committed paste).
   */
  static readonly GRAB_MARGIN = 1;

  private readonly _selectedComponents = new Set<Component>();
  private readonly _selectedWires = new Set<Wire>();
  private readonly _selectionChange$ = new Subject<void>();
  // The scissor cut this selection registered in the undo history, if any.
  // Live only while it is still the newest history entry (see hasLiveCut);
  // consumed by the move/delete that commits it, retracted by clear().
  private _cutAction: Action | null = null;
  private _selectedConnectionPoints: ConnectionPoint[] = [];
  // The grab rect as set (the drawn marquee, or padded bounds for select())
  // plus the selection's bounding-box origin at that moment. grabRect()
  // translates the stored rect by however far the bounds have moved since, so
  // the rect follows a committed move (and its undo/redo) without resizing.
  private _grabRect: Rectangle | null = null;
  private _grabAnchor: Point | null = null;

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
      component.selected = true;
      this._selectedComponents.add(component);
    }

    if (mode === WorkMode.SELECT_EXACT) {
      this._scissorAndSelectWires(rect);
    } else {
      for (const wire of this.project.queryWiresInRange(rect)) {
        wire.selected = true;
        this._selectedWires.add(wire);
      }
    }

    // The marquee persists exactly as drawn — the user shaped it, so it never
    // re-fits to the content it caught.
    this._setGrabRect(rect.clone());
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
      // The cut is a real history entry from the start: registered against
      // the directly-materialized state so the inside piece is a live
      // selectable Wire, undoable with one Ctrl+Z. A move/delete commit
      // coalesces it into its own action (one undo step); cancelling the
      // selection retracts it (see clear()), so an uncommitted cut leaves no
      // trace. The action constructors snapshot the wires, so they are built
      // before the mutations — originals at pre-cut geometry.
      const cut = new ActionContainer(
        new RemoveWiresAction(...wiresToCut.map((w) => Wire.serialize(w))),
        new AddWiresAction(...newPieces.map((w) => Wire.serialize(w)))
      );

      // Match the action order (remove originals, then add pieces) so the CP
      // manager and quad tree see the same transitions as undo/redo.
      for (const wire of wiresToCut) {
        this.project.removeWire(wire.id);
      }
      for (const piece of newPieces) {
        this.project.addWire(piece);
      }

      this.project.actionManager.register(cut);
      this._cutAction = cut;
      getStaticDI(LoggingService).debug(
        `registered scissor cut: ${wiresToCut.length} wire(s) cut into ${newPieces.length} piece(s)`,
        'SelectionManager'
      );
    }

    for (const wire of wiresToKeep) {
      if (wire.destroyed) continue;
      wire.selected = true;
      this._selectedWires.add(wire);
    }

    // Inside pieces are live in the project now; select them directly by ID.
    // No re-query is needed because we added them synchronously above.
    if (insideIds.size > 0) {
      for (const piece of newPieces) {
        if (!piece.destroyed && insideIds.has(piece.id)) {
          piece.selected = true;
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
      bestComponent.selected = true;
      this._selectedComponents.add(bestComponent);
    } else if (bestWire !== null) {
      bestWire.selected = true;
      this._selectedWires.add(bestWire);
    }

    // A click draws nothing, so a single-click selection gets no persistent
    // rect; grabbing falls back to the element's own bounds (see isGrabbedAt).
    this._setGrabRect(null);
    this.retintCps();
    this._selectionChange$.next();
  }

  // Re-evaluates which connection points count as selected. A CP is highlighted
  // only when the selection rectangle touches the grid-unit cell the CP sits in
  // — selecting a wire does not drag its endpoint junctions (which may connect
  // to unselected wires) into the highlight. Enumerating candidates from the
  // selected elements' termination points is equivalent to a pure "CP cell in
  // rect" test (any CP whose cell the rect touches has its terminating elements
  // selected) and avoids needing a CP spatial index. A rect-less selection
  // (single click) highlights no CPs.
  public retintCps(): void {
    for (const cp of this._selectedConnectionPoints) {
      if (!cp.destroyed) cp.selected = false;
    }
    this._selectedConnectionPoints = [];

    const rect = this.grabRect();
    if (!rect) return;

    const points = [];
    for (const wire of this._selectedWires) {
      if (!wire.destroyed) {
        const [start, end] = wire.connectionPoints;
        if (this._rectTouchesCell(rect, start)) points.push(start);
        if (this._rectTouchesCell(rect, end)) points.push(end);
      }
    }
    for (const comp of this._selectedComponents) {
      if (!comp.destroyed) {
        for (const port of comp.connectionPoints) {
          if (this._rectTouchesCell(rect, port)) points.push(port);
        }
      }
    }

    // Several selected elements can terminate at the same junction, so the
    // point list carries duplicates — collapse to one entry per dot.
    this._selectedConnectionPoints = [
      ...new Set(this.project.connectionPoints.getCpsAtPoints(points))
    ];
    for (const cp of this._selectedConnectionPoints) {
      cp.selected = true;
    }
  }

  // Whether the selection rect overlaps the 1×1 grid cell a connection point
  // sits in. CPs sit at half-grid centres, so the cell is the integer square
  // floor(p)..floor(p)+1. Inclusive on every edge so a rect merely grazing the
  // cell still counts as touching it.
  private _rectTouchesCell(rect: Rectangle, p: Point): boolean {
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    return (
      rect.x <= cx + 1 &&
      rect.right >= cx &&
      rect.y <= cy + 1 &&
      rect.bottom >= cy
    );
  }

  /**
   * Neutralizes the selection highlight on every selected element (and its
   * selected connection points) so an off-screen render — minimap, image
   * export, server preview — doesn't bake it into committed content. Lives
   * here because `_selectedConnectionPoints` is private. Returns a closure
   * that restores the flags; each re-derives the tint from whatever theme is
   * active then (the dual-theme preview flow switches themes between renders).
   * Destroyed nodes are skipped on both passes.
   */
  public suppressTintForRender(): () => void {
    const suppressed: (Component | Wire | ConnectionPoint)[] = [];
    const suppress = (node: Component | Wire | ConnectionPoint): void => {
      if (node.destroyed) return;
      suppressed.push(node);
      node.selected = false;
    };

    for (const component of this._selectedComponents) suppress(component);
    for (const wire of this._selectedWires) suppress(wire);
    for (const cp of this._selectedConnectionPoints) suppress(cp);

    return () => {
      for (const node of suppressed) {
        if (!node.destroyed) node.selected = true;
      }
    };
  }

  public clear(): void {
    // Retract any uncommitted scissor cut first so cancelled selections leave
    // the project in its pre-cut state and the history without the entry.
    this._retractLiveCut();

    for (const component of this._selectedComponents) {
      if (!component.destroyed) {
        component.selected = false;
      }
    }
    for (const wire of this._selectedWires) {
      if (!wire.destroyed) {
        wire.selected = false;
      }
    }
    for (const cp of this._selectedConnectionPoints) {
      if (!cp.destroyed) cp.selected = false;
    }
    this._selectedConnectionPoints = [];
    this._selectedComponents.clear();
    this._selectedWires.clear();
    this._setGrabRect(null);
    this._selectionChange$.next();
  }

  /**
   * Whether this selection's scissor cut is still committable: it exists and
   * is the newest history entry. Lazily validated against the history — an
   * undo that popped the cut, or (in principle) anything recorded on top,
   * silently ends its live phase.
   */
  public get hasLiveCut(): boolean {
    return (
      this._cutAction !== null &&
      this.project.actionManager.topDone === this._cutAction
    );
  }

  /**
   * Hands the live cut over to the move/delete that commits it — the caller
   * coalesces it with its own action into one undo step (see
   * ActionManager.coalesceTop). Null when no cut is live; a stale reference
   * is dropped either way.
   */
  public consumeLiveCut(): Action | null {
    const cut = this.hasLiveCut ? this._cutAction : null;
    this._cutAction = null;
    return cut;
  }

  // Takes an uncommitted cut back out of the history (reverting it) so a
  // cancelled scissor selection leaves no trace. A stale (non-live) cut stays
  // where the history has it — undo/redo own it now.
  private _retractLiveCut(): void {
    const cut = this._cutAction;
    this._cutAction = null;
    if (!cut) return;
    // Retract runs cut.undo(): removeWire evicts the pieces from
    // _selectedWires automatically; the re-added originals stay unselected.
    this.project.actionManager.retract(cut);
  }

  // Drops an element from the selection sets before it is destroyed, so they
  // never retain a dead Container reference.
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

  /**
   * The selection's persistent rect: frozen at the shape it was set with
   * (never re-fit to content), translated to track the selection's bounding
   * box. Single source of truth for the rect visual and — when present — the
   * router's move-vs-new-selection hit test, so the grab zone and what the
   * user sees can never drift. Null for single-click selections (nothing was
   * drawn) and while nothing is selected.
   */
  public grabRect(): Rectangle | null {
    if (!this._grabRect || !this._grabAnchor) return null;
    const box = this.boundingBox();
    if (!box) return null;
    return new Rectangle(
      this._grabRect.x + (box.x - this._grabAnchor.x),
      this._grabRect.y + (box.y - this._grabAnchor.y),
      this._grabRect.width,
      this._grabRect.height
    );
  }

  /**
   * Whether a press at a grid point grabs the selection (starts a move). The
   * grab rect decides when one exists; a rect-less selection (single click)
   * falls back to the selected elements' own bounds.
   */
  public isGrabbedAt(gridPoint: { x: number; y: number }): boolean {
    const rect = this.grabRect();
    if (rect) return rect.contains(gridPoint.x, gridPoint.y);

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

  // Freezes the given rect (with the current bounds origin as its translation
  // anchor), or drops the rect entirely — also when the selection is empty.
  private _setGrabRect(rect: Rectangle | null): void {
    const box = rect ? this.boundingBox() : null;
    this._grabRect = box ? rect : null;
    this._grabAnchor = box ? new Point(box.x, box.y) : null;
  }

  public select(components: Component[], wires: Wire[]): void {
    this.clear();
    for (const c of components) {
      if (!c.destroyed) {
        c.selected = true;
        this._selectedComponents.add(c);
      }
    }
    for (const w of wires) {
      if (!w.destroyed) {
        w.selected = true;
        this._selectedWires.add(w);
      }
    }
    // No user-drawn shape to freeze — a programmatic selection (a committed
    // paste) rects its content bounds plus a margin.
    this._setGrabRect(
      this.boundingBox()?.pad(SelectionManager.GRAB_MARGIN) ?? null
    );
    this.retintCps();
    this._selectionChange$.next();
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

  // The junction dots currently highlighted — the ones a drag should carry so
  // that what moves matches what looks selected. See retintCps for the rule.
  public get selectedConnectionPoints(): readonly ConnectionPoint[] {
    return this._selectedConnectionPoints;
  }
}
