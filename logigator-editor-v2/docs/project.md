# Project Layer

The project layer is the central owner of all circuit state. `Project` is the root PixiJS scene node (the PixiJS `app.stage`) and the single source of truth for everything on the canvas. `ProjectService` is the Angular-managed wrapper that tracks which projects are currently loaded and which one is active.

## Directory Layout

```
src/app/project/
├── project.ts              # Circuit root — extends InteractionContainer
├── project.service.ts      # Angular service — holds and exposes active project signals
└── selection-manager.ts    # Committed selection state (tint, sets, observables)
```

---

## Core Concepts

### Project as PixiJS stage

`Project` extends `InteractionContainer` (which in turn extends PixiJS `Container`). An instance is created in `AppComponent` and passed as `app.stage` to the PixiJS `Application` inside `BoardComponent`. Everything rendered on the canvas is a descendant of `Project`.

Because `Project` extends `InteractionContainer`, it inherits right-drag panning and mouse-wheel zooming for free. It overrides the three abstract methods (`pan`, `zoomIn`, `zoomOut`) to implement canvas navigation.

### Scene graph layers

The constructor appends two direct children. The background grid is pixel-authored and stays a direct child of `Project`. All circuit content lives inside `_gridSpace`:

```
Project (stage root)
├── Grid                        — infinite background dot grid (pixel-authored)
└── _gridSpace                  — scale = gridSize; coordinates inside are grid units
    ├── QuadTreeContainer<Wire>       — permanent placed wires
    ├── QuadTreeContainer<Component>  — permanent placed components
    ├── ConnectionPointLayer         — derived visual junction markers
    └── FloatingLayer                 — transient in-progress interactions
```

### Coordinate system

All circuit data is stored in **grid units**. The `_gridSpace` container has `scale.set(environment.gridSize)`, so setting a component's `position` to `(5, 3)` in grid units renders at world-pixel `(5 * gridSize, 3 * gridSize)` — no manual conversion is needed. When `Project` is panned or zoomed, only `Project.position` and `Project.scale` change; component and wire positions remain their fixed grid-unit values.

### `_gridSpace` and `gridSpace` getter

`_gridSpace` is the parent of all circuit objects. It is exposed as a public `gridSpace` getter so that `FloatingLayer` can pass it as the reference container to `e.getLocalPosition(this.project.gridSpace)`, converting screen events directly into grid-unit coordinates.

### ActionManager

Every `Project` owns a public `actionManager: ActionManager` field. All circuit mutations (add/remove component or wire) are routed through it so that the operations can be undone and redone. Direct callers never mutate `_components` or `_wires` directly — they always go through `addComponent`, `removeComponent`, `addWire`, or `removeWire`.

### SelectionManager

Every `Project` owns a public `selectionManager: SelectionManager` field. It tracks the currently committed selection — the set of components and wires the user has selected with the rectangle or click selection tools. It is a plain TypeScript class (not an Angular service), constructed directly by `Project`.

