# Rendering Layer

The rendering layer owns the PixiJS scene graph structure, viewport interaction, spatial indexing, shared graphics caching, and transient/floating UI elements. `Project` (which extends `InteractionContainer`) is the root of the scene and orchestrates all sub-layers.

## Directory Layout

```
src/app/rendering/
├── assets.service.ts               # PixiJS Assets bootstrap (fonts)
├── floating-layer.ts               # Transient placement/wire-drawing/selection overlay
├── graphics-provider.service.ts    # Shared GraphicsContext cache
├── grid.ts                         # Infinite-seeming background grid
├── interaction-container.ts        # Abstract base: pan/zoom pointer handling
├── quad-tree-container.ts          # Spatial index for efficient range queries
└── graphics/
    ├── component.graphics.ts       # GraphicsContext for component body outline
    ├── grid.graphics.ts            # GraphicsContext for a grid chunk tile
    └── wire.graphics.ts            # GraphicsContext for a wire segment
```

---

## Core Concepts

### Pixel vs. grid coordinates

All circuit data is stored in **grid units**. The `_gridSpace` container in `Project` has `scale.set(environment.gridSize)`, so any object added to `_gridSpace` with `position.set(gx, gy)` renders at world-pixel `(gx * gridSize, gy * gridSize)`. No manual conversion is needed at the model layer. The remaining helper in `utils/grid.ts` is `fromGrid(n)` (`n * gridSize`), used only inside `Component._visualSpace` and the background grid where geometry is still pixel-authored. Wire endpoints sit on **half-grid** positions (e.g., 0.5, 1.5) so that connection pins align with the midpoints of cell edges.

### Ticker control

The PixiJS `Application` is created with `autoStart: false` in `BoardComponent`. Rendering frames are emitted on demand via the `_ticker$` Subject exposed as `ticker$` on `InteractionContainer`. Three signal values control the ticker: `'single'` fires one frame (for state changes that don't involve continuous motion), `'on'` starts continuous rendering (during pointer drags), and `'off'` fires one final frame then stops.

### Scene graph order inside `Project`

```
Project (InteractionContainer root, stage)
├── Grid                                    (pixel-authored, outside gridSpace)
└── _gridSpace  (scale = gridSize)
    ├── QuadTreeContainer<Wire>  (_wires)
    ├── QuadTreeContainer<Component>  (_components)
    └── FloatingLayer
```

`Project` extends `InteractionContainer`, which is added directly as the PixiJS `app.stage`. The background grid is pixel-authored and stays a direct child of `Project`. All circuit content lives inside `_gridSpace` so that setting `position = (gx, gy)` on any circuit object automatically places it at the correct world-pixel location without conversion.

---

## `InteractionContainer`

**File:** `interaction-container.ts`

Abstract PixiJS `Container` that handles viewport pan (right-drag) and zoom (wheel). Subclasses implement:

```ts
abstract pan(delta: Point): void;
abstract zoomIn(center: Point): void;
abstract zoomOut(center: Point): void;
```

Event binding:
- `rightdown` / `rightup` / `rightupoutside` — starts/stops pan; emits `'on'`/`'off'` on `_ticker$`.
- `pointermove` during drag — calls `pan(e.movement)`.
- `wheel` — calls `zoomIn` or `zoomOut`; emits `'single'`.

Context menu suppression: a `window` `contextmenu` listener (via RxJS `fromEvent`) is activated during right-drag and cleared 1 ms after `rightup` to eat the browser context menu that fires after right-click without drag.

`ticker$` (public Observable) exposes the internal `_ticker$` Subject to consumers (e.g., `BoardComponent`).

---

## `Project`

**File:** `project/project.ts` — extends `InteractionContainer`

Owns all circuit state and sub-layers. Not strictly part of `rendering/` but is the composition root that consumes every rendering class.

Key behaviours relevant to rendering:

| Method | Effect |
|---|---|
| `resizeViewport(w, h)` | Forwards to `Grid.resizeViewport` |
| `setPosition(p)` | Moves self, forwards to `Grid.updatePosition`, emits `positionChange$` |
| `zoomIn/zoomOut` | Applies `1.2^step` scale, repositions around center, calls `Grid.updateScale`, `FloatingLayer.updateScale`, and `applyScale` on every component and wire |
| `addComponent / addWire` | Appends to `_components` / `_wires`, calls `applyScale`, emits `'single'` |

Zoom is clamped to ±12 steps (scale range roughly `1.2^-12` to `1.2^5`). Pivot-correct zoom uses a matrix chain to keep the pixel under the mouse stationary.

---

## `Grid`

**File:** `grid.ts`

Renders an infinite-looking dot grid by tiling fixed-size `Graphics` chunks. Chunks share a single `GraphicsContext` (via `GraphicsProviderService`) per `(chunkSize, scale)` pair.

**Chunk size:** 32 grid units (512 px at scale 1).

**Tiling strategy:** `draw()` creates or repositions `Graphics` instances in a grid from `(0, 0)` to `(viewportWidth/scale + chunkSize, viewportHeight/scale + chunkSize)`. Surplus chunks are destroyed. The `Container` itself is offset by `chunkAligned(-position/scale)` so that panning shifts the chunk grid modulo one chunk size — the grid appears to scroll continuously while only a viewport-filling set of chunks exists.

The pivot is set to `chunkSizePx` so the offset math lands on chunk boundaries correctly.

`updateScale` destroys and rebuilds all chunks because the `GraphicsContext` needs a different scale baked into its stroke widths (dots are `1/scale × 1/scale` pixels so they stay 1 screen pixel regardless of zoom). At zoom < 0.25 the dot alpha is reduced to 0.5.

**API:**

| Method | When called |
|---|---|
| `updatePosition(pos)` | Every pan step (called from `Project.setPosition`) |
| `resizeViewport(size)` | Window resize |
| `updateScale(scale)` | Every zoom step |

---

## `FloatingLayer`

**File:** `floating-layer.ts`

A full-screen PixiJS `Container` that lives inside `_gridSpace` and sits above the permanent circuit layers. It handles all in-progress user interactions: component placement, wire drawing, and rectangle selection. Because it lives in `_gridSpace`, `this.position` is in grid units automatically.

`interactiveChildren = false` — events are captured only on the layer itself. `hitArea` is set to the full coordinate range so pointer events are always received regardless of panning.

### Internal children

| Field | Type | Purpose |
|---|---|---|
| `_componentSelection` | `Container<Component>` | Ghost component(s) during placement; tinted `0xbbbbbb` |
| `_wireSelection` | `Container<Wire>` | In-progress wires during wire drawing |
| `_selectRect` | `Graphics` | Semi-transparent black rectangle for drag-select |

### State machine

`FloatingLayer.mode` mirrors `project.mode` (a `WorkMode` enum value). Setting `mode` calls `clearSelection()` which clears all transient children.

Only `COMPONENT_PLACEMENT` and `WIRE_DRAWING` are fully implemented. `SELECT` / `SELECT_EXACT` render the selection rectangle but `commitSelection` does not yet query the quad tree for hit testing.

### Coordinate conversion

All pointer-event positions are converted to grid units via `e.getLocalPosition(this.project.gridSpace)`. This returns a `Point` already in grid-unit space, which is then snapped with `roundToGrid` (full-grid) or `roundToHalfGrid` (half-grid) from `utils/grid.ts`.

### Wire drawing

Two `Wire` objects are created lazily on first non-zero movement: one horizontal, one vertical. Their lengths and positions are updated on every `pointermove`. The drag direction is locked to whichever axis moved first: if horizontal, the vertical segment's X origin tracks the mouse; if vertical, the horizontal segment's Y origin tracks.

Wire origins are snapped to **half-grid** (`roundToHalfGrid`); component origins are snapped to **full-grid** (`roundToGrid`).

### `commitSelection()`

On `pointerup`, translates the floating children's positions into world grid-unit coordinates (adds `this.position` to each child's local position — both are in grid units, so this is a clean integer add), then wraps them into `AddComponentsAction` and/or `AddWiresAction` inside an `ActionContainer` and pushes to `project.actionManager`. Zero-length wires are filtered out. After commit, `clearSelection()` destroys the transient children.

