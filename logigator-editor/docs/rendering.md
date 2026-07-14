# Rendering Layer

The rendering layer owns the PixiJS renderer, the scene graph structure, viewport interaction, spatial indexing, shared graphics caching, and transient/floating UI elements. `Project` (a plain PixiJS `Container`) is the root of the scene and orchestrates all sub-layers. The whole app draws through **one** shared renderer (`RendererService`); every visible canvas — the board, each open watch — is a render _target_ of it, and offscreen consumers (minimap, image export, previews) render into textures on it. Canvas input never goes through PixiJS events — the `interaction/` layer listens to plain DOM pointer events (see below), and the shared renderer's own event features are disabled at creation.

## Directory Layout

```
src/app/rendering/
├── assets.service.ts               # PixiJS Assets bootstrap (fonts)
├── board-snapshot.service.ts       # Offscreen render-to-texture (image export, previews, minimap)
├── renderer.service.ts             # The single lease-counted renderer shared by every canvas
├── ticker-scheduler.ts             # Translates project ticker signals into board frames
├── drag-collision.ts               # Shared collision detection for drag sessions
├── drag-session.ts                 # DragSession interface implemented by all session classes
├── floating-layer.ts               # Visual host: drag-session ghosts + wire-tool hover previews
├── graphics-provider.service.ts    # Shared GraphicsContext cache
├── grid.ts                         # Infinite-seeming background grid
├── quad-tree-container.ts          # Spatial index for efficient range queries
├── interaction/
│   ├── pointer-input.ts            # PointerInput sample + canvasToGrid viewport mapping
│   ├── pointer-controller.ts       # Per-canvas DOM listener: capture, buttons, wheel, gestures
│   └── work-mode-router.ts         # Mode → DragSession dispatch + session lifecycle
├── graphics/
│   ├── component.graphics.ts       # GraphicsContext for component body outline
│   ├── connection-point.graphics.ts # GraphicsContext for a CP dot
│   ├── grid.graphics.ts            # GraphicsContext for a grid chunk tile
│   └── wire.graphics.ts            # GraphicsContext for a wire segment
└── sessions/
    ├── component-placement.session.ts  # Ghost component drag → AddComponentsAction
    ├── paste-placement.session.ts      # Paste preview drag → AddComponentsAction/AddWiresAction
    ├── select-rect.session.ts          # Rubber-band rect → selectionManager.commit()
    ├── selection-move.session.ts       # Drag selected elements → MoveComponentsAction/MoveWiresAction
    └── wire-tool.session.ts         # L-shaped wire preview → AddWiresAction
```

---

## Core Concepts

### Pixel vs. grid coordinates

All circuit data is stored in **grid units**. The `_gridSpace` container in `Project` has `scale.set(environment.gridSize)`, so any object added to `_gridSpace` with `position.set(gx, gy)` renders at world-pixel `(gx * gridSize, gy * gridSize)`. No manual conversion is needed at the model layer. The remaining helper in `utils/grid.ts` is `fromGrid(n)` (`n * gridSize`), used only inside `Component._visualSpace` and the background grid where geometry is still pixel-authored. Wire endpoints sit on **half-grid** positions (e.g., 0.5, 1.5) so that connection pins align with the midpoints of cell edges.

### Ticker control

