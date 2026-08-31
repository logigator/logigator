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
import { Direction, WireDirection } from '@logigator/core';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import { WireTopology } from './wire-topology';
import { ViewportController } from './viewport-controller';
import { ConnectionPointManager } from '../connection-points/connection-point-manager';
import { LoggingService } from '../logging/logging.service';

/** Shared "exclude nothing" set, so a collision check allocates none. */
export const NO_EXCLUDED_IDS: ReadonlySet<number> = new Set<number>();

export class Project extends Container {
  public readonly actionManager = new ActionManager(this);
  public readonly selectionManager = new SelectionManager(this);
  /** Wire-invariant integration and the wire tool's connection toggling. */
  public readonly topology = new WireTopology(this);

  private readonly _grid: Grid = new Grid();
  private readonly _gridSpace = new Container();
  private readonly _wires = new QuadTreeContainer<Wire>();
  private readonly _components = new QuadTreeContainer<Component>();
  // Mirror quad-tree membership exactly (detached drag elements leave both).
  private readonly _componentsById = new Map<number, Component>();
  private readonly _wiresById = new Map<number, Wire>();
  private readonly _floatingLayer = new FloatingLayer();

  private readonly _viewport: ViewportController;
  private readonly _cullView = new Rectangle();
  // Reused by the collision helpers: one query per dragged element per move.
  private readonly _componentScratch: Component[] = [];
  private readonly _wireScratch: Wire[] = [];
  // Render-loop signals for the hosting canvas.
  private readonly _ticker$ = new Subject<TickerSignal>();
  private readonly _pasteRequest$ = new Subject<{
    components: Component[];
    wires: Wire[];
  }>();
  // Payload: clockwise quarter-turns.
  private readonly _rotateRequest$ = new Subject<number>();
  // Button/switch components clicked during simulation. A Subject rather than
  // a direct call keeps the model layer service-free.
  private readonly _userInput$ = new Subject<Component>();
  // Inspectable components tapped during simulation.
  private readonly _inspectRequest$ = new Subject<Component>();

  private readonly _connectionPoints = new ConnectionPointManager(
    () => this.scale.x
  );
  private readonly _portsChangeSubs = new Map<number, Subscription>();
  private readonly _selectionRectSub: Subscription;

  private readonly _themingService = getStaticDI(ThemingService);
  private readonly _logging = getStaticDI(LoggingService);
  // Theme colors are baked into cached GraphicsContexts, so every project
  // re-fetches them on a theme switch — background tabs included, which no
  // stage swap redraws.
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
        // Only what the viewport can see; the cull pass catches off-screen
        // entries up when it reveals them.
        this._components.applyScale(scale);
        this._wires.applyScale(scale);
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

    // selectionChange$ covers commits/clears/evictions, actionChange$ the
    // geometry changes that keep a selection alive (a move and its undo).
    // Hosted in the floating layer, so offscreen snapshots never capture it.
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
   * Re-derives every theme-dependent color in place; nothing is rebuilt and no
   * connection point is re-derived, since a theme change never alters which
   * dots exist.
   *
   * @param triggerRender request an on-screen frame afterwards. Pass `false`
   * when restyling only to feed an offscreen snapshot, so the live canvas is
   * not repainted in the temporary theme.
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

  /** Transient overlay: drag ghosts, wire and negation previews. */
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

  public get viewport(): ViewportController {
    return this._viewport;
  }

  /**
   * Re-tunes every content element's scale-dependent visuals, culled entries
   * included — what an un-culled whole-board render needs, since {@link cull}
   * is what would otherwise catch the off-screen ones up.
   */
  public applyContentScale(scale: number): void {
    this._components.applyScaleToAll(scale);
    this._wires.applyScaleToAll(scale);
    this._connectionPoints.layer.applyScale(scale);
  }

  /**
   * Flags quad-tree entries outside the viewport as culled, so their render
   * groups are skipped. Also the catch-up point for the zoom re-tuning
   * {@link ViewportController} skips over off-screen entries: an entry reaches
   * the live scale on the frame that un-culls it.
   */
  public cull(): void {
    const view = this._viewport.gridView(this._cullView);
    this._wires.cull(view);
    this._components.cull(view);
  }

  public get components(): Iterable<Component> {
    return this._components.items;
  }

  /** O(1), unlike counting {@link components}. */
  public get componentCount(): number {
    return this._componentsById.size;
  }

  public get wires(): Iterable<Wire> {
    return this._wires.items;
  }

  /** Debug inspection only; mutations and queries go through this class. */
  public get quadTrees(): {
    components: QuadTreeContainer<Component>;
    wires: QuadTreeContainer<Wire>;
  } {
    return { components: this._components, wires: this._wires };
  }

