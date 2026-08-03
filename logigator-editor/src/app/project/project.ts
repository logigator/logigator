import { Container, DestroyOptions, Point, Rectangle } from 'pixi.js';
import { effect, EffectRef } from '@angular/core';

import { Grid } from '../rendering/grid';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI, getStaticInjector } from '../utils/get-di';
import { Component } from '../components/component';
import { merge, Observable, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { FloatingLayer } from '../rendering/floating-layer';
import { TickerSignal } from '../rendering/ticker-scheduler';
import { ActionManager } from '../actions/action-manager';
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { Direction } from '../utils/direction';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import { WireTopology } from './wire-topology';
import { ViewportController } from './viewport-controller';
import { ConnectionPointManager } from '../connection-points/connection-point-manager';
import { LoggingService } from '../logging/logging.service';

export class Project extends Container {
  public readonly actionManager = new ActionManager(this);
  public readonly selectionManager = new SelectionManager(this);
  /** Wire-invariant integration and the wire tool's connection toggling. */
  public readonly topology = new WireTopology(this);

  private readonly _grid: Grid = new Grid();
  private readonly _gridSpace = new Container();
  private readonly _wires = new QuadTreeContainer<Wire>();
  private readonly _components = new QuadTreeContainer<Component>();
  // Id → element indexes mirroring quad-tree membership exactly (detached
  // drag elements leave both), so id lookups are O(1) instead of tree scans.
  private readonly _componentsById = new Map<number, Component>();
  private readonly _wiresById = new Map<number, Wire>();
  private readonly _floatingLayer = new FloatingLayer();

  private readonly _viewport: ViewportController;
  // Reused by the per-frame cull pass (see cull()).
  private readonly _cullView = new Rectangle();
  // Render-loop signals for the hosting canvas (TickerScheduler on the board,
  // the direct re-blit subscription on a watch).
  private readonly _ticker$ = new Subject<TickerSignal>();
  // Paste requests (ClipboardService → the WorkModeRouter, which opens the
  // placement session in this project's floating layer).
  private readonly _pasteRequest$ = new Subject<{
    components: Component[];
    wires: Wire[];
  }>();
  // Selection-rotation requests (toolbar / selection-bar buttons → the
  // WorkModeRouter, which turns the active session's floating content or the
  // committed selection). Payload: clockwise quarter-turns.
  private readonly _rotateRequest$ = new Subject<number>();
  // User-input components (button/switch) clicked while in simulation mode.
  // The model layer stays service-free: SimulationService subscribes while a
  // simulation is active.
  private readonly _userInput$ = new Subject<Component>();
  // Inspectable components (config declares an inspection) tapped while in
  // simulation mode; InspectionService subscribes while a simulation is active.
  private readonly _inspectRequest$ = new Subject<Component>();

  private readonly _connectionPoints = new ConnectionPointManager(
    () => this.scale.x
  );
  private readonly _portsChangeSubs = new Map<number, Subscription>();
  private readonly _selectionRectSub: Subscription;

  private readonly _themingService = getStaticDI(ThemingService);
  private readonly _logging = getStaticDI(LoggingService);
  // Theme colors are baked into cached GraphicsContexts, so a theme switch
  // requires re-fetching every context. Each project self-heals via this
  // effect — including inactive (background) tabs, which the stage swap never
  // redraws. Created/run after the scene graph is wired up below.
  private _themeEffect: EffectRef | null = null;

  constructor() {
    super();

    this._gridSpace.scale.set(environment.gridSize);

    this.addChild(this._grid);
    this.addChild(this._gridSpace);

    this._gridSpace.addChild(this._wires);
    this._gridSpace.addChild(this._components);
    this._gridSpace.addChild(this._connectionPoints.layer);
    this._gridSpace.addChild(this._floatingLayer);

    this._viewport = new ViewportController(
      this,
      this._grid,
      (scale) => {
        this._floatingLayer.updateScale(scale);
        this._connectionPoints.layer.applyScale(scale);
        for (const child of this._components.items) {
          child.applyScale(scale);
        }
        for (const child of this._wires.items) {
          child.applyScale(scale);
        }
      },
      () => this._ticker$.next('single')
    );

    this._themeEffect = effect(
      () => {
        // Establish the dependency, then rebuild against the new theme.
        this._themingService.currentTheme();
        this.applyTheme();
      },
      { injector: getStaticInjector() }
    );

    // The persistent selection grab rect mirrors the selection's grabRect():
    // selectionChange$ covers commits/clears/evictions, actionChange$ covers
    // geometry changes that keep the selection alive — a committed move and
    // its undo/redo. Hosted in the floating layer, so offscreen snapshots
    // (minimap, exports) never capture it.
    this._selectionRectSub = merge(
      this.selectionManager.selectionChange$,
      this.actionManager.actionChange$
    ).subscribe(() => {
      const rect = this.selectionManager.grabRect();
      if (rect) {
        this._floatingLayer.showSelectionRect(rect);
      } else {
        this._floatingLayer.hideSelectionRect();
      }
    });
  }

  /**
   * Re-derives every theme-dependent color after a theme change, entirely in
   * place — nothing is rebuilt. Components swap their shared theme-keyed
   * contexts and rewrite tints/glyph colors ({@link Component.refreshTheme});
   * wires and connection points only re-derive their tint — their shared
   * context is a theme-independent white base; the grid swaps each chunk's
   * context. A no-op on a still-empty scene.
   *
   * A theme change never alters which dots exist, so connection points are
   * restyled in place rather than re-derived from the quad tree. Selection
   * state lives on each instance and every path re-reads it, so a selected
   * element keeps its highlight in the new theme's colors.
   *
   * @param triggerRender request an on-screen frame after restyling. Pass
   * `false` when restyling only to feed an offscreen snapshot (dual-theme
   * previews), so the live canvas isn't repainted in the temporary theme.
   */
  public applyTheme(triggerRender = true): void {
    this._grid.redraw();
    for (const component of this._components.items) {
      component.refreshTheme();
    }
    for (const wire of this._wires.items) {
      wire.refreshTint();
    }
    this._connectionPoints.refreshTheme();
    if (triggerRender) this._ticker$.next('single');
  }

  public get gridSpace(): Container {
    return this._gridSpace;
  }

  /** The transient overlay (drag ghosts, negation preview) sessions render into. */
  public get floatingLayer(): FloatingLayer {
    return this._floatingLayer;
  }

  public get ticker$(): Observable<TickerSignal> {
    return this._ticker$.asObservable();
  }

  public triggerTicker(value: TickerSignal): void {
    this._ticker$.next(value);
  }

  public get connectionPoints(): ConnectionPointManager {
    return this._connectionPoints;
  }

  public setGridVisible(visible: boolean): void {
    this._grid.visible = visible;
    this.triggerTicker('single');
  }

  /** Camera control (pan/zoom/state); zooms request their own render frame. */
  public get viewport(): ViewportController {
    return this._viewport;
  }

  /**
   * Entry-level cull pass: flags quad-tree entries outside the current
   * viewport as culled so their render groups are skipped at render time. The
   * board runs this before every blit; offscreen consumers (minimap, image
   * export, watches) render un-culled instead via `uncullTree`, and the next
   * board frame re-culls.
   */
  public cull(): void {
    const view = this._viewport.gridView(this._cullView);
    this._wires.cull(view);
    this._components.cull(view);
  }

  public get components(): Iterable<Component> {
    return this._components.items;
  }

  /** Number of components on the board — O(1), unlike counting {@link components}. */
  public get componentCount(): number {
    return this._componentsById.size;
  }

  public get wires(): Iterable<Wire> {
    return this._wires.items;
  }

  /**
   * The two spatial indexes, for debug inspection only — their shape
   * ({@link QuadTreeContainer.stats}, {@link QuadTreeContainer.formatTree}) and
   * their invariants ({@link QuadTreeContainer.validate}). Everything else goes
   * through the mutation and query methods on this class.
   */
  public get quadTrees(): {
    components: QuadTreeContainer<Component>;
    wires: QuadTreeContainer<Wire>;
  } {
    return { components: this._components, wires: this._wires };
  }

  /**
   * Tight axis-aligned bounds (grid units) covering all committed content
   * (components incl. port stubs + wires), or `null` when the project is empty.
   * Pure arithmetic over each element's `gridBounds` — no render-bounds
   * traversal — and run once per snapshot, so the O(n) cost is negligible.
   * Transient overlays are excluded.
   */
  public getContentBounds(): Rectangle | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const fold = (b: Rectangle): void => {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.right > maxX) maxX = b.right;
      if (b.bottom > maxY) maxY = b.bottom;
    };
    for (const component of this._components.items) fold(component.gridBounds);
    for (const wire of this._wires.items) fold(wire.gridBounds);
    if (!Number.isFinite(minX)) return null;
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  /**
   * Toggles the transient overlay (drag ghosts, wire preview, paste ghosts) so
   * an offscreen snapshot captures only committed circuit content. The snapshot
   * renders {@link gridSpace}, which contains this overlay as a child.
   */
  public setOverlayVisible(visible: boolean): void {
    this._floatingLayer.renderable = visible;
  }

  public get userInput$(): Observable<Component> {
    return this._userInput$.asObservable();
  }

  public emitUserInput(component: Component): void {
    this._userInput$.next(component);
  }

  public get inspectRequest$(): Observable<Component> {
    return this._inspectRequest$.asObservable();
  }

  public emitInspectRequest(component: Component): void {
    this._inspectRequest$.next(component);
  }

  public get pasteRequest$(): Observable<{
    components: Component[];
    wires: Wire[];
  }> {
    return this._pasteRequest$.asObservable();
  }

  public startPasteSession(components: Component[], wires: Wire[]): void {
    this._pasteRequest$.next({ components, wires });
  }

  public get rotateRequest$(): Observable<number> {
    return this._rotateRequest$.asObservable();
  }

  /**
   * Asks the interaction layer to rotate the current selection (or the active
   * session's floating content) by `steps` clockwise quarter-turns — the
   * paste-request pattern: UI surfaces emit, the WorkModeRouter executes.
   */
  public requestSelectionRotation(steps: number): void {
    this._rotateRequest$.next(steps);
  }

  /**
   * @param deferConnectionPoints skip the incremental connection-point
   * recompute for this add. Bulk loaders pass `true` and follow the batch with
   * a single {@link recomputeConnectionPoints}, which derives every dot in one
   * de-duplicated pass instead of one overlapping quad-tree query per element.
   */
  public addComponent(component: Component, deferConnectionPoints = false) {
    component.applyScale(this.scale.x);
    this._components.insert(component);
    this._componentsById.set(component.id, component);
    if (!deferConnectionPoints) {
      this._connectionPoints.onComponentAdded(component.connectionPoints);
    }
    this._portsChangeSubs.set(
      component.id,
      component.portsChange$.subscribe(({ oldPorts, newPorts }) => {
        // Ports changed while the component is not indexed — it is detached
        // into a drag session or mid-rotateComponent. The owner re-buckets
        // and integrates (undoably) itself, so the automatic pass below must
        // stay out: its insert would corrupt the detach and its integration
        // would double-apply.
        if (this._componentsById.get(component.id) !== component) return;
        // A port-count (or rotation) change resizes the component's
        // gridBounds, so it must be re-bucketed in the quad tree before any
        // spatial query below sees stale bounds. insert() does a
        // remove-then-reinsert for an already-tracked element.
        this._components.insert(component);
        // Rotation/port-count changes can leave a wire's interior crossing a
        // new port position (I2 violation) or unblock a previously-blocked
        // collinear merge at an old port. Run the integrator to restore
        // invariants. This path bypasses ActionManager, so the implied
        // wire splits/merges are NOT undoable.
        const { toAdd, toRemove } = this.topology.integrate({
          movedComponentPorts: [{ oldPorts, newPorts }]
        });
        if (toAdd.length > 0 || toRemove.length > 0) {
          this._logging.debug(
            `portsChange integration for component ${component.id} added ${toAdd.length} and removed ${toRemove.length} wire(s) (not undoable)`,
            'Project'
          );
        }
        for (const w of toRemove) this.removeWire(w.id);
        for (const w of toAdd) this.addWire(w);

        this._connectionPoints.onComponentRemoved(oldPorts);
        this._connectionPoints.onComponentAdded(newPorts);
        this._ticker$.next('single');
      })
    );
    this._ticker$.next('single');
  }

  /** Looks up a tracked component by its instance id; `undefined` if none. */
  public getComponentById(componentId: number): Component | undefined {
    return this._componentsById.get(componentId);
  }

  /** Looks up a tracked wire by its instance id; `undefined` if none. */
  public getWireById(wireId: number): Wire | undefined {
    return this._wiresById.get(wireId);
  }

  public removeComponent(componentId: number) {
    const component = this.getComponentById(componentId);
    if (!component) return;
    this.selectionManager.evict(component);
    const ports = component.connectionPoints;
    this._components.remove(component);
    this._componentsById.delete(componentId);
    this._connectionPoints.onComponentRemoved(ports);
    this._portsChangeSubs.get(componentId)?.unsubscribe();
    this._portsChangeSubs.delete(componentId);
    component.destroy({ children: true });
    this._ticker$.next('single');
  }

  /**
   * @param deferConnectionPoints skip the incremental connection-point
   * recompute for this add. See {@link addComponent} for the batch-load pattern.
   */
  public addWire(wire: Wire, deferConnectionPoints = false) {
    wire.applyScale(this.scale.x);
    this._wires.insert(wire);
    this._wiresById.set(wire.id, wire);
    if (!deferConnectionPoints) {
      this._connectionPoints.onWireAdded(Wire.snapshot(wire));
    }
    this._ticker$.next('single');
  }

  /**
   * Derives every connection point from the current circuit in one pass. Used
   * after a batch of deferred adds (see {@link addComponent}) to build all dots
   * once rather than incrementally per element.
   */
  public recomputeConnectionPoints(): void {
    this._connectionPoints.recomputeAll(
      this._wires.items,
      this._components.items
    );
    this._ticker$.next('single');
  }

  public removeWire(wireId: number) {
    const wire = this.getWireById(wireId);
    if (!wire) return;
    this.selectionManager.evict(wire);
    const snapshot = Wire.snapshot(wire);
    this._wires.remove(wire);
    this._wiresById.delete(wireId);
    this._connectionPoints.onWireRemoved(snapshot);
    wire.destroy();
    this._ticker$.next('single');
  }

  public hasComponentCollision(
    bounds: Rectangle,
    bodyBounds: Rectangle,
    excludeIds: ReadonlySet<number> = new Set()
  ): boolean {
    for (const comp of this.queryComponentsInRange(bounds)) {
      if (excludeIds.has(comp.id)) continue;
      // Allow stub-on-stub overlap (e.g. perpendicular wire ends meeting at a
      // corner). Only block if a body intersects the other component's full
      // extent (body + stubs), which catches body-body, body-stub, stub-body.
      if (
        bodyBounds.intersects(comp.gridBounds) ||
        bounds.intersects(comp.bodyGridBounds)
      )
        return true;
    }
    return false;
  }

  /**
   * The elements intersecting `rect`, as a fresh array unless `out` is given.
   * A snapshot, not a live view — callers are free to add or remove elements
   * while iterating the result.
   */
  public queryComponentsInRange(
    rect: Rectangle,
    out: Component[] = []
  ): Component[] {
    return this._components.queryRange(rect, out);
  }

  public queryWiresInRange(rect: Rectangle, out: Wire[] = []): Wire[] {
    return this._wires.queryRange(rect, out);
  }

  public hasWireBodyCollision(
    wireBounds: Rectangle,
    excludeIds: ReadonlySet<number> = new Set()
  ): boolean {
    for (const comp of this.queryComponentsInRange(wireBounds)) {
      if (excludeIds.has(comp.id)) continue;
      if (comp.ignoresWireCollision) continue;
      if (wireBounds.intersects(comp.bodyGridBounds)) return true;
    }
    return false;
  }

  public hasComponentBodyWireCollision(
    bodyBounds: Rectangle,
    excludeIds: ReadonlySet<number> = new Set(),
    ignoresWires = false
  ): boolean {
    if (ignoresWires) return false;
    for (const wire of this.queryWiresInRange(bodyBounds)) {
      if (excludeIds.has(wire.id)) continue;
      if (wire.gridBounds.intersects(bodyBounds)) return true;
    }
    return false;
  }

  public detachForDrag(
    components: readonly Component[],
    wires: readonly Wire[]
  ): void {
    for (const c of components) {
      this._components.remove(c);
      this._componentsById.delete(c.id);
    }
    for (const w of wires) {
      this._wires.remove(w);
      this._wiresById.delete(w.id);
    }
    // Drop the pre-drag termination counts (the elements are still at their old
    // positions here); reattachFromDrag re-adds them at the new ones. Existing
    // dots stay put until the settle pass — this only keeps the count map in
    // step with quad-tree membership.
    this._connectionPoints.removeTerminations(components, wires);
    this._ticker$.next('single');
  }

  public reattachFromDrag(
    components: readonly Component[],
    wires: readonly Wire[]
  ): void {
    for (const c of components) {
      if (!c.destroyed) {
        this._components.insert(c);
        this._componentsById.set(c.id, c);
      }
    }
    for (const w of wires) {
      if (!w.destroyed) {
        this._wires.insert(w);
        this._wiresById.set(w.id, w);
      }
    }
    // Re-add termination counts at the post-drag positions (destroyed elements
    // are skipped in both places, so their counts stay dropped).
    this._connectionPoints.addTerminations(components, wires);
    this._ticker$.next('single');
  }

  public moveComponent(id: number, pos: Point): void {
    const component = this.getComponentById(id);
    if (!component) return;
    const oldPorts = component.connectionPoints;
    component.position.copyFrom(pos);
    this._components.insert(component);
    this._connectionPoints.onComponentRemoved(oldPorts);
    this._connectionPoints.onComponentAdded(component.connectionPoints);
    this._ticker$.next('single');
  }

  public moveWire(id: number, pos: Point): void {
    const wire = this.getWireById(id);
    if (!wire) return;
    const oldSnap = Wire.snapshot(wire);
    wire.position.copyFrom(pos);
    this._wires.insert(wire);
    this._connectionPoints.onWireRemoved(oldSnap);
    this._connectionPoints.onWireAdded(Wire.snapshot(wire));
    this._ticker$.next('single');
  }

  /**
   * Applies a rotate entry to a tracked component — direction plus the
   * pivot-orbited position — with re-bucketing and connection-point refresh;
   * the rotate analog of {@link moveComponent}. The component is unindexed
   * around the direction write so its portsChange$ handler skips the
   * automatic (non-undoable) wire integration: the rotate action's container
   * replays those wire changes itself.
   */
  public rotateComponent(id: number, direction: Direction, pos: Point): void {
    const component = this.getComponentById(id);
    if (!component) return;
    const oldPorts = component.connectionPoints;
    this._componentsById.delete(id);
    component.direction = direction;
    this._componentsById.set(id, component);
    component.position.copyFrom(pos);
    this._components.insert(component);
    this._connectionPoints.onComponentRemoved(oldPorts);
    this._connectionPoints.onComponentAdded(component.connectionPoints);
    this._ticker$.next('single');
  }

  /**
   * Moves a tracked wire and sets its axis in one step — how a rotate entry
   * lands (a quarter-turn swaps HORIZONTAL/VERTICAL). The length is
   * rotation-invariant, so it stays untouched.
   */
  public setWireGeometry(
    id: number,
    pos: Point,
    direction: WireDirection
  ): void {
    const wire = this.getWireById(id);
    if (!wire) return;
    const oldSnap = Wire.snapshot(wire);
    wire.direction = direction;
    wire.position.copyFrom(pos);
    this._wires.insert(wire);
    this._connectionPoints.onWireRemoved(oldSnap);
    this._connectionPoints.onWireAdded(Wire.snapshot(wire));
    this._ticker$.next('single');
  }

  public override destroy(options?: DestroyOptions): void {
    this._themeEffect?.destroy();
    this._selectionRectSub.unsubscribe();
    this._ticker$.complete();
    this._pasteRequest$.complete();
    this._rotateRequest$.complete();
    this._userInput$.complete();
    this._inspectRequest$.complete();
    this.actionManager.destroy();
    for (const sub of this._portsChangeSubs.values()) {
      sub.unsubscribe();
    }
    this._portsChangeSubs.clear();
    this._viewport.dispose();
    super.destroy(options ?? { children: true });
  }
}
