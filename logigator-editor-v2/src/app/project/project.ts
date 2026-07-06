import { Container, DestroyOptions, Point, Rectangle } from 'pixi.js';
import { effect, EffectRef } from '@angular/core';

import { Grid } from '../rendering/grid';
import { ThemingService } from '../theming/theming.service';
import { getStaticDI, getStaticInjector } from '../utils/get-di';
import { Component } from '../components/component';
import { Observable, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { FloatingLayer } from '../rendering/floating-layer';
import { TickerSignal } from '../rendering/ticker-scheduler';
import { ActionManager } from '../actions/action-manager';
import { ActionContainer } from '../actions/action-container';
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import {
  IntegrationInput,
  IntegrationOutput,
  WireIntegrator
} from './wire-integrator';
import { ViewportController, ViewportState } from './viewport-controller';
import { ConnectionPointManager } from '../connection-points/connection-point-manager';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { LoggingService } from '../logging/logging.service';

export class Project extends Container {
  public readonly actionManager = new ActionManager(this);
  public readonly selectionManager = new SelectionManager(this);

  private readonly _grid: Grid = new Grid();
  private readonly _gridSpace = new Container();
  // Distinct debug-overlay hues so the two overlapping quad trees stay legible
  // when environment.debug.showQuadTrees is on (cyan = wires, orange = components).
  private readonly _wires = new QuadTreeContainer<Wire>(0x00e5ff);
  private readonly _components = new QuadTreeContainer<Component>(0xff9100);
  private readonly _floatingLayer = new FloatingLayer();

  private readonly _wireIntegrator = new WireIntegrator();
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

    this._viewport = new ViewportController(this, this._grid, (scale) => {
      this._floatingLayer.updateScale(scale);
      this._connectionPoints.layer.applyScale(scale);
      for (const child of this._components.items) {
        child.applyScale(scale);
      }
      for (const child of this._wires.items) {
        child.applyScale(scale);
      }
    });

    this._themeEffect = effect(
      () => {
        // Establish the dependency, then rebuild against the new theme.
        this._themingService.currentTheme();
        this.applyTheme();
      },
      { injector: getStaticInjector() }
    );
  }

  /**
   * Re-fetches every theme-dependent GraphicsContext after a theme change. The
   * cache is theme-keyed, so redrawing each element picks up the new colors.
   * A no-op on a still-empty scene.
   *
   * Connection points only swap their theme-keyed context — a theme change
   * never alters which dots exist, so this restyles them in place rather than
   * re-deriving them from the quad tree. Their selection tint lives on the
   * instance and survives the context swap, exactly as it does for components
   * and wires.
   *
   * @param triggerRender request an on-screen frame after redrawing. Pass
   * `false` when redrawing only to feed an offscreen snapshot (dual-theme
   * previews), so the live canvas isn't repainted in the temporary theme.
   */
  public applyTheme(triggerRender = true): void {
    this._grid.redraw();
    for (const component of this._components.items) {
      component.redraw();
    }
    for (const wire of this._wires.items) {
      wire.refreshTheme();
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

  public resizeViewport(width: number, height: number): void {
    this._viewport.resizeViewport(width, height);
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

  public pan(point: Point): void {
    this._viewport.pan(point);
  }

  public setPosition(point: Point): void {
    this._viewport.setPosition(point);
  }

  public zoomIn(center?: Point): void {
    this._viewport.zoomIn(center);
    this.triggerTicker('single');
  }

  public zoomOut(center?: Point): void {
    this._viewport.zoomOut(center);
    this.triggerTicker('single');
  }

  public get zoomInPossible(): boolean {
    return this._viewport.zoomInPossible;
  }

  public get zoomOutPossible(): boolean {
    return this._viewport.zoomOutPossible;
  }

  public zoom100(center?: Point): void {
    this._viewport.zoom100(center);
    this.triggerTicker('single');
  }

  public zoomBy(factor: number, center?: Point): void {
    this._viewport.zoomBy(factor, center);
    this.triggerTicker('single');
  }

  public get viewportChange$(): Observable<ViewportState> {
    return this._viewport.viewportChange$;
  }

  public get viewportState(): ViewportState {
    return this._viewport.viewportState;
  }

  public get components(): Iterable<Component> {
    return this._components.items;
  }

  public get wires(): Iterable<Wire> {
    return this._wires.items;
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

  public get gridPosition(): Point {
    return this._viewport.gridPosition;
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

  /**
   * @param deferConnectionPoints skip the incremental connection-point
   * recompute for this add. Bulk loaders pass `true` and follow the batch with
   * a single {@link recomputeConnectionPoints}, which derives every dot in one
   * de-duplicated pass instead of one overlapping quad-tree query per element.
   */
  public addComponent(component: Component, deferConnectionPoints = false) {
    component.applyScale(this.scale.x);
    this._components.insert(component);
    if (!deferConnectionPoints) {
      this._connectionPoints.onComponentAdded(component.connectionPoints);
    }
    this._portsChangeSubs.set(
      component.id,
      component.portsChange$.subscribe(({ oldPorts, newPorts }) => {
        // A port-count (or rotation) change resizes the component's
        // gridBounds, so it must be re-bucketed in the quad tree before any
        // spatial query below sees stale bounds. insert() does a
        // remove-then-reinsert for an already-tracked element.
        this._components.insert(component);
        // Rotation/port-count changes can leave a wire's interior crossing a
        // new port position (I2 violation) or unblock a previously-blocked
        // collinear merge at an old port. Run the integrator to restore
        // invariants. Note: this path bypasses ActionManager, so the implied
        // wire splits/merges are NOT undoable. Rotation itself was already
        // not undoable before this refactor; full undo support is tracked
        // as a future task (see wire-connection-refactor.md Phase 4).
        const { toAdd, toRemove } = this.computeIntegration({
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
    for (const component of this._components.items) {
      if (component.id === componentId) return component;
    }
    return undefined;
  }

  public removeComponent(componentId: number) {
    const component = this.getComponentById(componentId);
    if (!component) return;
    this.selectionManager.evict(component);
    const ports = component.connectionPoints;
    this._components.remove(component);
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
    const wire = Array.from(this._wires.items).find((w) => w.id === wireId);
    if (!wire) return;
    this.selectionManager.evict(wire);
    const snapshot = Wire.snapshot(wire);
    this._wires.remove(wire);
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

  public *queryComponentsInRange(rect: Rectangle): Generator<Component> {
    yield* this._components.queryRange(rect);
  }

  public *queryWiresInRange(rect: Rectangle): Generator<Wire> {
    yield* this._wires.queryRange(rect);
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

  public computeIntegration(input: IntegrationInput): IntegrationOutput {
    return this._wireIntegrator.integrate(
      input,
      (rect) => this.queryWiresInRange(rect),
      (rect) => this.queryComponentsInRange(rect),
      this.scale.x
    );
  }

  public detachForDrag(
    components: readonly Component[],
    wires: readonly Wire[]
  ): void {
    for (const c of components) {
      this._components.remove(c);
    }
    for (const w of wires) {
      this._wires.remove(w);
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
      if (!c.destroyed) this._components.insert(c);
    }
    for (const w of wires) {
      if (!w.destroyed) this._wires.insert(w);
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
    const wire = Array.from(this._wires.items).find((w) => w.id === id);
    if (!wire) return;
    const oldSnap = Wire.snapshot(wire);
    wire.position.copyFrom(pos);
    this._wires.insert(wire);
    this._connectionPoints.onWireRemoved(oldSnap);
    this._connectionPoints.onWireAdded(Wire.snapshot(wire));
    this._ticker$.next('single');
  }

  public toggleConnectionAt(p: Point): void {
    if (this._connectionPoints.hasCpAt(p)) {
      this._joinAt(p);
    } else {
      this._splitAt(p);
    }
  }

  private _joinAt(p: Point): void {
    const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
    const hWires: Wire[] = [];
    const vWires: Wire[] = [];

    for (const w of this.queryWiresInRange(queryRect)) {
      const [s, e] = w.connectionPoints;
      if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y)) {
        if (w.direction === WireDirection.HORIZONTAL) hWires.push(w);
        else vWires.push(w);
      }
    }

    const addedWires: Wire[] = [];
    const removedWires: Wire[] = [];

    if (hWires.length === 2) {
      removedWires.push(...hWires);
      addedWires.push(Wire.merge(hWires[0], hWires[1]));
    }

    if (vWires.length === 2) {
      removedWires.push(...vWires);
      addedWires.push(Wire.merge(vWires[0], vWires[1]));
    }

    if (addedWires.length === 0) {
      this._logging.debug(
        `join at (${p.x}, ${p.y}) is a no-op: no collinear wire pair to merge`,
        'Project'
      );
      return;
    }

    const { toAdd, toRemove } = this.computeIntegration({
      addedWires,
      removedWires
    });

    const blocked = toAdd.some((w) => {
      const [s, e] = w.connectionPoints;
      return (s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y);
    });

    const cleanup = () => {
      for (const w of addedWires) if (!w.destroyed) w.destroy();
      for (const w of toAdd) if (!w.destroyed) w.destroy();
    };

    if (blocked) {
      this._logging.debug(
        `join at (${p.x}, ${p.y}) rejected: the merge would re-split at the same point`,
        'Project'
      );
      cleanup();
      return;
    }

    const action = new ActionContainer();
    if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
    if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));
    cleanup();
    this.actionManager.push(action);
  }

  private _splitAt(p: Point): void {
    const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
    let hWire: Wire | null = null;
    let vWire: Wire | null = null;

    for (const w of this.queryWiresInRange(queryRect)) {
      if (!w.contains(p)) continue;
      const [s, e] = w.connectionPoints;
      if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y))
        continue;
      if (w.direction === WireDirection.HORIZONTAL) hWire = w;
      else vWire = w;
    }

    if (!hWire || !vWire) {
      this._logging.debug(
        `split at (${p.x}, ${p.y}) is a no-op: needs both a horizontal and a vertical wire crossing the point`,
        'Project'
      );
      return;
    }

    const [hLeft, hRight] = Wire.split(hWire, p);
    const [vTop, vBottom] = Wire.split(vWire, p);

    const addedWires = [hLeft, hRight, vTop, vBottom];
    const removedWires = [hWire, vWire];

    const { toAdd, toRemove } = this.computeIntegration({
      addedWires,
      removedWires
    });

    const action = new ActionContainer();
    if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
    if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));
    for (const w of addedWires) if (!w.destroyed) w.destroy();
    this.actionManager.push(action);
  }

  public override destroy(options?: DestroyOptions): void {
    this._themeEffect?.destroy();
    this._ticker$.complete();
    this._pasteRequest$.complete();
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
