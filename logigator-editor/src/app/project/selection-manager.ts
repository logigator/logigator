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

/** The element a click lands on, tagged with the set it belongs in. */
type ClickHit =
  { kind: 'component'; element: Component } | { kind: 'wire'; element: Wire };

export class SelectionManager {
  /** Margin (grid units) for grab rects with no user-drawn shape. */
  static readonly GRAB_MARGIN = 1;

  private readonly _selectedComponents = new Set<Component>();
  private readonly _selectedWires = new Set<Wire>();
  private readonly _selectionChange$ = new Subject<void>();
  // Bumped on every change, so provisional state elsewhere (the wire tool's
  // double-click take-back) can tell whether the selection it recorded still
  // stands or has been changed by something else.
  private _version = 0;
  // The scissor cut this selection registered, live only while it is still the
  // newest history entry: consumed by the move/delete that commits it,
  // retracted by clear().
  private _cutAction: Action | null = null;
  private _selectedConnectionPoints: ConnectionPoint[] = [];
  // The rect as set, plus the bounding-box origin at that moment. grabRect()
  // translates by how far the bounds have moved since, so the rect follows a
  // committed move without resizing.
  private _grabRect: Rectangle | null = null;
  private _grabAnchor: Point | null = null;

  constructor(private readonly project: Project) {
    // An action recorded on top of a live cut would orphan it as an invisible
    // wire split, so clear (retracting the cut) before that action lands. The
    // cut's own register can't self-dissolve: `_cutAction` is set afterwards.
    project.actionManager.onBeforeRecord(() => {
      if (this.hasLiveCut) this.clear();
    });
  }

  /**
   * Selects what the rect touches, or — for the zero-area rect a click makes —
   * the one element under the point, and clears whatever was selected before.
   *
   * `additive` is the hold-style modifier: a click then *toggles* the element
   * under it (see {@link _commitSingleClick}) and a marquee *joins* what it
   * touches to
   * the selection, instead of replacing it. A click has no rect to persist, so
   * it leaves the committed one untouched; a marquee is the shape the user
   * just drew and becomes it, as it does without the modifier.
   */
  public commit(rect: Rectangle, mode: WorkMode, additive = false): void {
    if (rect.width === 0 && rect.height === 0) {
      this._commitSingleClick(rect.x, rect.y, additive, true);
    } else {
      this._commitRect(rect, mode, additive);
    }
  }

  private _commitRect(
    rect: Rectangle,
    mode: WorkMode,
    additive: boolean
  ): void {
    if (additive) {
      // The cut this selection is still carrying would be orphaned by the one
      // the scissor is about to register, and it cannot be taken back later
      // without clearing the selection this commit is building.
      this._retractLiveCut();
    } else {
      this.clear();
    }

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

    // The user shaped the marquee, so it never re-fits to what it caught.
    this._setGrabRect(rect.clone());
    this.retintCps();
    this._notifySelectionChange();
  }

  private _scissorAndSelectWires(rect: Rectangle): void {
    // A snapshot, so the synchronous addWire/removeWire calls below cannot
    // disturb this iteration.
    const candidates = this.project.queryWiresInRange(rect);

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
      // A real history entry from the start, registered against the
      // materialized state so the inside piece is a live selectable Wire. A
      // move/delete commit coalesces it in; cancelling retracts it. Built
      // before the mutations so its snapshots hold the pre-cut geometry.
      const cut = new ActionContainer(
        new RemoveWiresAction(...wiresToCut.map((w) => Wire.serialize(w))),
        new AddWiresAction(...newPieces.map((w) => Wire.serialize(w)))
      );

      // Match the action order so the CP manager and quad tree see the same
      // transitions as undo/redo do.
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

    // Added synchronously above, so select by id rather than re-querying.
    if (insideIds.size > 0) {
      for (const piece of newPieces) {
        if (!piece.destroyed && insideIds.has(piece.id)) {
          piece.selected = true;
          this._selectedWires.add(piece);
        }
      }
    }
  }

  // A zero-area rect fails PixiJS Rectangle.intersects(), hence the 1×1 query
  // rect plus a gridBounds.contains() post-filter.
  private _commitSingleClick(
    px: number,
    py: number,
    additive: boolean,
    /**
     * What a click that lands on nothing does: a click on empty canvas clears
     * the selection, while one inside the selection — aimed at one of its
     * elements and missing — leaves it as it is.
     */
    missClears: boolean
  ): void {
    if (additive) {
      const hit = this._pickAt(px, py);
      if (!hit) return;
      // Toggled in place. The rect is read first and re-anchored after: it is
      // the shape the user drew, so a membership change must not carry it along
      // with the bounds (freezeGrabRect emits the change).
      const rect = this.grabRect();
      this._setMember(hit, !this._isMember(hit));
      this.freezeGrabRect(rect);
      this.retintCps();
      return;
    }

    // A click aimed inside the selection that misses — the gap in a marquee —
    // leaves it alone. Tested without keeping the hit: what this selects is
    // resolved after the clear below.
    if (!missClears && !this._pickAt(px, py)) return;

    // Cleared first: retracting a live scissor cut replaces the wires it cut,
    // so a hit resolved before that could name an instance this destroys.
    this.clear();
    const hit = this._pickAt(px, py);
    if (hit) this._setMember(hit, true);
    // A click draws nothing, so a single-click selection gets no persistent
    // rect; grabbing falls back to the element's own bounds (see isGrabbedAt).
    this._setGrabRect(null);
    this.retintCps();
    this._notifySelectionChange();
  }