### `updateScale(scale)`

Called from `Project.updateScale`. Forwards to `applyScale(scale)` on every component and wire currently in the selection — necessary because wire thickness and component stroke widths are scale-dependent.

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

| Constant | Value | Meaning |
|---|---|---|
| `INITIAL_SIZE` | 64 | Root entry covers `(0, 0, 64, 64)` grid units at construction |
| `MAX_LEAF_ELEMENTS` | 4 | A leaf with this many elements splits on the next insert |
| `MIN_BRANCH_ELEMENTS` | 2 | A branch with fewer total descendants collapses on remove |
| `MIN_LEAF_SIZE` | 1 | Leaves of 1 grid cell are never split (prevents infinite recursion) |

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

All three extend `GraphicsContext` directly. They are constructed with parameters and immediately draw into the context in the constructor body. Instances are meant to be shared (via `GraphicsProviderService`), not mutated after creation.

### `ComponentGraphics`

**File:** `graphics/component.graphics.ts`

Draws the background rectangle of a component body. Shape: a closed hexagon-like polygon with 3 px chamfers on the top-right and bottom-right corners. Stroke color and fill color are read from `ThemingService.currentTheme()` at construction time. Stroke width is `2 / scale` to stay at 2 screen pixels regardless of zoom.

Parameters: `width` (grid units), `height` (grid units), `scale`.

### `WireGraphics`

**File:** `graphics/wire.graphics.ts`

A unit `1×1` rectangle filled with the current theme's wire color. `Wire` scales this up via `scale.x = length` (grid units) and compensates line thickness with `scale.y = 1 / (projectScale * gridSize)` so the wire is always exactly 1 screen pixel tall inside `_gridSpace`.

No parameters.

### `GridGraphics`

**File:** `graphics/grid.graphics.ts`