`BoardComponent` owns a plain PixiJS `Ticker` (never auto-started) whose frame callback culls and blits the active project through the shared renderer. Rendering frames are emitted on demand via the `_ticker$` Subject exposed as `ticker$` on `Project`. Three signal values control the ticker: `'single'` fires one frame (for state changes that don't involve continuous motion), `'on'` starts continuous rendering (during pointer drags), and `'off'` fires one final frame then stops. `TickerScheduler` (see below) consumes these signals and turns them into renders.

### Scene graph order inside `Project`

```
Project (stage root)
├── Grid                                    (pixel-authored, outside gridSpace)
└── _gridSpace  (scale = gridSize)
    ├── QuadTreeContainer<Wire>  (_wires)
    ├── QuadTreeContainer<Component>  (_components)
    ├── ConnectionPointLayer  (_connectionPoints.layer, see connection-points.md)
    └── FloatingLayer
```

`Project` is the render root the board blits each frame (`renderer.render({ container: project, target: canvas })`), so its own transform — the pan/zoom — applies at render time. The background grid is pixel-authored and stays a direct child of `Project`. All circuit content lives inside `_gridSpace` so that setting `position = (gx, gy)` on any circuit object automatically places it at the correct world-pixel location without conversion.

---

## `interaction/` — DOM input layer

Canvas input is plain DOM: no scene node is interactive, and all element hit tests are manual quad-tree queries. The same two classes drive the board and every sub-circuit watch canvas — all targets of the one shared renderer, whose own event features are disabled.

### `PointerController`

**File:** `interaction/pointer-controller.ts`

Per-canvas listener bundle (pointerdown/move/up/cancel, wheel, contextmenu — detached via one `AbortController` in `destroy()`). It normalizes every event into a `PointerInput` — `{ pointerId, pointerType, global, grid }`, where `global` is canvas-local CSS pixels (the space `Project.pan`/`zoomBy` expect) and `grid` is the same point mapped through `canvasToGrid` (reads `project.position`/`scale` directly; fresh even before the next render, and valid because `Project` sits at the stage root). Routing:

- **Primary button** — captured via `setPointerCapture` (moves keep flowing when a drag leaves the canvas) and streamed to the `PointerToolTarget` (`down`/`move`/`up`/`cancel`); moves with no pressed pointer go to `hover`. Click-vs-drag semantics live in the sessions (`PanSession`'s 5 px threshold), not the controller.
- **Right button** — pan-only drag by successive position deltas, bracketed by `nav.setActive(true/false)` (ticker on/off on the board). The canvas context menu is suppressed outright.
- **Touch** — pointers feed the `MultiTouchGesture` first; when a second finger lands the gesture takes over (two-finger pan + pinch via `nav.pan`/`nav.zoomBy`) and the tool stream is cancelled, so a finger never both operates a tool and navigates.
- **Wheel** — `nav.zoomIn/zoomOut` at the cursor; registered non-passive so `preventDefault` stops page scroll/zoom.

The `PointerNavTarget` is supplied by the host: the board maps it straight onto the active project (+ ticker), the watch wraps `pan` to re-blit explicitly. An optional `onCursorMove` callback reports per-move grid positions (the board feeds its status-bar output from it). Handlers are public, so specs drive them with plain objects instead of synthesized DOM events.

### `WorkModeRouter`

**File:** `interaction/work-mode-router.ts`

The board's `PointerToolTarget`. Owns the interaction state that used to live on `FloatingLayer`: the current `WorkMode`, the `componentToPlace` config, and the single `_activeDrag: DragSession | null`.

- `down(input)` switches on the mode and starts the matching session (`PanSession`, `ComponentPlacementSession`, `WireToolSession`, `SelectRectSession`/`SelectionMoveSession`, `EraseSession`). Tap actions ride on session tap callbacks: a `WireToolSession` press that never moved a grid step fires the router's `_wireTap` (port negation through the undo stack, else `Project.toggleConnectionAt`); SIMULATION taps route through a `PanSession` whose tap action activates a button/switch or requests inspection.
- `move(input)` delegates to `_activeDrag.onMove`; with no session it falls through to `hover` (the wire tool’s tap previews: the negation bubble over a port, the connection ghost over a toggleable junction — `Project.connectionToggleKindAt` dry-runs the join plan so non-toggleable T-junctions show nothing). The previews survive a press and hide only when the gesture becomes a drag (`WireToolSession` hides them on its first real move).
- `up()` asks `session.canEnd()` first — `false` (collision) keeps the session alive; `true` commits via `onEnd()` and stops the drag ticker.
- `cancel()` / Escape (a `ShortcutService` subscription) abort the session via `onCancel()`.
- `setProject(project)` re-homes the router on tab switches: cancels any in-flight session on the old project, hides the wire-tool ghosts, resubscribes to the new project's `pasteRequest$`, and clears the new selection.
- Paste: `ClipboardService` calls `Project.startPasteSession`, which emits on `pasteRequest$`; the router opens the `PastePlacementSession` in the project's floating layer.

Sessions receive `project.floatingLayer.dragLayer` (or the floating layer itself for the select rect) to parent their ghosts; drag starts/stops emit `'on'`/`'off'` on the project ticker.

---

## `TickerScheduler`

**File:** `ticker-scheduler.ts`

Translates a project's `ticker$` signals into frames of the board's render ticker. `BoardComponent` constructs one per project (passing its `Ticker` and `project.ticker$`) and `destroy()`s it on project switch and on component teardown, so a project's run-count and any queued frame never leak across stages.

| Signal     | Effect                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `'on'`     | Increments the run-count and `ticker.start()` — continuous rendering.                           |
| `'off'`    | Decrements; at zero, cancels any queued single frame, fires one final `ticker.update()`, stops. |
| `'single'` | While the run-count is zero, schedules one render (see coalescing below); otherwise a no-op.    |

**Reference-counted run-count** — any number of concerns (a simulation run, a pan, a drag session) can hold the continuous ticker on at once via `'on'`/`'off'`; it stops only once the last one releases. Without this, a transient interaction's `'off'` (e.g. finishing a pan) would stop the ticker a running simulation still needs. While the run-count is non-zero the board already renders every frame, so `'single'` signals are ignored.

**`'single'` coalescing** — a single user operation can emit many `'single'` signals synchronously (e.g. undoing a move re-positions N elements, each calling `triggerTicker('single')`); rendering once per signal would do N full-board renders for one frame's worth of change. The scheduler collapses them onto **one** `requestAnimationFrame`-driven render: the first `'single'` queues a frame, subsequent ones are no-ops until it fires, and the rAF callback re-checks the run-count (a run may have started while it was queued, in which case it already renders). The result is that we never draw more frames than the display can show, regardless of signal count — while preserving the stop-when-idle property (no always-running rAF loop).

> Renders are therefore deferred to the next animation frame (≤ ~16 ms) rather than fully synchronous. For an interactive editor this is imperceptible, but code must not assume the canvas is visually up-to-date in the same synchronous tick as a `'single'` emit.

---

## `RendererService`

**File:** `renderer.service.ts`

Owns the app's **single** PixiJS renderer. Every canvas (board, watches) leases it via `acquire()` and blits through `lease.render(container, canvas)`; offscreen consumers (`BoardSnapshotService`, and the minimap through it) read the `renderer` getter directly and gate on the `available` signal instead of leasing — they only ever render while a canvas host is alive.

- **Lifecycle** — created lazily on the first lease (`autoDetectRenderer`, `webgpu` → `webgl` → `canvas` ladder), destroyed when the last lease releases. In practice the board holds a lease for its whole lifetime, so the renderer lives as long as a board is mounted; `available` flips true once it boots.
- **Multi-canvas** — WebGPU and Canvas drive multiple target canvases natively; the WebGL branch is created with `multiView` (an off-DOM master canvas sized to the largest target, blitted to each target canvas per render — one extra copy per frame on that backend only).
- **`lease.render`** sizes the target's backing store through its cached `CanvasSource` (CSS box × device pixel ratio — never via `canvas.width`, which would desync pixi's cached render target), then renders with the theme background as clear color. Render space stays in CSS pixels; the DPR only sharpens the backing store.
- **Culling is the caller's concern** — the board culls its project against its viewport before rendering; watch canvases and offscreen snapshots instead force their subtree visible via the exported `uncullTree` helper, since no cull pass runs for them and stale `culled` bits from another view would hide content.

---

## `Project`

**File:** `project/project.ts` — extends `Container`

Owns all circuit state and sub-layers. Not strictly part of `rendering/` but is the composition root that consumes every rendering class. Exposes `ticker$`/`triggerTicker` (render-loop signals) and `pasteRequest$` (consumed by the `WorkModeRouter`).

Key behaviours relevant to rendering:

| Method                   | Effect                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizeViewport(w, h)`   | Forwards to `Grid.resizeViewport`                                                                                                                                                           |
| `setPosition(p)`         | Moves self, forwards to `Grid.updatePosition`, emits `positionChange$`                                                                                                                      |
| `zoomIn/zoomOut`         | Applies `1.2^step` scale, repositions around center, calls `Grid.updateScale`, `FloatingLayer.updateScale`, `ConnectionPointLayer.applyScale`, and `applyScale` on every component and wire |
| `addComponent / addWire` | Appends to `_components` / `_wires`, calls `applyScale`, fires the matching `ConnectionPointManager` hook, emits `'single'`                                                                 |

Zoom is clamped to ±12 steps (scale range roughly `1.2^-12` to `1.2^5`). Pivot-correct zoom uses a matrix chain to keep the pixel under the mouse stationary.

---

## `Grid`

**File:** `grid.ts`

Renders an infinite-looking dot grid by tiling fixed-size `Graphics` chunks. Chunks share a single `GraphicsContext` (via `GraphicsProviderService`) per `(chunkSize, scale)` pair.

**Chunk size:** 32 grid units (512 px at scale 1).

**Tiling strategy:** `draw()` creates or repositions `Graphics` instances in a grid from `(0, 0)` to `(viewportWidth/scale + chunkSize, viewportHeight/scale + chunkSize)`. Surplus chunks are destroyed. The `Container` itself is offset by `chunkAligned(-position/scale)` so that panning shifts the chunk grid modulo one chunk size — the grid appears to scroll continuously while only a viewport-filling set of chunks exists.

The pivot is set to `chunkSizePx` so the offset math lands on chunk boundaries correctly.

`updateScale` reuses the existing chunks, swapping each one's `GraphicsContext` to the new-scale geometry (the context bakes a different scale into its stroke widths — dots are `1/scale × 1/scale` pixels so they stay 1 screen pixel regardless of zoom) rather than destroying and rebuilding the whole set. At zoom < 0.25 the dot alpha is reduced to 0.5.

**API:**

| Method                 | When called                                        |
| ---------------------- | -------------------------------------------------- |
| `updatePosition(pos)`  | Every pan step (called from `Project.setPosition`) |
| `resizeViewport(size)` | Window resize                                      |
| `updateScale(scale)`   | Every zoom step                                    |

---

## `FloatingLayer`

**File:** `floating-layer.ts`

A full-screen PixiJS `Container` that lives inside `_gridSpace` and sits above the permanent circuit layers. Purely visual: it hosts the transient overlay elements of in-progress interactions, while input routing and session lifecycle live in the `WorkModeRouter`. Because it lives in `_gridSpace`, coordinates are in grid units automatically.

### Internal children

| Field                 | Type                           | Purpose                                                                                                   |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `_dragLayer`          | `Container<Component \| Wire>` | Ghosts during placement/paste **and** detached selected elements during drag-move; exposed as `dragLayer` |
| `_negationHoverGhost` | `Graphics`                     | Lazily-created negation preview bubble, driven via `showNegationGhost(anchor)` / `hideNegationGhost()`    |

`_selectRect` (`Graphics`) is a **transient** child added to and removed from `FloatingLayer` by `SelectRectSession`.

### Coordinate conversion

Sessions receive grid-space positions precomputed on the `PointerInput` (`input.grid`, mapped by `canvasToGrid`), snapped with `roundToGrid` (full-grid) or `roundToHalfGrid` (half-grid) from `utils/grid.ts`.

**Paste placement** bypasses the work-mode switch: the router opens a `PastePlacementSession` in hover mode (`isDragging = false`) on a project's `pasteRequest$`. In hover mode, the ghosts do not follow the cursor — the pasted elements sit where they were placed (original clipboard position + `PASTE_OFFSET`). The router's `down` detects an active-but-non-dragging `PastePlacementSession`: if the click hits a ghost element's bounds, `beginDrag()` is called and subsequent moves drag the group on a grid-snapped cursor. If the click falls outside the ghost group, the session is cancelled (the fresh instances are destroyed).

### Session classes

Each session lives in `rendering/sessions/` and implements `DragSession` (`onMove(input: PointerInput)`, `onEnd`, `onCancel`, `canEnd`).

**`DragSession.canEnd()`** — called by `WorkModeRouter.up` before committing. Return `false` to keep the session alive (collision block or silent-discard). `WireToolSession` and `SelectRectSession` always return `true`. Collision sessions return `!_hasCollision`.

**`ComponentPlacementSession`** — creates a ghost `Component` (wearing the selection look: `selected = true`, i.e. the theme's `selectTint`) in `_dragLayer`. `_dragLayer.position` tracks the grid-snapped pointer. On construction and on every `onMove`, calls `project.hasComponentCollision` with the ghost's world `gridBounds` (`dragLayer.position + component.gridBounds` offsets). Collision tints `_component` with the theme's `invalid` color; clearing calls `refreshTint()` to restore the ghost tint. `canEnd()` returns `false` while colliding — `pointerup` is ignored and the ghost stays live. On `onEnd()`, the component's world position is set from `_dragLayer.position`, then `AddComponentsAction` is pushed (serializes the ghost) and the ghost is destroyed. `_dragLayer.position` is reset to zero.

**`SelectionMoveSession`** — snapshots the selection, calls `project.detachForDrag`, and reparents elements into `_dragLayer`. `onMove` sets `_dragLayer.position` to the grid-snapped delta from the drag start and runs `project.hasComponentCollision` for each dragged component against the fixed quad tree. Collision tints each dragged element with the theme's `invalid` color; clearing calls `refreshTint()` on each (see `DragCollisionState`). `canEnd()` returns `false` while colliding. `onEnd` (which requires `canEnd() === true`) applies the delta to each element's own position, resets `_dragLayer.position` and the collision tint, calls `project.reattachFromDrag`, and if the delta was non-zero pushes `MoveComponentsAction`/`MoveWiresAction` wrapped in an `ActionContainer`. `onCancel` resets position and tint before reattaching — always safe regardless of collision state.

**`WireToolSession`** — `_wirePreview.position` is the half-grid-snapped start point. Two `Wire` objects (horizontal + vertical) are created lazily on first movement and sized to form an L-shape. The drag direction is locked to whichever axis moved first. `getLocalPosition(_wirePreview)` gives the delta from the start in grid units, which drives wire lengths/positions. On `onEnd()`, non-zero wires have the start position added to their local positions (converting to world grid coords), then `AddWiresAction` is pushed and preview wires are destroyed.

**`SelectRectSession`** — adds `_selectRect` to `FloatingLayer` at the click's grid position. `onMove` sets `_selectRect.scale` to the grid-unit delta from start (negative values handle reverse drags). `onEnd` normalizes the rect to a canonical `Rectangle` (always positive width/height), removes `_selectRect`, and calls `project.selectionManager.commit(rect, mode)`. A zero-area rect (no movement) reaches the selection manager unchanged and is handled as a single-click hit test.

**`PastePlacementSession`** — created by `FloatingLayer.startPasteSession()` when the user invokes paste. Receives pre-deserialized `Component[]` and `Wire[]` (fresh instances with new IDs and positions already offset by `PASTE_OFFSET = 2` grid units). Elements are added to `_dragLayer` with `selected = true` — the ghosts wear the selection look, which carries over seamlessly when `select()` keeps them selected on commit. Two-phase interaction:

1. **Hover phase** (`isDragging = false`) — elements sit at their initial positions. `onMove` is a no-op. The user can click on a ghost to begin dragging, or click off the ghosts to commit immediately at the initial position.
2. **Drag phase** (`isDragging = true`) — after `beginDrag(anchor)`, `onMove` sets `_dragLayer.position` to the grid-snapped cursor delta from the anchor. Collision is checked after every move via `DragCollisionState`.

`canEnd()` returns `false` while colliding — `pointerup` is ignored and the ghosts stay live. `onEnd()` applies the `_dragLayer` delta to each element's position, resets `_dragLayer.position` and tint, transfers elements to the project via `addComponent`/`addWire`, wraps them in an `ActionContainer(AddComponentsAction, AddWiresAction)`, calls `selectionManager.select()` to select the pasted elements, and registers the action (state already applied — no `do()` call). `onCancel()` destroys all ghost components and wires without adding them to the project.

### `DragCollisionState`

**File:** `drag-collision.ts`

Shared collision detection extracted from `SelectionMoveSession` and reused by `PastePlacementSession`. Constructed with the project, drag layer, and the moving components/wires arrays. On each `update()`, computes world-space bounds (`gridBounds + dragLayer.position`) for each element and checks:

- Component–component collision via `project.hasComponentCollision(bounds, bodyBounds)`.
- Component–wire body collision via `project.hasComponentBodyWireCollision(bodyBounds, …)`.
- Wire–component body collision via `project.hasWireBodyCollision(bounds)`.

Tints every element in `_dragLayer` (including captured junction dots) with the theme's `invalid` color on collision, and restores their own tints via `refreshTint()` otherwise. The elements are tinted directly rather than through the drag layer: a container tint multiplies with the children's own tints (wires carry their color AS tint over a white base), which would darken the invalid red toward black. Only emits tint changes when the collision state actually flips, avoiding redundant GPU updates. `reset()` restores the elements' own tints; sessions call it before reattaching or committing so a cancel mid-collision does not leak the invalid tint back onto the board.

`ComponentPlacementSession` keeps its own inline collision check because it manages a single component with direct tint control on the ghost rather than on a shared drag layer.

### Collision tint convention

| Value                       | Meaning                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| selection look (`selected`) | Placement/paste ghost default — the theme's `selectTint` / `wireSelectColor` |
| theme `invalid`             | Collision — applied per element, never on the drag layer                     |
| `refreshTint()`             | Neutral — each element re-derives its own theme/selection tint               |

### `updateScale(scale)`

Called from `Project.updateScale`. Forwards `applyScale(scale)` to every element in `_wirePreview` and `_dragLayer`. The `_dragLayer` case is critical: during a selection-move drag, selected elements are detached from the quad trees and absent from `project._components.items` / `project._wires.items`, so `Project.updateScale` would miss them without this extra iteration. During component placement the ghost component in `_dragLayer` is also caught here.

---

## `QuadTreeContainer<T extends GridElement>`

**File:** `quad-tree-container.ts`

A generic PixiJS `Container` subclass that maintains a spatial quad tree over its children. Used as `_wires` and `_components` in `Project`. The generic constraint requires `T` to implement the `GridElement` interface (`readonly gridBounds: Rectangle`), ensuring the tree never calls PixiJS bounds APIs — it reads from `gridBounds` directly.

### `GridElement` interface

Defined in `grid-element.ts`. Extends `ContainerChild` with:

- `gridBounds: Rectangle` — the element's axis-aligned bounding box in grid units.

`Connectable` further extends `GridElement` with `connectionPoints: Point[]`. Both `Component` and `Wire` implement `Connectable`.

### Tree structure

The tree is composed of `QuadTreeEntry<T>` nodes (not exported). Each entry covers a square region and holds:

- `branchItems` — elements whose bounds **straddle** a quadrant boundary (cannot be placed in any child).
- `leafItems` — elements fully contained within this node; `null` once the node has been split into branches.
- `branches` — four child `QuadTreeEntry` nodes (`nw`, `ne`, `sw`, `se`); `null` while the node is still a leaf.

All `QuadTreeEntry` instances live at position `(0, 0)` in the scene graph. Their spatial region is encoded in `boundsArea` only — this means reparenting an element between entries never shifts its world coordinates.

### Constants

| Constant              | Value | Meaning                                                             |
| --------------------- | ----- | ------------------------------------------------------------------- |
| `INITIAL_SIZE`        | 64    | Root entry covers `(0, 0, 64, 64)` grid units at construction       |
| `MAX_LEAF_ELEMENTS`   | 4     | A leaf with this many elements splits on the next insert            |
| `MIN_BRANCH_ELEMENTS` | 2     | A branch with fewer total descendants collapses on remove           |
| `MIN_LEAF_SIZE`       | 1     | Leaves of 1 grid cell are never split (prevents infinite recursion) |

The `INITIAL_SIZE` of 64 grid units covers a typical small circuit without any tree expansion. The old pixel-domain value of 1024 covered only ~50 grid cells at `gridSize = 16`.

### `insert(element: T)`

1. If the element is already tracked, removes it first (handles re-insertion after position change).
2. Reads `element.gridBounds` and calls `expand()` in a loop until the bounds fit inside the root.
3. Walks the tree from the root. At each node, `getContainingQuadrant` checks whether the element fits entirely inside one of the four child rectangles. If not, the element is placed in `branchItems` of the current node. If yes, descend; split if the leaf is full and large enough.

### `remove(element: T): boolean`

Looks up the entry via the `items` Map, removes the element from either `branchItems` or `leafItems`, then calls `minifyBranch` on the entry's parent to potentially collapse the tree. Returns `false` if not found.

### `queryRange(range: Rectangle): Generator<T>`

Recursive generator. For each entry:

1. Yields `branchItems` children whose `gridBounds` **intersects** `range` (including partial overlaps).
2. For each child branch whose region **intersects** `range`, recurses.
3. For leaf items, yields those whose `gridBounds` intersects `range`.

Elements that partially overlap the query rectangle are included. All coordinate comparisons are against `element.gridBounds` — the tree never calls `getBounds()` or accesses the PixiJS transform chain.

### Expansion

When an inserted element falls outside the current root, `expand()` doubles the root's size. The old root becomes the `nw` child of a new root; three empty sibling entries fill the other quadrants. `minifyBranch` is called immediately to collapse any unnecessary empty structure.

### PixiJS integration note

`QuadTreeContainer` calls `super.addChild()` to attach the internal tree structure, bypassing the public `addChild` override. Callers must use `insert` / `remove` — not `addChild` — to manage elements.

---

## `GraphicsProviderService`

**File:** `graphics-provider.service.ts`

Angular `Injectable` (root-provided) that deduplicates `GraphicsContext` instances. PixiJS `GraphicsContext` objects hold the vertex/geometry data for a shape and can be shared across many `Graphics` display objects — sharing avoids rebuilding the same geometry repeatedly.

Only `StaticGraphicsContext` subclasses are cacheable (see below): the cache never evicts, and every cached context is baked once in its constructor and immutable afterwards.

```ts
getGraphicsContext<T extends CacheableGraphics>(
  graphics: T,
  ...params: ConstructorParameters<T>
): GraphicsContext
```

The cache is a two-level `Map`: outer key is the constructor, inner key is `params.join()` (a comma-joined string of the constructor arguments). This is sufficient for numeric and string parameters (all current callers pass `number` values).

Both `Wire` and `Grid` call this service via `getStaticDI` (the static DI escape hatch) rather than Angular injection, because they are plain PixiJS classes rather than Angular services.

---

## `graphics/` — `GraphicsContext` subclasses

All extend `StaticGraphicsContext` (`graphics/static-graphics-context.ts`), which extends `GraphicsContext`. They are constructed with parameters and immediately draw into the context in the constructor body. Instances are shared (via `GraphicsProviderService`) and never mutated after creation.

### `StaticGraphicsContext`

The base class encodes the baked-once/immutable contract in a perf-critical way: it drops all `update`/`unload` subscriptions (`on`/`once` no-op for those events) and opts out of the renderer's GPU garbage collection (`autoGarbageCollect = false`, so a dropped `unload` notification can never leave attached `Graphics` holding stale batch clones). Neither event can carry information on an immutable, never-collected context, and empty listener lists make a context swap (`graphics.context = other`) O(1) per `Graphics`. With the stock subscriptions, eventemitter3 rebuilds the shared context's listener array on every detach, so the zoom-step swap wave over a big board (thousands of attached `Graphics` per context) is quadratic — the dominant cost in zoom profiles.

### `ComponentGraphics`

**File:** `graphics/component.graphics.ts`

Draws the background rectangle of a component body. Shape: a closed hexagon-like polygon with 3 px chamfers on the top-right and bottom-right corners. Stroke color and fill color are read from `ThemingService.currentTheme()` at construction time. Stroke width is `2 / scale` to stay at 2 screen pixels regardless of zoom.

Parameters: `width` (grid units), `height` (grid units), `scale`.

### `WireGraphics`

**File:** `graphics/wire.graphics.ts`

A white unit `1×1` rectangle; the wire's color is the per-instance tint (theme `wire` color, or `wireSelectColor` while selected — see `wires.md`), which keeps the context theme-independent. `Wire` scales this up via `scale.x = length` (grid units) and compensates line thickness with `scale.y = 1 / (projectScale * gridSize)` so the wire is always exactly 1 screen pixel tall inside `_gridSpace`.

No parameters.

### `ConnectionPointGraphics`

**File:** `graphics/connection-point.graphics.ts`

A white unit `1×1` rectangle; like `WireGraphics`, the color is the per-instance tint (CPs reuse the wire colour — no separate theme field). `ConnectionPoint` instances pivot-centre this context (`pivot.set(0.5, 0.5)`) and scale it via `scale.set(screenSizePxForScale(scale) / (scale * gridSize))` so the dot stays a fixed screen size regardless of zoom — 4 px when zoomed well out, 6 px otherwise.

No parameters.

### `GridGraphics`

**File:** `graphics/grid.graphics.ts`

Draws a `size × size` grid of dots (one `1/scale × 1/scale` rect per grid intersection) into a single `GraphicsContext` chunk. A debug flag (`environment.debug.showGridBorders`) overlays a red rectangle around the chunk boundary.

Parameters: `size` (grid units), `scale`.

---

## `AssetsService`

**File:** `assets.service.ts`

Angular `Injectable` (root-provided). Registers the Roboto Mono subset woff2 with PixiJS `Assets` in its constructor, then in `init()` loads it and installs the canvas bitmap font via `BitmapFont.install` under the `CANVAS_FONT_FAMILY` name. All canvas text is `BitmapText` rendered from this one atlas — zoom only scales glyph quads, never re-rasterizes text. Glyphs are baked at 96 physical px (48 px × resolution 2), above the largest size built-in text reaches on screen, and cover printable ASCII, Latin-1 and Latin Extended-A (`CANVAS_FONT_CHARS`); characters outside that set are silently dropped. The atlas is baked white with `dynamicFill`, so a `BitmapText`'s `fill` acts as a per-instance tint for theme colors.

The FontFace is registered under a bake-only family name (`Roboto Mono Canvas`) rather than `Roboto Mono`: the Google Fonts stylesheet registers lazy same-named faces, and resolving the bake to a still-unloaded one would silently rasterize a fallback font into the atlas.

`BoardComponent.ngOnInit` awaits `assetsService.init()` before acquiring the shared renderer, guaranteeing the atlas exists before any `BitmapText` is created during scene construction.

---

## Integration with the rest of the app

| Rendering class           | Consumed by                                                                                                | How                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `PointerController`       | `BoardComponent`, `SubCircuitWatchComponent`                                                               | One per canvas; normalizes DOM pointer/wheel/touch input                         |
| `WorkModeRouter`          | `BoardComponent`                                                                                           | The board's tool target; dispatches modes into `DragSession`s                    |
| `RendererService`         | `BoardComponent`, `SubCircuitWatchComponent` (leases); `BoardSnapshotService`, `DebugMenuService` (direct) | The one shared renderer; leased per canvas, read directly for offscreen renders  |
| `TickerScheduler`         | `BoardComponent`                                                                                           | One per project; turns `project.ticker$` signals into board ticker frames        |
| `Grid`                    | `Project`                                                                                                  | Instantiated privately; forwarded position/scale changes                         |
| `FloatingLayer`           | `Project`, sessions (via `WorkModeRouter`)                                                                 | Visual host for session ghosts and the wire-tool hover previews                  |
| `DragCollisionState`      | `PastePlacementSession`, `SelectionMoveSession`                                                            | Shared component+wire collision detection against the project's quad trees       |
| `QuadTreeContainer`       | `Project`                                                                                                  | Used as `_wires` and `_components` inside `_gridSpace`                           |
| `GraphicsProviderService` | `Wire`, `Grid` (via `getStaticDI`), any component subclass                                                 | Shared `GraphicsContext` deduplication                                           |
| `AssetsService`           | `BoardComponent`                                                                                           | Loaded before the renderer lease is acquired                                     |
| `ComponentGraphics`       | Component subclasses                                                                                       | Via `GraphicsProviderService.getGraphicsContext(ComponentGraphics, w, h, scale)` |
| `WireGraphics`            | `Wire` constructor                                                                                         | Via `GraphicsProviderService.getGraphicsContext(WireGraphics)`                   |
| `GridGraphics`            | `Grid.draw()`                                                                                              | Via `GraphicsProviderService.getGraphicsContext(GridGraphics, chunkSize, scale)` |

### `BoardComponent` wiring

`BoardComponent` (`ui/board/board.component.ts`) is the Angular host. It owns only what is per-canvas — the render ticker, the cull pass, the viewport size, the input wiring — and draws through the shared renderer. It:

1. Awaits `AssetsService.init()`, then acquires a `RendererService` lease (held until teardown).
2. Runs a never-auto-started `Ticker` whose frame callback culls the active project against the viewport (see [Culling](#culling)) and blits it via `lease.render(project, canvas)`.
3. Re-homes the `WorkModeRouter` via `setProject` when a `Project` input arrives, and re-sizes the project's viewport to the host box.
4. Creates a `TickerScheduler` per project (over `project.ticker$`) that translates `'single'`/`'on'`/`'off'` into `ticker.update()` / `.start()` / `.stop()`.
5. Observes the host element with a `ResizeObserver`; resizes feed `project.resizeViewport` and repaint one frame. The canvas fills the host via CSS; its backing store follows per render.
6. Creates the `PointerController` on the canvas, with the router as tool target and the active project as navigation target; its `onCursorMove` feeds the throttled `cursorPositionChange` output.

### Culling

Off-screen scene nodes are skipped at render time via the plain PixiJS `culled` flag, driven by the app's own grid-space cull pass (PixiJS's `Culler` is not used — it recomputes a world transform per tested node, which dominated pan-frame cost). The board's frame callback runs `project.cull()` immediately before each blit, so the pass runs on every ticker-driven render — including the demand-driven `'single'` frames — and the culled set stays current through pan/zoom with no extra scheduling. `ViewportController.gridView()` folds the camera transform into a single grid-unit view rectangle once (allocation-free), and `QuadTreeContainer.cull(view)` walks each tree testing that rectangle against entry `boundsArea` regions — pure rectangle math, no per-entry matrix work.

**Culling happens only at the quad-tree level — individual elements are never bounds-checked:**

- **Each `QuadTreeEntry`** costs one rect-vs-rect intersection. A culled entry's subtree is skipped by the walk, so an off-screen branch costs one test regardless of content — the quad tree partitions space, keeping the pass sublinear. An intersecting branch recurses so its children are re-tested.
- **Elements** (`Component`/`Wire`) carry no culling state: their `culled` flag stays `false`, and the render pipeline skips them via their culled ancestor entry. An on-screen entry renders all its elements; an off-screen entry is culled whole. Per-frame cull cost is proportional to the number of visible _branches_, not visible _elements_.
- **`Grid`** and **`ConnectionPointLayer`** are never culled: grid chunks are repositioned every frame to fill the viewport, and a flat dot layer with no spatial index would cost an O(n) bounds check per dot with no subtree pruning.

Culling composes with the render-group split (see [Render groups](#render-groups)): a culled entry is also a render group, so its `execute` is skipped wholesale at render time, and a `culled` flip dirties only the instruction set of the nearest enclosing entry group.

Culling sets only the PixiJS `culled` flag and never touches the quad tree's own arrays, so `queryRange` and all collision/connection-point logic are unaffected.

### Render groups

PixiJS caches one instruction set per render group and rebuilds a group's set **in full** whenever anything inside it changes structurally — including any `culled` flip. With the whole scene in the root render group, a single flipped entry would re-collect and re-batch every visible element on every pan frame. The scene is therefore split so rebuilds stay local:

- **Quad-tree entries of size ≥ `RENDER_GROUP_MIN_SIZE` (32 grid units)** are their own render groups. Instruction collection stops at child render groups, so a `culled` flip rebuilds only the nearest enclosing entry group — one region's few elements, never the scene. The threshold trades rebuild-region size against group count: every group breaks batching and adds a small fixed per-frame cost (`updateRenderGroupTransforms`, buffer binds, draw calls).
- **`ConnectionPointLayer`** is one render group, so dot insertions/removals during edits rebuild only the dot layer and root-group rebuilds never re-batch board-wide dots.

### Work-mode integration

`WorkModeService.mode()` and `selectedComponentConfig()` (Angular signals) are mirrored onto the `WorkModeRouter` via an Angular `effect` in `BoardComponent` (`setMode` cancels any active session and clears the selection).

---

## PixiJS-specific patterns

- **`GraphicsContext` sharing** — all geometry is defined once and shared. `Graphics` instances are lightweight wrappers that apply a transform on top of a shared context. This is the PixiJS v8 equivalent of v7 `PIXI.Texture` sharing.
- **No PixiJS events** — `eventFeatures` is disabled at `app.init`; no scene node sets `eventMode`/`hitArea`. All input arrives via the DOM `PointerController`, and element hits are manual quad-tree queries (`queryComponentsInRange` + `bodyGridBounds`/port-distance checks).
- **Demand-driven render loop** — the ticker is stopped between interactions. `'single'` renders one frame for state changes (add/remove element); `'on'`/`'off'` bracket continuous drags. This avoids burning GPU cycles at 60 fps when the canvas is idle. `BoardRenderScheduler` coalesces bursts of `'single'` signals onto a single rAF-driven render so a multi-element operation (undo of a large move, paste, delete) costs one frame, not one per element.
- **Scale-compensated stroke widths** — `ComponentGraphics` bakes `2 / scale` into its stroke width; `GridGraphics` uses `1 / scale` for dot size; `Wire.applyScale` sets `scale.y = 1 / (scale * gridSize)`. `Component` handles the `gridSize` factor via its `_visualSpace` counter-scaling; `Wire` extends `Graphics` directly and must compensate explicitly. On zoom, `Component.applyScale` swaps each scaled element to its correctly-scaled (shared, cached) `GraphicsContext` and updates stub/text scale **in place** — it never rebuilds the component or re-rasterizes a `Text`, so zoom stays cheap on large circuits (see `component-system.md`, "Build vs. rescale").
- **`_visualSpace` counter-scaling** — `Component` owns a child `_visualSpace` with `scale = 1/gridSize`. Visual geometry (chamfers, stroke widths, text) is authored in pixels inside `_visualSpace`; the two scalings (`_gridSpace × gridSize` and `_visualSpace × 1/gridSize`) cancel so existing pixel formulas remain valid.
- **Quad tree uses `gridBounds`** — `QuadTreeContainer` never calls PixiJS `getBounds()`. It reads `element.gridBounds` (a plain `Rectangle` in grid units) for all spatial decisions. This avoids scene-graph traversal and makes collision detection integer-exact.
- **Quad tree as PixiJS Container** — `QuadTreeContainer` and its internal `QuadTreeEntry` nodes are real PixiJS `Container` instances in the scene graph. Children keep their world coordinates because all entries sit at position `(0, 0)`; only `boundsArea` encodes the spatial region. The same region drives the entry-level cull pass (see [Culling](#culling)) — the tree doubles as both the spatial index for queries and the cull hierarchy, with no separate data mirror.