  /**
   * What a press on the selection that never moved means: the element under
   * the point becomes the whole selection, which is how a click inside a
   * multi-selection narrows it to one element. With the additive modifier it
   * toggles in place of that. A press that landed on the gap inside a marquee
   * leaves the selection as it is — aiming beside a small element must not
   * clear everything.
   */
  public clickInSelection(
    point: { x: number; y: number },
    additive: boolean
  ): void {
    this._commitSingleClick(point.x, point.y, additive, false);
  }

  /** Whether the clicked element is in the selection. */
  private _isMember(hit: ClickHit): boolean {
    return hit.kind === 'component'
      ? this._selectedComponents.has(hit.element)
      : this._selectedWires.has(hit.element);
  }

  /**
   * Puts the clicked element in or out of the selection, its set and its
   * `selected` flag together.
   */
  private _setMember(hit: ClickHit, selected: boolean): void {
    if (hit.kind === 'component') {
      if (selected) this._selectedComponents.add(hit.element);
      else this._selectedComponents.delete(hit.element);
    } else {
      if (selected) this._selectedWires.add(hit.element);
      else this._selectedWires.delete(hit.element);
    }
    hit.element.selected = selected;
  }

  /**
   * The element a click at the point selects: the one whose bounds contain it,
   * a component over a wire and the smaller bounding box over the larger —
   * smaller = more precisely aimed.
   */
  private _pickAt(px: number, py: number): ClickHit | null {
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

    if (
      bestComponent !== null &&
      (bestWire === null || bestComponentArea <= bestWireArea)
    ) {
      return { kind: 'component', element: bestComponent };
    }
    return bestWire ? { kind: 'wire', element: bestWire } : null;
  }

  // A CP is highlighted only when the selection rect touches its grid cell, so
  // selecting a wire does not drag its endpoint junctions — which may connect
  // to unselected wires — into the highlight. Enumerating candidates from the
  // selected elements' terminations is equivalent to that test and needs no CP
  // spatial index. A rect-less selection highlights nothing.
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

