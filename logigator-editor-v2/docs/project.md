# Project Layer

The project layer is the central owner of all circuit state. `Project` is the root PixiJS scene node (the PixiJS `app.stage`) and the single source of truth for everything on the canvas. `ProjectService` is the Angular-managed wrapper that tracks which projects are currently loaded and which one is active.

## Directory Layout

```
src/app/project/
├── project.ts          # Circuit root — extends InteractionContainer
└── project.service.ts  # Angular service — holds and exposes active project signals
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
    └── FloatingLayer                 — transient in-progress interactions
```

### Coordinate system

All circuit data is stored in **grid units**. The `_gridSpace` container has `scale.set(environment.gridSize)`, so setting a component's `position` to `(5, 3)` in grid units renders at world-pixel `(5 * gridSize, 3 * gridSize)` — no manual conversion is needed. When `Project` is panned or zoomed, only `Project.position` and `Project.scale` change; component and wire positions remain their fixed grid-unit values.

### `_gridSpace` and `gridSpace` getter

`_gridSpace` is the parent of all circuit objects. It is exposed as a public `gridSpace` getter so that `FloatingLayer` can pass it as the reference container to `e.getLocalPosition(this.project.gridSpace)`, converting screen events directly into grid-unit coordinates.

### ActionManager

Every `Project` owns a public `actionManager: ActionManager` field. All circuit mutations (add/remove component or wire) are routed through it so that the operations can be undone and redone. Direct callers never mutate `_components` or `_wires` directly — they always go through `addComponent`, `removeComponent`, `addWire`, or `removeWire`.

### ActionManager

Every `Project` owns a public `actionManager: ActionManager` field. All circuit mutations (add/remove component or wire) are routed through it so that the operations can be undone and redone. Direct callers never mutate `_components` or `_wires` directly — they always go through `addComponent`, `removeComponent`, `addWire`, or `removeWire`.

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
| `addComponent(c)` | Calls `c.applyScale(this.scale.x)`, inserts into `_components` quad tree, emits `'single'` on `_ticker$` |
| `removeComponent(id)` | Finds the component by ID in `_components.items`, removes it from the quad tree, destroys it |
| `addWire(w)` | Calls `w.applyScale(this.scale.x)`, inserts into `_wires` quad tree, emits `'single'` on `_ticker$` |
| `removeWire(id)` | Finds the wire by ID in `_wires.items`, removes it from the quad tree, destroys it |

`applyScale` is called on add because the project may already be at a non-1 zoom level when an element is inserted (e.g., on undo/redo while zoomed in).

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
| `FloatingLayer` | Holds a direct reference to its parent `Project`. Reads `project.mode`, `project.componentToPlace`, `project.scale`, `project.gridSpace`, and calls `project.actionManager.push(...)` on commit. |
| `ActionManager` | Owned by `Project` as `project.actionManager`. All action `do`/`undo` implementations receive the `Project` and call `addComponent`, `removeComponent`, `addWire`, or `removeWire`. |
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

## Type Hierarchy

```
PixiJS Container
└── InteractionContainer (abstract)
    └── Project
```