`SelectionManager` is a peer of `ActionManager`: both are public, both are owned by `Project`, and neither holds Angular DI references. See the [SelectionManager](#selectionmanager-1) section below for its full API.

### ConnectionPointManager

Every `Project` owns a private `_connectionPoints: ConnectionPointManager` instance, exposed read-only via the `connectionPoints` getter. It is responsible for the small junction dots drawn at half-grid points where ≥3 cardinal directions are filled and at least one element terminates. The manager owns its own scene layer (added to `_gridSpace` between `_components` and `_floatingLayer`).

CPs are not persisted, not selectable, and have no model presence — they are derived visual sugar driven entirely by `Project`'s mutation methods. See [`connection-points.md`](connection-points.md) for the detection rule, manager API, and drag-move semantics.

---

## `Project`

**File:** `project/project.ts`

### Construction

The constructor sets `boundsArea` and `hitArea` to the full coordinate range (so the container always receives pointer events regardless of viewport position), then builds the two-level scene hierarchy: `_grid` added directly, `_gridSpace` (with `scale.set(environment.gridSize)`) added second, and the three circuit sub-layers (`_wires`, `_components`, `_floatingLayer`) added inside `_gridSpace`.

### Viewport

| Method | Description |
|---|---|
| `resizeViewport(w, h)` | Stores the new viewport size and forwards it to `Grid.resizeViewport` |
| `pan(delta)` | Translates by `delta`, calls `setPosition` |
| `setPosition(p)` | Moves `this.position`, calls `Grid.updatePosition`, emits on `positionChange$` |
| `gridPosition` | Computed read-only: the current top-left corner in grid units — `position.multiplyScalar(1 / (scale.x * gridSize))` |
| `gridSpace` | Public getter for `_gridSpace`; needed by `FloatingLayer` for coordinate conversion |

### Zoom

Zoom is implemented as discrete steps. Each step multiplies/divides the scale by `1.2`. The step counter is clamped to `[-12, +5]`, giving a scale range of approximately `1.2^-12 ≈ 0.112` to `1.2^5 ≈ 2.49`.

| Method | Description |
|---|---|
| `zoomIn(center?)` | Increments step, recomputes scale around `center` (defaults to viewport center) |
| `zoomOut(center?)` | Decrements step, same |
| `zoom100(center?)` | Resets step to 0 (scale = 1) |

Pivot-correct zoom is achieved by a matrix chain:

```
translate(-center) → unscale(old) → scale(new) → translate(+center) → apply(this.position)
```

This ensures the point under the mouse stays stationary. After repositioning, `Grid.updateScale` and `FloatingLayer.updateScale` are called, then `applyScale(scale)` is forwarded to every component and wire child.

### Circuit mutation

| Method | Description |
|---|---|
| `addComponent(c)` | Calls `c.applyScale(this.scale.x)`, inserts into `_components` quad tree, fires `connectionPoints.onComponentAdded(...)`, subscribes to `c.portsChange$` so future rotation / input-count changes route through the CP manager, emits `'single'` on `_ticker$` |
| `removeComponent(id)` | Snapshots `connectionPoints` **before** removal, calls `selectionManager.evict(component)`, removes from quad tree, fires `connectionPoints.onComponentRemoved(snapshot)`, unsubscribes from `portsChange$`, destroys |
| `addWire(w)` | Calls `w.applyScale(this.scale.x)`, inserts into `_wires` quad tree, fires `connectionPoints.onWireAdded(Wire.snapshot(w))`, emits `'single'` on `_ticker$` |
| `removeWire(id)` | Snapshots geometry via `Wire.snapshot(wire)` **before** removal, calls `selectionManager.evict(wire)`, removes from quad tree, fires `connectionPoints.onWireRemoved(snapshot)`, destroys |
| `moveComponent(id, pos)` | Snapshots old `connectionPoints`, mutates position, re-inserts (rebuckets), fires `onComponentRemoved(oldPorts)` + `onComponentAdded(newPorts)`. Called by `MoveComponentsAction.do/undo`. |
| `moveWire(id, pos)` | Mirror of `moveComponent` using `Wire.snapshot` for the geometry hooks. Called by `MoveWiresAction.do/undo`. |
| `queryComponentsInRange(rect)` | Generator that yields all components intersecting `rect` (delegates to `_components.queryRange`) |
| `queryWiresInRange(rect)` | Generator that yields all wires intersecting `rect` (delegates to `_wires.queryRange`) |
| `hasComponentCollision(bounds, excludeIds?)` | Returns `true` if any component in the quad tree intersects `bounds`, excluding any whose `id` is in `excludeIds`. Uses `queryComponentsInRange` — no extra check needed because `queryRange` already uses `gridBounds.intersects`. `excludeIds` defaults to an empty set; used by future callers (paste, undo-of-move) where the component being tested is already in the tree. Called by `ComponentPlacementSession` and `SelectionMoveSession` on every `pointermove`. |
| `hasWireBodyCollision(wireBounds, excludeIds?)` | Returns `true` if `wireBounds` intersects the **body** (stub-free AABB) of any component. Does a coarse `queryComponentsInRange` first, then a precise `intersects(comp.bodyGridBounds)` check. A wire endpoint touching a port stub tip correctly returns `false` because the stub-free body starts at the integer grid boundary, and the wire AABB ends exactly at that boundary (strict `>` comparison). Called by `WireDrawingSession` to show red tint and block commit when a preview wire clips through a component body. |
| `computeIntegration(input)` | Pure read — never mutates project state. Takes an `IntegrationInput` describing wires/components being added, removed, or moved, and returns `{ toAdd: Wire[], toRemove: Wire[] }`. `toAdd` contains the fresh wires the caller should insert (splits, merges, surviving addedWires); `toRemove` contains the live tree wires that should leave (absorbed by merges or replaced by splits). Callers wrap the result in `ActionContainer(RemoveWiresAction, AddWiresAction)` alongside their primary action so the whole gesture — including any splits/merges — undoes atomically. Runs from `WireDrawingSession.onEnd`, `SelectionMoveSession.onEnd`, `ComponentPlacementSession.onEnd`, and the `portsChange$` subscription (for rotation). See [Wire Integration Invariants](wires.md#wire-integration-invariants). |
| `connectionPoints` | Getter — returns the `ConnectionPointManager`. Used by `SelectionMoveSession` (drag-follow CP capture/discard/restore) and by tests. See [`connection-points.md`](connection-points.md). |

`applyScale` is called on add because the project may already be at a non-1 zoom level when an element is inserted (e.g., on undo/redo while zoomed in).

`evict` is called in `removeComponent`/`removeWire` **before** `destroy()`. This prevents `SelectionManager` from holding a stale reference to a destroyed `Container`.

**Mutation ordering for the CP manager:** every removal path snapshots geometry (`Wire.snapshot` / `component.connectionPoints`) **before** mutating the quad tree, then runs the recompute *after* the tree reflects the post-state. Symmetric for adds. This ordering is critical — the CP manager queries the quad trees to make its decisions.

### Drag operations

These methods are used exclusively by `FloatingLayer` during selection drag-move. They operate directly on the quad trees without going through the action system — the caller is responsible for pushing undo actions separately.

| Method | Description |
|---|---|
| `detachForDrag(components, wires)` | Removes elements from their quad trees. Elements keep their position and visual state; the caller reparents them into `FloatingLayer._dragLayer`. **Does not fire CP hooks** — CPs are intentionally frozen during the drag; `SelectionMoveSession` uses `connectionPoints.captureDragCps` to make termination-point CPs follow the drag. |
| `reattachFromDrag(components, wires)` | Re-inserts elements back into their quad trees at their current positions. Skips `destroyed` elements (defensive guard). **Does not fire CP hooks** — the session calls `connectionPoints.recomputeCpsForMovedSelection` once after reattach. |

`QuadTreeContainer.insert()` already handles the case where an element is already tracked — it removes then re-inserts. `moveComponent`/`moveWire` (listed in the Circuit mutation table above) take advantage of this: they set the position then call `insert()` unconditionally.

### Work mode

`Project` exposes `mode` and `componentToPlace` as getters/setters that delegate to `FloatingLayer`. This lets `BoardComponent` configure the interaction mode without holding a direct reference to the internal `FloatingLayer`.

### Reactive outputs

| Observable / Signal | Type | Description |
|---|---|---|
| `positionChange$` | `Observable<Point>` | Emits the new `gridPosition` on every pan or zoom; throttled to ~30 fps by `BoardComponent` before being relayed to the status bar |
| `ticker$` (inherited) | `Observable<'single' \| 'on' \| 'off'>` | Ticker control stream consumed by `BoardComponent` to drive `app.ticker` |

---

## `ProjectService`

**File:** `project/project.service.ts`

Angular root-provided singleton. Tracks up to three states using Angular `signal`s exposed as read-only `computed` values:

| Signal | Type | Description |
|---|---|---|
| `mainProject` | `Project \| null` | The top-level project (the user's circuit file). Set once on startup via `setMainProject`. Setting it also sets `activeProject`. |
| `openComponents` | `Project[]` | Sub-projects opened as component editors. Each custom component the user drills into is a separate `Project` pushed here. |
| `activeProject` | `Project \| null` | The project currently shown in the canvas. Defaults to `mainProject`; switches when the user opens a sub-component. Reverts to `mainProject` when that sub-component is closed. |

### Methods

| Method | Description |
|---|---|
| `setMainProject(p)` | Sets `mainProject` and `activeProject` to `p` |
| `addOpenComponent(p)` | Appends `p` to `openComponents` |
| `removeOpenComponent(p)` | Removes `p` from `openComponents`; if `p` was `activeProject`, reverts `activeProject` to `mainProject` |

`AppComponent` reads `projectService.activeProject()` to pass the correct `Project` to `BoardComponent` as an input. `BoardComponent` reacts to input changes via an Angular `effect`.

---

## Integration with the rest of the app

| Consuming layer | How it uses `Project` / `ProjectService` |
|---|---|
| `AppComponent` | Creates the initial `Project` in its constructor (`new Project()`), calls `projectService.setMainProject`. Reads `activeProject()` to feed `BoardComponent`. |
| `BoardComponent` | Receives `Project` as an `input()`. Sets it as `app.stage`. Subscribes to `ticker$` and `positionChange$`. Forwards work-mode signals via `effect`. |
| `FloatingLayer` | Holds a direct reference to its parent `Project`. Reads `project.mode`, `project.componentToPlace`, `project.scale`, `project.gridSpace`. Calls `project.actionManager.push(...)` on commit, `project.selectionManager.commit/clear/containsPoint` for selection, and `project.detachForDrag/reattachFromDrag` for drag-move. |
| `ActionManager` | Owned by `Project` as `project.actionManager`. All action `do`/`undo` implementations receive the `Project` and call `addComponent`, `removeComponent`, `addWire`, `removeWire`, `moveComponent`, or `moveWire`. |
| `SelectionManager` | Owned by `Project` as `project.selectionManager`. `FloatingLayer` calls `commit`, `clear`, `containsPoint`, and reads `selectedComponents`/`selectedWires`. `Project.removeComponent`/`removeWire` call `evict` before destroying elements. |
| `Grid` | Owned by `Project`. Receives `updatePosition`, `resizeViewport`, and `updateScale` calls. |

---

## Lifecycle

```
AppComponent constructor
  └── setStaticDIInjector(injector)      // must happen before any Component/Wire is created
  └── new Project()                      // constructs Grid, FloatingLayer, etc.
  └── projectService.setMainProject(p)

BoardComponent ngOnInit
  └── assetsService.init()               // loads fonts
  └── app.init(...)                      // creates PixiJS Application (WebGPU preferred)

BoardComponent effect (project input changes)
  └── project.resizeViewport(w, h)
  └── app.stage = project
  └── subscribe project.ticker$
  └── subscribe project.positionChange$

BoardComponent effect (WorkModeService signals change)
  └── project.mode = workModeService.mode()
  └── project.componentToPlace = workModeService.selectedComponentConfig()
```

---

## `SelectionManager`

**File:** `project/selection-manager.ts`

Plain TypeScript class. Constructed by `Project`; not an Angular service. Owns the committed selection state that persists across pointer interactions until the user explicitly clears it (mode change, Escape, click on empty space, or undo).

### State

| Field | Type | Purpose |
|---|---|---|
| `_selectedComponents` | `Set<Component>` | Live references to currently selected components |
| `_selectedWires` | `Set<Wire>` | Live references to currently selected wires |
| `_selectionChange$` | `Subject<void>` | Emits whenever the selection changes |
| `SELECTION_TINT` (static) | `0x5577aa` | Dark-blue tint applied to selected elements; distinct from the `0xbbbbbb` placement-ghost tint |

### Public API

| Member | Description |
|---|---|
| `commit(rect, mode)` | Dispatch: zero-area rect → single-click hit test; non-zero rect → rectangle selection. Clears the previous selection first. |
| `clear()` | Resets tint to `0xffffff` on every selected element, empties both sets, emits `selectionChange$`. |
| `evict(element)` | Called from `Project.removeComponent`/`removeWire` before `destroy()`. Drops the ref without touching tint (the element is about to be destroyed). Emits if present. |
| `containsPoint(gridPoint)` | Returns `true` if any selected element's `gridBounds` contains the point. Used by `FloatingLayer` to decide whether a `pointerdown` in SELECT mode should start a drag-move of the existing selection or open a new rect drag. |
| `boundingBox()` | Union AABB of all selected elements' `gridBounds`. Returns `null` when empty. Used for computing the drag offset at drag start. |
| `isEmpty` | `true` when both sets are empty. |
| `selectionChange$` | The subject exposed as `Observable<void>`. |
| `selectedComponents` | `ReadonlySet<Component>` — live references. |
| `selectedWires` | `ReadonlySet<Wire>` — live references. |

### `commit` behavior

**Rectangle drag** (`rect.width > 0 || rect.height > 0`):
1. Calls `clear()` to remove old tints.
2. Queries `project.queryComponentsInRange(rect)` and tints every result with `SELECTION_TINT` — both modes use the same touching rule for components.
3. **`SELECT` mode**: Queries `project.queryWiresInRange(rect)` and tints every result.
4. **`SELECT_EXACT` mode** (scissor select): For each wire returned by `queryWiresInRange(rect)`, calls `cutWire(wire, rect)` (see `wires.md` § *Wire Scissor Cutting*). The result is one of `{kind: 'skip'}` (centerline outside rect — do not select), `{kind: 'keep'}` (no cut needed — select as-is), or `{kind: 'cut', pieces, insideIndex}`. For `cut` results, the cut is performed **tentatively**: the manager calls `project.removeWire` on the original and `project.addWire` on each new piece directly, then records the rollback data in `_pendingCut`. **Nothing is pushed to `ActionManager` at commit time.** The inside pieces are tinted and added to the selection set by ID. The tentative cut is finalized only on a real modification — `SelectionMoveSession.onEnd` with `hasMove === true` calls `selectionManager.claimPendingCut()` and folds the returned `ActionContainer(RemoveWiresAction, AddWiresAction)` into its own move container so cut + move are one Ctrl+Z. Any cancel path (`clear()`, mode change, Escape, Ctrl+Z while pending) calls `_rollbackPendingCutInternal` which removes the new pieces and re-adds the originals. See `wires.md` § *Tentative cut + commit on move* for the full lifecycle.
5. Emits `selectionChange$` once at the end.

**Single click** (`rect.width === 0 && rect.height === 0`):
1. Calls `clear()`.
2. Builds a 1×1 grid-unit query rect centered on the click point to work around a PixiJS `Rectangle.intersects()` limitation with zero-area rects.
3. Queries both trees; post-filters with `gridBounds.contains(px, py)` to remove false positives.
4. Tie-breaks when both a component and a wire match: the one with the smaller `gridBounds` area wins (more precisely-aimed target).
5. Tints and adds the winner (if any); emits. Empty result = "click on empty space" = selection cleared.

### Destroyed-element guards

`clear()`, `containsPoint()`, and `boundingBox()` all skip elements where `element.destroyed === true`. This is a defensive guard for the edge case where an element is destroyed via a path other than `Project.removeComponent`/`removeWire` (which always call `evict` first).

---

## Type Hierarchy

```
PixiJS Container
└── InteractionContainer (abstract)
    └── Project

SelectionManager  (plain class, owned by Project)
```