    // Several selected elements can terminate at the same junction.
    this._selectedConnectionPoints = [
      ...new Set(this.project.connectionPoints.getCpsAtPoints(points))
    ];
    for (const cp of this._selectedConnectionPoints) {
      cp.selected = true;
    }
  }

  // CPs sit at half-grid centres, so their cell is the integer square
  // floor(p)..floor(p)+1. Inclusive on every edge, so a grazing rect touches.
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
   * Neutralizes the selection highlight so an off-screen render does not bake
   * it into committed content. The returned closure restores the flags,
   * re-deriving each tint from whatever theme is active by then.
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
    // First, so a cancelled selection leaves the project in its pre-cut state
    // and the history without the entry.
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
    this._notifySelectionChange();
  }

  /**
   * Whether this selection's scissor cut is still committable: it exists and
   * is the newest history entry. Validated lazily, so an undo that popped the
   * cut silently ends its live phase.
   */
  public get hasLiveCut(): boolean {
    return (
      this._cutAction !== null &&
      this.project.actionManager.topDone === this._cutAction
    );
  }

  /**
   * Hands the live cut over to be coalesced into the committing action's undo
   * step. Null when no cut is live; a stale reference is dropped either way.
   */
  public consumeLiveCut(): Action | null {
    const cut = this.hasLiveCut ? this._cutAction : null;
    this._cutAction = null;
    return cut;
  }

  // Reverts an uncommitted cut out of the history, so a cancelled scissor
  // selection leaves no trace. A stale cut stays where the history has it.
  private _retractLiveCut(): void {
    const cut = this._cutAction;
    this._cutAction = null;
    if (!cut) return;
    // Retract runs cut.undo(): removeWire evicts the pieces from
    // _selectedWires; the re-added originals stay unselected.
    this.project.actionManager.retract(cut);
  }

  // Drops an element before it is destroyed, so the sets never retain a dead
  // Container reference.
  public evict(element: Component | Wire): void {
    let changed: boolean;
    if (element instanceof Component) {
      changed = this._selectedComponents.delete(element);
    } else {
      changed = this._selectedWires.delete(element);
    }
    if (changed) {
      this._notifySelectionChange();
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
   * The persistent rect: frozen at the shape it was set with, never re-fit to
   * content, translated to track the bounding box. One source of truth for
   * both the visual and the grab hit test, so the two cannot drift. Null for
   * single-click selections and while nothing is selected.
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
   * Whether a press at a grid point grabs the selection (starts a move): the
   * drawn marquee where one exists, or the selected elements' own bounds —
   * whichever is hit, so an element the marquee does not cover (added by the
   * additive modifier, or hanging over the marquee's edge) still drags the
   * group. A rect-less selection (single click) has only the bounds to go on.
   */
  public isGrabbedAt(gridPoint: { x: number; y: number }): boolean {
    const rect = this.grabRect();
    if (rect?.contains(gridPoint.x, gridPoint.y)) return true;
    return this._selectedAt(gridPoint) !== null;
  }

  /**
   * A selected component whose body contains the point — the one test the wire
   * tool makes against the selection, since a wire run started inside a body
   * collides with it (see `WireTool`).
   */
  public selectedBodyAt(gridPoint: { x: number; y: number }): Component | null {
    for (const component of this._nearbyComponents(gridPoint)) {
      if (component.bodyGridBounds.contains(gridPoint.x, gridPoint.y)) {
        return component;
      }
    }
    return null;
  }

  /**
   * The selected element whose bounds contain the point, if any. Queried
   * through the project's spatial index rather than by walking the selection:
   * this answers every press, and a large selection must not cost a bounds
   * allocation per member.
   */
  private _selectedAt(gridPoint: {
    x: number;
    y: number;
  }): Component | Wire | null {
    for (const component of this._nearbyComponents(gridPoint)) {
      if (component.gridBounds.contains(gridPoint.x, gridPoint.y)) {
        return component;
      }
    }
    for (const wire of this._nearbyWires(gridPoint)) {
      if (wire.gridBounds.contains(gridPoint.x, gridPoint.y)) {
        return wire;
      }
    }
    return null;
  }

  /** Selected components whose bounds cover the grid cell around the point. */
  private _nearbyComponents(gridPoint: {
    x: number;
    y: number;
  }): Iterable<Component> {
    const queryRect = new Rectangle(gridPoint.x - 0.5, gridPoint.y - 0.5, 1, 1);
    return [...this.project.queryComponentsInRange(queryRect)].filter(
      (c) => !c.destroyed && this._selectedComponents.has(c)
    );
  }

  /** Selected wires whose bounds cover the grid cell around the point. */
  private _nearbyWires(gridPoint: { x: number; y: number }): Iterable<Wire> {
    const queryRect = new Rectangle(gridPoint.x - 0.5, gridPoint.y - 0.5, 1, 1);
    return [...this.project.queryWiresInRange(queryRect)].filter(
      (w) => !w.destroyed && this._selectedWires.has(w)
    );
  }

  /**
   * Adds integration replacement wires to the live selection, since removing
   * the originals evicted them. The grab rect must then be re-frozen
   * ({@link freezeGrabRect}) from a rect captured *before* the removals: the
   * evictions can shrink the bounding box it anchors to.
   */
  public adoptWires(wires: Iterable<Wire>): void {
    let changed = false;
    for (const wire of wires) {
      if (wire.destroyed || this._selectedWires.has(wire)) continue;
      wire.selected = true;
      this._selectedWires.add(wire);
      changed = true;
    }
    if (changed) {
      this._notifySelectionChange();
    }
  }

  /**
   * Replaces the frozen rect wholesale, re-anchored to the current bounding
   * box, or drops it with `null`. A rotate turns the rect with the geometry:
   * still the shape it was drawn as, never re-fit to content.
   */
  public freezeGrabRect(rect: Rectangle | null): void {
    this._setGrabRect(rect);
    this._notifySelectionChange();
  }

  // Anchors the rect to the current bounds origin, or drops it — also when
  // the selection is empty.
  private _setGrabRect(rect: Rectangle | null): void {
    const box = rect ? this.boundingBox() : null;
    this._grabRect = box ? rect : null;
    this._grabAnchor = box ? new Point(box.x, box.y) : null;
  }

  /**
   * Drops the persistent rect while keeping the selection, so grabbing falls
   * back to the elements' own bounds.
   */
  public clearGrabRect(): void {
    this._setGrabRect(null);
    this.retintCps();
    this._notifySelectionChange();
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
    // No user-drawn shape to freeze, so rect the content bounds plus a margin.
    this._setGrabRect(
      this.boundingBox()?.pad(SelectionManager.GRAB_MARGIN) ?? null
    );
    this.retintCps();
    this._notifySelectionChange();
  }

  public get isEmpty(): boolean {
    return (
      this._selectedComponents.size === 0 && this._selectedWires.size === 0
    );
  }

  /** The selection's version: it changes whenever the selection does. */
  public get selectionVersion(): number {
    return this._version;
  }

  private _notifySelectionChange(): void {
    this._version++;
    this._selectionChange$.next();
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

  // The highlighted junction dots — what a drag carries, so that what moves
  // matches what looks selected.
  public get selectedConnectionPoints(): readonly ConnectionPoint[] {
    return this._selectedConnectionPoints;
  }
}