  /**
   * Tight bounds in grid units over all committed content (component bodies
   * incl. port stubs, plus wires), or `null` when the project is empty.
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
   * Hides the transient overlay so an offscreen snapshot of {@link gridSpace},
   * which contains it, captures only committed circuit content.
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
   * session's floating content) by `steps` clockwise quarter-turns.
   */
  public requestSelectionRotation(steps: number): void {
    this._rotateRequest$.next(steps);
  }

  /**
   * @param deferConnectionPoints skip the incremental connection-point
   * recompute. Bulk loaders pass `true` and follow the batch with one
   * {@link recomputeConnectionPoints}, deriving every dot in a single pass.
   */
  public addComponent(component: Component, deferConnectionPoints = false) {
    this._components.insert(component);
    this._componentsById.set(component.id, component);
    if (!deferConnectionPoints) {
      this._connectionPoints.onComponentAdded(component.connectionPoints);
    }
    this._portsChangeSubs.set(
      component.id,
      component.portsChange$.subscribe(({ oldPorts, newPorts }) => {
        // Not indexed: detached into a drag session, or mid-rotateComponent.
        // Its owner re-buckets and integrates undoably itself, so the pass
        // below must stay out or it double-applies.
        if (this._componentsById.get(component.id) !== component) return;
        // A port-count or rotation change resizes gridBounds, so re-bucket
        // (insert re-inserts a tracked element) before any query below sees
        // stale bounds.
        this._components.insert(component);
        // The change can leave a wire's interior crossing a new port (I2) or
        // unblock a collinear merge at an old one. This path bypasses
        // ActionManager, so the resulting splits/merges are NOT undoable.
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

  public getComponentById(componentId: number): Component | undefined {
    return this._componentsById.get(componentId);
  }

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

  /** @param deferConnectionPoints see {@link addComponent}. */
  public addWire(wire: Wire, deferConnectionPoints = false) {
    this._wires.insert(wire);
    this._wiresById.set(wire.id, wire);
    if (!deferConnectionPoints) {
      this._connectionPoints.onWireAdded(Wire.snapshot(wire));
    }
    this._ticker$.next('single');
  }

  /** Derives every connection point from the current circuit in one pass. */
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
    excludeIds: ReadonlySet<number> = NO_EXCLUDED_IDS
  ): boolean {
    for (const comp of this._queryComponentScratch(bounds)) {
      if (excludeIds.has(comp.id)) continue;
      // Stub-on-stub overlap is legal (perpendicular wire ends meeting at a
      // corner); only a body intersecting the other's full extent blocks.
      if (
        comp.intersectsGridBounds(bodyBounds) ||
        comp.intersectsBodyGridBounds(bounds)
      )
        return true;
    }
    return false;
  }

  /**
   * A snapshot, not a live view — the result stays valid while elements are
   * added or removed.
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
    excludeIds: ReadonlySet<number> = NO_EXCLUDED_IDS
  ): boolean {
    for (const comp of this._queryComponentScratch(wireBounds)) {
      if (excludeIds.has(comp.id)) continue;
      if (comp.ignoresWireCollision) continue;
      if (comp.intersectsBodyGridBounds(wireBounds)) return true;
    }
    return false;
  }

  public hasComponentBodyWireCollision(
    bodyBounds: Rectangle,
    excludeIds: ReadonlySet<number> = NO_EXCLUDED_IDS,
    ignoresWires = false
  ): boolean {
    if (ignoresWires) return false;
    for (const wire of this._queryWireScratch(bodyBounds)) {
      if (excludeIds.has(wire.id)) continue;
      if (wire.intersectsGridBounds(bodyBounds)) return true;
    }
    return false;
  }

  // Shared buffer instead of a fresh array per call. queryRange appends, hence
  // the reset; sharing is safe because no collision helper runs inside
  // another's loop.
  private _queryComponentScratch(rect: Rectangle): readonly Component[] {
    this._componentScratch.length = 0;
    return this.queryComponentsInRange(rect, this._componentScratch);
  }

  private _queryWireScratch(rect: Rectangle): readonly Wire[] {
    this._wireScratch.length = 0;
    return this.queryWiresInRange(rect, this._wireScratch);
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
    // Drop the termination counts at the old positions, keeping the count map
    // in step with quad-tree membership. Existing dots stay put until the
    // settle pass.
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
    // Destroyed elements are skipped above too, so their counts stay dropped.
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
   * The rotate analog of {@link moveComponent}: direction plus the
   * pivot-orbited position. The component is unindexed around the direction
   * write so its portsChange$ handler skips the automatic, non-undoable wire
   * integration — the rotate action's container replays those changes itself.
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
   * Moves a wire and sets its axis in one step, as a rotate entry lands. The
   * length is rotation-invariant, so it stays untouched.
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