Draws a `size × size` grid of dots (one `1/scale × 1/scale` rect per grid intersection) into a single `GraphicsContext` chunk. A debug flag (`environment.debug.showGridBorders`) overlays a red rectangle around the chunk boundary.

Parameters: `size` (grid units), `scale`.

---

## `AssetsService`

**File:** `assets.service.ts`

Angular `Injectable` (root-provided). Registers the Roboto woff2 font with PixiJS `Assets` in its constructor (with a cache-busting hash via `HashingService`), then loads it asynchronously in `init()`.

`BoardComponent.ngOnInit` awaits `assetsService.init()` before initializing the PixiJS `Application`, guaranteeing the font is available for any `BitmapText` or `Text` objects created during scene construction.

---

## Integration with the rest of the app

| Rendering class | Consumed by | How |
|---|---|---|
| `InteractionContainer` | `Project` | Extends it; provides `_ticker$` and pan/zoom hooks |
| `Grid` | `Project` | Instantiated privately; forwarded position/scale changes |
| `FloatingLayer` | `Project` | Instantiated privately; receives `_ticker$`; commits via `project.actionManager` |
| `QuadTreeContainer` | `Project` | Used as `_wires` and `_components` inside `_gridSpace` |
| `GraphicsProviderService` | `Wire`, `Grid` (via `getStaticDI`), any component subclass | Shared `GraphicsContext` deduplication |
| `AssetsService` | `BoardComponent` | Loaded before `Application` init |
| `ComponentGraphics` | Component subclasses | Via `GraphicsProviderService.getGraphicsContext(ComponentGraphics, w, h, scale)` |
| `WireGraphics` | `Wire` constructor | Via `GraphicsProviderService.getGraphicsContext(WireGraphics)` |
| `GridGraphics` | `Grid.draw()` | Via `GraphicsProviderService.getGraphicsContext(GridGraphics, chunkSize, scale)` |

### `BoardComponent` wiring

`BoardComponent` (`ui/board/board.component.ts`) is the Angular host. It:
1. Awaits `AssetsService.init()`.
2. Creates `Application` with `autoStart: false`, `preference: 'webgpu'`, `resolution: devicePixelRatio`.
3. Sets `app.stage = project` when a `Project` input arrives.
4. Subscribes to `project.ticker$` and translates `'single'`/`'on'`/`'off'` into `app.ticker.update()` / `.start()` / `.stop()`.
5. Forwards renderer resize events to `project.resizeViewport`.

### Work-mode integration

`WorkModeService.mode()` and `selectedComponentConfig()` (Angular signals) are mirrored onto `project.mode` and `project.componentToPlace` via an Angular `effect` in `BoardComponent`. `FloatingLayer` reads both of these from the `project` reference it holds, so work-mode changes take effect immediately on the next pointer interaction.

---

## PixiJS-specific patterns

- **`GraphicsContext` sharing** — all geometry is defined once and shared. `Graphics` instances are lightweight wrappers that apply a transform on top of a shared context. This is the PixiJS v8 equivalent of v7 `PIXI.Texture` sharing.
- **`boundsArea` for infinite containers** — `FloatingLayer`, `InteractionContainer` (via `Project`), and `Grid` all set `boundsArea` to the full coordinate range. This prevents PixiJS from computing tight bounds from children and makes the container always receive hit tests.
- **`eventMode: 'static'`** — used on containers that need pointer events but whose children do not (`interactiveChildren = false`). Reduces the event walk cost during each pointer event.
- **Demand-driven render loop** — the ticker is stopped between interactions. `'single'` renders one frame for state changes (add/remove element); `'on'`/`'off'` bracket continuous drags. This avoids burning GPU cycles at 60 fps when the canvas is idle.
- **Scale-compensated stroke widths** — `ComponentGraphics` bakes `2 / scale` into its stroke width; `GridGraphics` uses `1 / scale` for dot size; `Wire.applyScale` sets `scale.y = 1 / (scale * gridSize)`. `Component` handles the `gridSize` factor via its `_visualSpace` counter-scaling; `Wire` extends `Graphics` directly and must compensate explicitly.
- **`_visualSpace` counter-scaling** — `Component` owns a child `_visualSpace` with `scale = 1/gridSize`. Visual geometry (chamfers, stroke widths, text) is authored in pixels inside `_visualSpace`; the two scalings (`_gridSpace × gridSize` and `_visualSpace × 1/gridSize`) cancel so existing pixel formulas remain valid.
- **Quad tree uses `gridBounds`** — `QuadTreeContainer` never calls PixiJS `getBounds()`. It reads `element.gridBounds` (a plain `Rectangle` in grid units) for all spatial decisions. This avoids scene-graph traversal and makes collision detection integer-exact.
- **Quad tree as PixiJS Container** — `QuadTreeContainer` and its internal `QuadTreeEntry` nodes are real PixiJS `Container` instances in the scene graph. Children keep their world coordinates because all entries sit at position `(0, 0)`; only `boundsArea` encodes the spatial region. This means the tree structure is visible to PixiJS culling and bounds computation without any separate data mirror.