# Rendering Layer

The rendering layer owns the PixiJS renderer, the scene graph structure, viewport interaction, spatial indexing, shared graphics caching, and transient/floating UI elements. `Project` (a plain PixiJS `Container`) is the root of the scene and orchestrates all sub-layers. The whole app draws through **one** shared renderer (`RendererService`); every visible canvas — the board, each open watch — is a render _target_ of it, and offscreen consumers (minimap, image export, previews) render into textures on it. Canvas input never goes through PixiJS events — the `interaction/` layer listens to plain DOM pointer events (see below), and the shared renderer's own event features are disabled at creation.

## Directory Layout

```
src/app/rendering/
├── assets.service.ts               # PixiJS Assets bootstrap (fonts)
├── board-snapshot.service.ts       # Offscreen render-to-texture (image export, previews, minimap)
├── renderer.service.ts             # The single lease-counted renderer shared by every canvas
├── ticker-scheduler.ts             # Translates project ticker signals into board frames
├── drag-session.ts                 # DragSession interface implemented by all session classes
├── floating-layer.ts               # Visual host: drag-session ghosts + wire-tool hover previews
├── graphics-provider.service.ts    # Shared GraphicsContext cache
├── grid.ts                         # Infinite-seeming background grid
├── invalid-tint.ts                 # applyInvalidTint: collision tint / own-tint restore
├── placement-ghost.ts              # Single-component preview (hover + placement session)
├── quad-tree-container.ts          # Spatial index for efficient range queries
├── quad-tree-debug.ts              # Read-only reports over a tree: stats, histograms, text tree, validate
├── interaction/
│   ├── pointer-input.ts            # PointerInput sample + canvasToGrid viewport mapping
│   ├── pointer-controller.ts       # Per-canvas DOM listener: capture, buttons, wheel, gestures
│   ├── work-mode-router.ts         # Tool dispatch + session lifecycle (undo lock, ticker, paste)
│   └── tools/                      # One BoardTool per work mode (contract in board-tool.ts)
├── graphics/
│   ├── component.graphics.ts       # GraphicsContext for component body outline
│   ├── connection-point.graphics.ts # GraphicsContext for a CP dot
│   ├── grid.graphics.ts            # GraphicsContext for a grid chunk tile
│   └── wire.graphics.ts            # GraphicsContext for a wire segment
└── sessions/
    ├── component-placement.session.ts  # Ghost component drag → commit + register
    ├── drag-collision.ts               # Shared collision detection for drag sessions
    ├── erase.session.ts                # Sweep-erase drag → register
    ├── pan.session.ts                  # One-pointer pan with tap fallback
    ├── paste-placement.session.ts      # Paste preview drag → commit + register
    ├── select-rect.session.ts          # Rubber-band rect → selectionManager.commit()
    ├── selection-move.session.ts       # Drag selected elements → commit + register
    └── wire-tool.session.ts            # L-shaped wire preview → commit + register
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

Per-canvas listener bundle (pointerdown/move/up/cancel, wheel, contextmenu — detached via one `AbortController` in `destroy()`). It normalizes every event into a `PointerInput` — `{ pointerId, pointerType, global, grid }`, where `global` is canvas-local CSS pixels (the space `project.viewport.pan`/`zoomBy` expect) and `grid` is the same point mapped through `canvasToGrid` (reads `project.position`/`scale` directly; fresh even before the next render, and valid because `Project` sits at the stage root). Routing:

- **Primary button** — captured via `setPointerCapture` (moves keep flowing when a drag leaves the canvas) and streamed to the `PointerToolTarget` (`down`/`move`/`up`/`cancel`); moves with no pressed pointer go to `hover`, and `pointerleave` goes to `leave` (hover previews stop applying off-canvas; capture suppresses the boundary event mid-drag, so an in-flight drag is unaffected). Click-vs-drag semantics live in the sessions (`PanSession`'s 5 px threshold), not the controller.
- **Right button** — pan-only drag by successive position deltas, bracketed by `nav.setActive(true/false)` (ticker on/off on the board). The canvas context menu is suppressed outright.
- **Touch** — pointers feed the `MultiTouchGesture` first; when a second finger lands the gesture takes over (two-finger pan + pinch via `nav.pan`/`nav.zoomBy`) and the tool stream is cancelled, so a finger never both operates a tool and navigates.
- **Wheel** — `nav.zoomIn/zoomOut` at the cursor; registered non-passive so `preventDefault` stops page scroll/zoom.

The `PointerNavTarget` is supplied by the host: the board maps it straight onto the active project (+ ticker), the watch wraps `pan` to re-blit explicitly. An optional `onCursorMove` callback reports per-move grid positions (the board feeds its status-bar output from it). Handlers are public, so specs drive them with plain objects instead of synthesized DOM events.

### `WorkModeRouter`

**File:** `interaction/work-mode-router.ts`

The board's `PointerToolTarget`, reduced to dispatch plus session lifecycle: it holds the current `WorkMode`, a `Map<WorkMode, BoardTool>` (the tool table), and the single `_activeDrag: DragSession | null`. Mode behavior lives in the tools (below); the router owns everything that must be consistent across them.

- `down(input)` dispatches to the active mode's tool, which opens a session through the `ToolHost` contract (`startSession`). A session that outlives its opening gesture (paste placement) instead receives the press via the optional `DragSession.onDown` — returning `false` asks the router to cancel it.
- `move(input)` delegates to `_activeDrag.onMove`; with no session it falls through to `hover`, which dispatches to the tool's `hover`.
- `up()` asks `session.canEnd()` first — `true` commits via `onEnd()` and stops the drag ticker; `false` (collision) either discards the session (when it sets `discardOnInvalidRelease`, i.e. placement/wire drawing — a dropped ghost just clears) or keeps it alive/frozen (move/paste, awaiting a valid drop).
- `cancel()` (a second finger landing) aborts the active session via `onCancel()`. The Escape shortcut (a `ShortcutService` CANCEL subscription) unwinds one interaction layer per press: an in-progress drag first, then a live selection (`selectionManager.clear()`), then the current tool — escalating to the pan tool via `WorkModeService.setMode(PAN)` so the toolbar follows. Simulation stays put (its editing lock forbids the tool swap).
- `setProject(project)` re-homes the router on tab switches: cancels any in-flight session on the old project, deactivates the current tool on it (tearing down hover previews), resubscribes to the new project's `pasteRequest$`, and clears the new selection. `setMode` does the same teardown on the old mode's tool.
- **Undo lock** — while a session is live, the project's `ActionManager.locked` is set: sessions detach elements into the drag layer, and a history operation touching them would corrupt the quad tree. Undo/redo are inert until the session ends (its commit registers before the unlock).
- **Gesture stamp** — `gestureSeq` is bumped on pointer-up, cancel and context switches; an async tool (the placement circuit load) re-validates it before opening a session, so a stale load never opens one with no pointer left to drive it.
- Paste stays router-level (event-initiated, not mode-initiated): `ClipboardService` calls `Project.startPasteSession`, which emits on `pasteRequest$`; the router opens the `PastePlacementSession` in the project's floating layer.

Sessions receive `project.floatingLayer.dragLayer` (or the floating layer itself for the select rect) to parent their ghosts; drag starts/stops emit `'on'`/`'off'` on the project ticker.

### `tools/` — per-mode board tools

**Files:** `interaction/tools/*.tool.ts`, contract in `interaction/tools/board-tool.ts`

One `BoardTool` per work mode: `down` opens the session a press means in that mode, optional `hover` drives the mode's previews, optional `deactivate` tears them down when the tool's context ends (mode/project switch, pointer leaving the canvas), and optional `onSessionStart` yields the preview to a starting session's ghosts.

- **`PanTool`** — opens a `PanSession`; a tap single-selects (the session's default tap action).
- **`SimulationTool`** — a `PanSession` whose tap action activates the component under the cursor: a button/switch emits `Project.userInput$`, an inspectable component emits `inspectRequest$`. The only canvas interaction while editing is locked.
- **`WireTool`** — opens a `WireToolSession`; owns the tap action (port negation through the undo stack, else `project.topology.toggleConnectionAt`) and the hover previews: the negation bubble over a port (translucent for the bubble a tap would add; opaque in the theme's `invalid` color over a bubble a tap would remove), or the connection ghost over a toggleable junction (`project.topology.connectionToggleKindAt` dry-runs the join plan so non-toggleable T-junctions show nothing). The previews survive a press and hide only when the gesture becomes a drag (`WireToolSession` hides them on its first real move); after a tap they re-derive in place.
- **`SelectTool`** — one instance per marquee flavor (SELECT, SELECT_EXACT): a press inside the committed selection's grab zone opens a `SelectionMoveSession`, anywhere else a `SelectRectSession` with the flavor and the live hold-to-scissor key state.
- **`PlacementTool`** — holds the palette selection (`setConfig`, fed through the router's `componentToPlace` setter) and follows the cursor with a `PlacementGhost` — the same grid-snapped, collision-tinted ghost the placement session shows, so pressing hands off seamlessly (`onSessionStart` destroys the hover ghost as the session's replaces it). `down` ensures a cloud custom master's circuit is loaded before opening the `ComponentPlacementSession`, guarded by the host's gesture stamp.
- **`EraseTool`** — opens an `EraseSession`.

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

| Member                            | Effect                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewport` (`ViewportController`) | All camera control: `pan`/`setPosition` (forwarding to `Grid.updatePosition`), `zoomIn/zoomOut/zoom100/zoomBy` (scale + reposition around center, `Grid.updateScale`, `FloatingLayer.updateScale`, `ConnectionPointLayer.applyScale`, `applyScale` on each quad tree — on-screen entries only, see [Culling](#culling) — then one `'single'` render request), `resizeViewport`, `viewportChange$`/`viewportState` |
| `topology` (`WireTopology`)       | Wire-invariant integration (`integrate`) and the wire tool's connection toggling — see `wires.md`                                                                                                                                                                                                                                                                                                                 |
| `addComponent / addWire`          | Appends to `_components` / `_wires` (and the id → element maps behind `getComponentById`/`getWireById`; `insert` brings the element to the live zoom), fires the matching `ConnectionPointManager` hook, emits `'single'`                                                                                                                                                                                         |

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

| Field                 | Type                           | Purpose                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_dragLayer`          | `Container<Component \| Wire>` | Ghosts during placement/paste (hover preview and session), detached selected elements during drag-move; exposed as `dragLayer`                                                                                                           |
| `_negationHoverGhost` | `Graphics`                     | Lazily-created negation preview bubble via `showNegationGhost(anchor, side, rotation, willRemove)` / `hideNegationGhost()` — translucent add preview or opaque `invalid`-tinted removal preview                                          |
| `_connectionGhost`    | `Graphics`                     | Lazily-created connection-toggle preview via `showConnectionGhost(p, kind)` — 'split' is a translucent CP dot, 'join' covers the existing dot in `invalid`; tracks the zoom it was drawn at so a show after zooming while hidden redraws |

`_selectRect` (`Graphics`) is a **transient** child added to and removed from `FloatingLayer` by `SelectRectSession`.

### Coordinate conversion

Sessions receive grid-space positions precomputed on the `PointerInput` (`input.grid`, mapped by `canvasToGrid`), snapped with `roundToGrid` (full-grid) or `roundToHalfGrid` (half-grid) from `utils/grid.ts`.

**Paste placement** bypasses the work-mode switch: the router opens a `PastePlacementSession` in hover mode (`isDragging = false`) on a project's `pasteRequest$`. In hover mode, the ghosts do not follow the cursor — the pasted elements sit where they were placed (original clipboard position + `PASTE_OFFSET`). The session receives the next press through `DragSession.onDown`: a click on a ghost element's bounds calls `beginDrag()` and subsequent moves drag the group on a grid-snapped cursor; a click outside the ghost group returns `false`, asking the router to cancel the session (the fresh instances are destroyed).

### Session classes

Each session lives in `rendering/sessions/` and implements `DragSession` (`onMove(input: PointerInput)`, `onEnd`, `onCancel`, `canEnd`, and — for sessions that outlive their opening gesture — the optional `onDown`).

**`DragSession.canEnd()`** — called by `WorkModeRouter.up` before committing. Return `false` to block the commit on collision. `SelectRectSession` always returns `true`; collision sessions return `!_hasCollision`. What a blocked release does then depends on the optional `discardOnInvalidRelease` flag: placement sessions (`ComponentPlacementSession`, `WireToolSession`) set it so a colliding drop is abandoned (`abortActiveDrag`) — the ghost clears, ready for the next placement — while move/paste sessions leave it unset and stay frozen in place until the user finds a valid drop.

**Commit convention** — every mutating session **materializes its final state in the live project** during/at the end of the gesture, then records its action via `ActionManager.register` (record-without-`do()`). `push` — which records _and_ runs `do()` — is reserved for instantaneous, non-gesture operations (wire-tap toggles, option panels). See `actions-system.md` § _push vs register_.

**`ComponentPlacementSession`** — a thin wrapper around `PlacementGhost` (`rendering/placement-ghost.ts`): a fresh `Component` built from the config (wearing the selection look: `selected = true`) parented into `_dragLayer` and positioned directly at the grid-snapped pointer. `PlacementGhost.moveTo` re-derives collision on every move via `project.hasComponentCollision` / `hasComponentBodyWireCollision` on the ghost's own `gridBounds`; collision tints the component with the theme's `invalid` color, clearing calls `refreshTint()`. `canEnd()` returns `false` while colliding — a colliding `pointerup` discards the ghost (`discardOnInvalidRelease`), freeing the pointer to start a fresh placement. On `onEnd()`, the session integrates the ghost's ports against the wire net (splitting any wire an arriving port lands on), builds `ActionContainer(RemoveWires?, AddComponents, AddWires?)`, materializes exactly that state — the ghost instance itself is released (`PlacementGhost.release()` drops the selection look) and added to the project — and registers the action. The same `PlacementGhost` class backs the `PlacementTool`'s pre-press hover preview.

**`SelectionMoveSession`** — snapshots the selection (geometry originals are captured at construction: positions, directions, wire snapshots, the frozen grab rect), calls `project.detachForDrag`, and reparents elements into `_dragLayer`. `onMove` sets `_dragLayer.position` to the grid-snapped delta from the drag start and runs `project.hasComponentCollision` for each dragged component against the fixed quad tree. Collision tints each dragged element with the theme's `invalid` color; clearing calls `refreshTint()` on each (see `DragCollisionState`). `canEnd()` returns `false` while colliding. `onEnd` (which requires `canEnd() === true`) applies the delta to each element's own position, resets `_dragLayer.position` and the collision tint, calls `project.reattachFromDrag`, runs the wire integration over the post-move scene (splits/merges applied with the live instances), and if the delta was non-zero registers `ActionContainer(MoveComponents?, MoveWires?, RemoveWires?, AddWires?)` — or, when the drag committed a live scissor cut, coalesces the cut's history entry with that container into one undo step (`SelectionManager.consumeLiveCut` + `ActionManager.coalesceTop`). `onCancel` resets position and tint before reattaching — always safe regardless of collision state.

The session also carries the **rotate-selection** capability (`DragSession.rotate(steps)`): a rotate request mid-drag turns the detached group clockwise by quarter-turns around its bounding box's centre snapped to the integer grid (`utils/rotation.ts` — exact arithmetic, so grid/half-grid coordinates survive; see `rotate-elements.ts` for the element-level orbit). The carried junction dots and the frozen grab rect turn with the group (`SelectionManager.freezeGrabRect`). A commit with net rotation records `RotateComponentsAction`/`RotateWiresAction` (direction + position pairs) instead of the move actions; `onCancel` restores the captured originals. Opened with `pointerStart: null` (the rotate/move flows, see below) the session outlives its opening gesture like paste placement: `onDown` on the selection locks in the drag anchor, off it asks the router to cancel — reverting the rotation.

`DragSession.moveBy(dx, dy)` shifts the floating group by whole grid units (the arrow-key shortcuts mid-session): the drag-layer offset moves, and a locked drag anchor shifts opposite so the next pointer move preserves the shift instead of snapping the group back under the cursor.

**Rotate flow** — like paste, rotation is router-level and event-initiated: the `R`/`Shift+R` shortcuts land directly in the router, and the toolbar / mobile selection-bar buttons call `Project.requestSelectionRotation(steps)` (emits on `rotateRequest$`). The router's `_onRotate` forwards to the active session's `rotate()` if one is open (move, paste, or a floating rotate); otherwise `_startSelectionRotate` opens a `SelectionMoveSession` over the committed selection with no drag anchor, rotates it once, and — when collision-free — commits synchronously, so the user sees an in-place rotate. A colliding rotation keeps the session open instead: the red-tinted group floats (still selected) until it is turned or dragged somewhere valid. A further rotate that clears the collision commits the moment it becomes valid (`_commitIfFloatingAndValid`, gated on `DragSession.isAwaitingGrab()` so a turn mid-pointer-drag does not commit under the cursor) — matching the first-op behaviour; only an Escape or a press off the selection while still colliding reverts. Clipboard `cut`/`delete` are gated on `actionManager.locked` so the toolbar cannot delete a selection whose elements a session holds detached.

**Move flow** — the arrow-key shortcuts move the committed selection one grid unit per press through the same machinery: the router's `_onMoveSelection` forwards to the active session's `moveBy()` if one is open; otherwise `_startSelectionMove` opens a `SelectionMoveSession` with no drag anchor, shifts it once, and — when collision-free — commits synchronously (each press is its own undo step). A colliding move keeps the session open exactly like a colliding rotate: the red-tinted group floats until further arrow presses or a drag land it somewhere valid, and — like rotate — a further move that clears the collision commits in place the instant it becomes valid (via the same `_commitIfFloatingAndValid`). A press off the selection while still colliding reverts.

**`WireToolSession`** — `_wirePreview.position` is the half-grid-snapped start point. Two `Wire` objects (horizontal + vertical) are created lazily on first movement and sized to form an L-shape. The drag direction is locked to whichever axis moved first. `getLocalPosition(_wirePreview)` gives the delta from the start in grid units, which drives wire lengths/positions. On `onEnd()`, the drawn wires are integrated against the net (splits/merges), the surviving live instances are added to the project (a drawn wire the integrator passed through is re-parented, not copied), the action is registered, and only the instances that did **not** make it into the project are destroyed. A release while a drawn segment overlaps a component body discards the whole preview (`discardOnInvalidRelease`) rather than freezing it.

**`SelectRectSession`** — adds `_selectRect` to `FloatingLayer` at the click's grid position. `onMove` sets `_selectRect.scale` to the grid-unit delta from start (negative values handle reverse drags). `onEnd` normalizes the rect to a canonical `Rectangle` (always positive width/height), removes `_selectRect`, and calls `project.selectionManager.commit(rect, mode)`. A zero-area rect (no movement) reaches the selection manager unchanged and is handled as a single-click hit test.

**`PastePlacementSession`** — opened by the router on a project's `pasteRequest$` when the user invokes paste. Receives pre-deserialized `Component[]` and `Wire[]` (fresh instances with new IDs and positions already offset by `PASTE_OFFSET = 2` grid units). Elements are added to `_dragLayer` with `selected = true` — the ghosts wear the selection look, which carries over seamlessly when `select()` keeps them selected on commit. Two-phase interaction:

1. **Hover phase** (`isDragging = false`) — elements sit at their initial positions. `onMove` is a no-op. The user can click on a ghost to begin dragging, or click off the ghosts to commit immediately at the initial position.
2. **Drag phase** (`isDragging = true`) — after `beginDrag(anchor)`, `onMove` sets `_dragLayer.position` to the grid-snapped cursor delta from the anchor. Collision is checked after every move via `DragCollisionState`.

`canEnd()` returns `false` while colliding — `pointerup` is ignored and the ghosts stay live. `onEnd()` applies the `_dragLayer` delta to each element's position, resets `_dragLayer.position` and tint, transfers elements to the project via `addComponent`/`addWire`, wraps them in an `ActionContainer(AddComponentsAction, AddWiresAction)`, calls `selectionManager.select()` to select the pasted elements, and registers the action (state already applied — no `do()` call). `onCancel()` destroys all ghost components and wires without adding them to the project. The session implements `rotate(steps)` too — the ghosts turn around their snapped centre, and nothing else needs tracking: the commit serializes final geometry and a cancel destroys the instances. `moveBy(dx, dy)` likewise shifts the ghosts by whole grid units (anchor compensation as in the move session), so arrow keys fine-position a paste in both phases.

### `DragCollisionState`

**File:** `sessions/drag-collision.ts`

Shared collision detection extracted from `SelectionMoveSession` and reused by `PastePlacementSession`. Constructed with the project, drag layer, and the moving components/wires arrays. On each `update()`, computes world-space bounds (`gridBounds + dragLayer.position`) for each element and checks:

- Component–component collision via `project.hasComponentCollision(bounds, bodyBounds)`.
- Component–wire body collision via `project.hasComponentBodyWireCollision(bodyBounds, …)`.
- Wire–component body collision via `project.hasWireBodyCollision(bounds)`.

Tints every element in `_dragLayer` (including captured junction dots) with the theme's `invalid` color on collision, and restores their own tints otherwise — both through the shared `applyInvalidTint` helper (`rendering/invalid-tint.ts`), which tints elements directly rather than through the drag layer: a container tint multiplies with the children's own tints (wires carry their color AS tint over a white base), which would darken the invalid red toward black. Only emits tint changes when the collision state actually flips, avoiding redundant GPU updates. `reset()` restores the elements' own tints; sessions call it before reattaching or committing so a cancel mid-collision does not leak the invalid tint back onto the board.

`PlacementGhost` and `WireToolSession` run their own collision queries (single component / two preview wires) but share the same `applyInvalidTint` for the tinting.

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

A generic PixiJS `Container` subclass that maintains a spatial **loose quad tree** (looseness factor 2) over its children. Used as `_wires` and `_components` in `Project`. The generic constraint requires `T` to implement the `GridElement` interface (`gridBounds`, `cullBounds`, `intersectsGridBounds`), ensuring the tree never calls PixiJS bounds APIs — it reads the element's own grid-unit bounds directly.

### `GridElement` interface

Defined in `grid-element.ts`. Extends `ContainerChild` with:

- `gridBounds: Rectangle` — the element's axis-aligned bounding box in grid units.
- `intersectsGridBounds(rect): boolean` — the same answer as `gridBounds.intersects(rect)`, derived without materializing the rect. This is what `queryRange` calls: it runs once per candidate on every spatial query, and on a board-sized scan deriving a fresh `Rectangle` per element dominates the cost. Implementations mirror their own `gridBounds` off the shared `overlapsRect` helper in `utils/grid.ts` (`Wire.intersectsGridBounds`; `Component` delegates to `gridBoundsIntersects` in `component-geometry.ts`, which shares its local extents with `gridBounds` so the two cannot drift). Spec sweeps assert the agreement in both.

`Connectable` further extends `GridElement` with `connectionPoints: Point[]`. Both `Component` and `Wire` implement `Connectable`.

### Tree structure

The tree is composed of `QuadTreeEntry<T>` nodes (not exported). Each entry owns two rectangles: `region`, its **tight cell** in the quadrant lattice, and `boundsArea`, its **loose bounds** — the cell doubled in size and centered on it. An element is filed by its **center point** into the deepest cell at least as large as the element, so it always lies within its entry's loose bounds however it overhangs the cell, and a child's loose bounds nest inside its parent's — the containment guarantee query pruning and culling run on. Each entry holds:

- `oversizeItems` — elements too large for any child cell (wider or taller than half the entry). Only an element's **size** parks it above the leaf level; its position never does — an element sitting across a cell boundary files as deep as one in a cell's middle.
- `leafItems` — elements small enough for a child cell, held here while the node is a leaf; `null` once the node has been split into branches.
- `branches` — four child `QuadTreeEntry` nodes (`nw`, `ne`, `sw`, `se`); `null` while the node is still a leaf.

All `QuadTreeEntry` instances live at position `(0, 0)` in the scene graph. Their spatial extent is encoded in `region`/`boundsArea` only — this means reparenting an element between entries never shifts its world coordinates.

### Constants

| Constant              | Value | Meaning                                                             |
| --------------------- | ----- | ------------------------------------------------------------------- |
| `INITIAL_SIZE`        | 64    | Root entry covers `(0, 0, 64, 64)` grid units at construction       |
| `MAX_LEAF_ELEMENTS`   | 4     | A leaf with this many elements splits on the next insert            |
| `MIN_BRANCH_ELEMENTS` | 2     | A branch with fewer total descendants collapses on remove           |
| `MIN_LEAF_SIZE`       | 1     | Leaves of 1 grid cell are never split (prevents infinite recursion) |

The `INITIAL_SIZE` of 64 grid units covers a typical small circuit without any tree expansion. The old pixel-domain value of 1024 covered only ~50 grid cells at `gridSize = 16`.

### `insert(element: T)`

1. Re-tunes the element to the tree's live zoom scale (see [Culling](#culling)) — an arriving element may carry a drag layer's scale or a lagging off-screen entry's.
2. If the element is already tracked, removes it first (handles re-insertion after position change).
3. Reads `element.cullBounds` and calls `expand()` in a loop until the root cell is at least the element's size and contains the element's center.
4. Walks the tree from the root by the element's center. At each node, if the element is too large for a child cell (max dimension over half the node), it parks in `oversizeItems` of the current node. Otherwise descend into the center's quadrant; split if the leaf is full and large enough.

### `remove(element: T): boolean`

Looks up the entry via the `items` Map, removes the element from either `branchItems` or `leafItems`, then calls `minifyBranch` on the entry's parent to potentially collapse the tree. Returns `false` if not found.

### `queryRange(range: Rectangle, out?: T[]): T[]`

Appends the matching elements to `out` — a fresh array when omitted — and returns it. `Project.queryWiresInRange` / `queryComponentsInRange` have the same shape.

Deliberately not a generator: a `yield*` recursion costs a generator frame per visited entry and pushes every result back up the whole delegation chain, which on a deep tree outweighs the per-element tests the walk exists to perform. It also avoids `Object.values(entry.branches)` — a four-element array per visited entry — and tests branch regions with the scalar `overlapsRect`.

Because the result is a snapshot rather than a live view, callers may add or remove elements while iterating it; `SelectionManager`'s scissor cut and `EraseSession`'s sweep both rely on that.

For each entry:

1. Yields `oversizeItems` children whose grid bounds **intersect** `range` (including partial overlaps), tested via `element.intersectsGridBounds(range)`.
2. For each child branch whose **loose bounds** intersect `range`, recurses — the loose bounds, because an element in the subtree can overhang the branch's cell but never its loose bounds.
3. For leaf items, yields those whose grid bounds intersect `range`.

Elements that partially overlap the query rectangle are included. All coordinate comparisons are against the element's grid bounds — the tree never calls `getBounds()` or accesses the PixiJS transform chain.

An element is filed by its size class, so one that is large relative to the board (a long wire) lands in the `oversizeItems` of a shallow entry, where every query descending past it rescans it. That is fine for the interactive queries the tree exists for, but it makes a board-wide scan expensive, which is why `auditWireInvariants` works off its own row/column index and no rect queries at all (see `wires.md` § Board-wide repair).

### Expansion

When an inserted element's center falls outside the current root cell — or the element is larger than the root — `expand()` doubles the root's size toward the center. The old root becomes the child of the new root in the quadrant opposite the expansion direction, so its region — and every element in it — keeps its coordinates; three empty sibling entries fill the other quadrants. The new root is a branch from birth, so it drops the `leafItems` container every entry is constructed with. `minifyBranch` is called immediately to collapse any unnecessary empty structure. Expansion re-files nothing: an element's filing depends only on its own size against its entry's cell and its center lying in that cell, and stacking new ancestors changes neither.

### PixiJS integration note

`QuadTreeContainer` calls `super.addChild()` to attach the internal tree structure, bypassing the public `addChild` override. Callers must use `insert` / `remove` — not `addChild` — to manage elements.

### Debug introspection

Four methods describe the live tree. The commands that call them sit in the title-bar Debug menu (`DebugMenuService`, shown when `DebugMenuToggleService.enabled()` — the `DEBUG_MENU` define sets its initial state, `window.__logigatorDebug()` flips it at runtime) and run over both trees of the active project, which `Project.quadTrees` exposes for that purpose alone.

The walks themselves live in `quad-tree-debug.ts` as free functions over a root `QuadTreeEntry`, the item map (as a `ReadonlyMap`) and a `QuadTreeLimits` object of the container's thresholds; the four methods on `QuadTreeContainer` are one-line delegates that hand over its internals. `QuadTreeContainer` is insert/remove/query/cull/scale, and every report is a read-only walk no mutation path calls into.

| Method                   | Returns                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stats(): QuadTreeStats` | Entry/leaf/branch counts, per-depth histograms of entries, elements and oversize elements, leaf-occupancy histogram, render-group and culled-entry counts, root region + expansion count vs. the occupied extent |
| `formatDistributions()`  | The per-depth and occupancy tallies as bar histograms — the part of a measurement a bar reads better than an array; the scalar counts stay in the stats object                                                   |
| `formatTree(maxDepth?)`  | The entry hierarchy as an indented text tree — region, leaf occupancy, oversize count, cull flag per line                                                                                                        |
| `validate(): string[]`   | One message per invariant violation, empty for a healthy tree                                                                                                                                                    |

The two stats worth reading first: **branch oversize by depth**, because `queryRange` tests every oversize element of every entry it passes through (so a root-level one is tested by every query the tree answers), and **root expansions vs. occupied extent**, because content that drifted into one quadrant of a repeatedly doubled root is invisible in a depth histogram.

`validate()` covers what the `PANIC` throws cannot see on their own: `_items` and the tree agreeing in both directions, an entry being either a branch or a leaf but never both, quadrant cells matching their parent's halves, a leaf a split should have relieved, and — the silent ones — an element whose `cullBounds` left its entry's loose bounds or whose center left the cell it is filed under, i.e. one that moved without being re-inserted, plus an element filed at the wrong level for its size.

The leaf invariant is what `overfullSplittableLeaves` tallies: a leaf whose _contained_ elements exceed `MAX_LEAF_ELEMENTS` at a size a split could still relieve. A leaf over capacity because of straddlers is counted `saturatedLeaves` instead — splitting cannot move those. This is the common case at the bottom of the tree: `Rectangle.containsRect` excludes the far edge, so a 1×1 element does not fit a 1×1 quadrant and unit-sized elements stack as straddlers in a size-2 leaf rather than ever reaching `MIN_LEAF_SIZE`.

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

Draws a `size × size` grid of dots (one `1/scale × 1/scale` rect per grid intersection) into a single `GraphicsContext` chunk. A debug flag (the `SHOW_GRID_BORDERS` define) overlays a red rectangle around the chunk boundary.

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

Off-screen scene nodes are skipped at render time via the plain PixiJS `culled` flag, driven by the app's own grid-space cull pass (PixiJS's `Culler` is not used — it recomputes a world transform per tested node, which dominated pan-frame cost). The board's frame callback runs `project.cull()` immediately before each blit, so the pass runs on every ticker-driven render — including the demand-driven `'single'` frames — and the culled set stays current through pan/zoom with no extra scheduling. `ViewportController.gridView()` folds the camera transform into a single grid-unit view rectangle once (allocation-free), and `QuadTreeContainer.cull(view)` walks each tree testing that rectangle against entry `boundsArea` regions (the loose bounds, which cover everything the entry's elements can overhang) — pure rectangle math, no per-entry matrix work.

**Culling happens only at the quad-tree level — individual elements are never bounds-checked:**

- **Each `QuadTreeEntry`** costs one rect-vs-rect intersection. A culled entry's subtree is skipped by the walk, so an off-screen branch costs one test regardless of content — the quad tree partitions space, keeping the pass sublinear. An intersecting branch recurses so its children are re-tested.
- **Elements** (`Component`/`Wire`) carry no culling state: their `culled` flag stays `false`, and the render pipeline skips them via their culled ancestor entry. An on-screen entry renders all its elements; an off-screen entry is culled whole. Per-frame cull cost is proportional to the number of visible _branches_, not visible _elements_.
- **`Grid`** and **`ConnectionPointLayer`** are never culled: grid chunks are repositioned every frame to fill the viewport, and a flat dot layer with no spatial index would cost an O(n) bounds check per dot with no subtree pruning.

Culling composes with the render-group split (see [Render groups](#render-groups)): a culled entry is also a render group, so its `execute` is skipped wholesale at render time, and a `culled` flip dirties only the instruction set of the nearest enclosing entry group.

Culling sets only the PixiJS `culled` flag and never touches the quad tree's own arrays, so `queryRange` and all collision/connection-point logic are unaffected.

#### The cull pass also drives zoom re-tuning

Every screen-constant visual (stroke widths, port stubs, dots) has to be re-tuned on every zoom step, and doing that board-wide is what made zoom expensive on large boards: it dirties every leaf's transform (PixiJS then recomputes each one) and swaps every body's cached context (which dirties its render group's whole instruction set). The visible payoff is viewport-sized, so the work is scoped to the viewport too:

- **`QuadTreeContainer.applyScale(scale)`** — what `ViewportController` calls per zoom step — walks the tree and **skips culled entries**, stamping each visited entry with the scale it applied (`QuadTreeEntry.appliedScale`).
- **`cull(view)`** compares the stamp of every entry it finds on screen against the live scale and re-tunes the entry's elements when they differ. Since the pass runs immediately before each blit, an element is always current by the time it can be drawn — whether zoom or a pan brought it into view.
- **`insert`** re-tunes the arriving element, so one that comes from a drag layer or out of a lagging off-screen entry is current wherever it lands. **`minifyBranch`** drops the merged entry's stamp, because absorbing a lagging culled child into an on-screen entry is the one case a stamp would otherwise vouch for wrongly.
- **`applyScaleToAll(scale)`** ignores culling, for renders that draw the whole board un-culled: `Project.applyContentScale` wraps it (plus the CP layer) and `BoardSnapshotService` brackets its content pass with it. A tree nobody culls at all — a watch canvas, an offscreen project — has no culled entries, so the ordinary walk already covers everything.

The `ConnectionPointLayer` is not culled, so its dots are still re-tuned board-wide on every step; that is the remaining floor. `ConnectionPoint.scaleForScale` clamps to a fixed pixel size between roughly 0.5× and 1.33× zoom, where the write is a no-op that PixiJS discards, but outside that band every dot is dirtied.

### Render groups

PixiJS caches one instruction set per render group and rebuilds a group's set **in full** whenever anything inside it changes structurally — including any `culled` flip. With the whole scene in the root render group, a single flipped entry would re-collect and re-batch every visible element on every pan frame. The scene is therefore split so rebuilds stay local:

- **Quad-tree entries of size ≥ `RENDER_GROUP_MIN_SIZE` (32 grid units)** are their own render groups. Instruction collection stops at child render groups, so a `culled` flip rebuilds only the nearest enclosing entry group — one region's few elements, never the scene. The threshold trades rebuild-region size against group count: every group breaks batching and adds a small fixed per-frame cost (`updateRenderGroupTransforms`, buffer binds, draw calls). It compares the entry's tight cell size, so the group population tracks the lattice, not the doubled loose bounds.
- **`ConnectionPointLayer`** is one render group, so dot insertions/removals during edits rebuild only the dot layer and root-group rebuilds never re-batch board-wide dots.
- **`Grid`** is one render group. Every zoom step swaps each chunk's context to the new scale's geometry, and a view update inside a group rebuilds that group's whole set: from the root group that re-collects the entire scene outside the nested entry groups, from its own group only the grid. Chunks carry ~1k rects each — past the batchable vertex limit — so they never batched with content and the group boundary costs no draw calls.

### Work-mode integration

`WorkModeService.mode()` and `selectedComponentConfig()` (Angular signals) are mirrored onto the `WorkModeRouter` via an Angular `effect` in `BoardComponent` (`setMode` cancels any active session and clears the selection).

---

## PixiJS-specific patterns

- **`GraphicsContext` sharing** — all geometry is defined once and shared. `Graphics` instances are lightweight wrappers that apply a transform on top of a shared context. This is the PixiJS v8 equivalent of v7 `PIXI.Texture` sharing.
- **No PixiJS events** — `eventFeatures` is disabled at `app.init`; no scene node sets `eventMode`/`hitArea`. All input arrives via the DOM `PointerController`, and element hits are manual quad-tree queries (`queryComponentsInRange` + `bodyGridBounds`/port-distance checks).
- **Demand-driven render loop** — the ticker is stopped between interactions. `'single'` renders one frame for state changes (add/remove element); `'on'`/`'off'` bracket continuous drags. This avoids burning GPU cycles at 60 fps when the canvas is idle. `BoardRenderScheduler` coalesces bursts of `'single'` signals onto a single rAF-driven render so a multi-element operation (undo of a large move, paste, delete) costs one frame, not one per element.
- **Scale-compensated stroke widths** — `ComponentGraphics` bakes `2 / scale` into its stroke width; `GridGraphics` uses `1 / scale` for dot size; `Wire.applyScale` sets `scale.y = 1 / (scale * gridSize)`. `Component` handles the `gridSize` factor via its `_visualSpace` counter-scaling; `Wire` extends `Graphics` directly and must compensate explicitly. On zoom, `Component.applyScale` swaps each scaled element to its correctly-scaled (shared, cached) `GraphicsContext` and updates stub/text scale **in place** — it never rebuilds the component or re-rasterizes a `Text`, so zoom stays cheap on large circuits (see `component-system.md`, "Build vs. rescale").
- **`_visualSpace` counter-scaling** — `Component` owns a child `_visualSpace` with `scale = 1/gridSize`. Visual geometry (chamfers, stroke widths, text) is authored in pixels inside `_visualSpace`; the two scalings (`_gridSpace × gridSize` and `_visualSpace × 1/gridSize`) cancel so existing pixel formulas remain valid.
- **Quad tree uses grid bounds** — `QuadTreeContainer` never calls PixiJS `getBounds()`. All spatial decisions run off the element's grid-unit bounds: filing and splitting read `cullBounds`, and `queryRange` tests candidates through `intersectsGridBounds` (the allocation-free form — a query never materializes a `Rectangle` per element). This avoids scene-graph traversal and makes collision detection integer-exact.
- **Quad tree as PixiJS Container** — `QuadTreeContainer` and its internal `QuadTreeEntry` nodes are real PixiJS `Container` instances in the scene graph. Children keep their world coordinates because all entries sit at position `(0, 0)`; only `region`/`boundsArea` encode the spatial extent. The loose `boundsArea` drives the entry-level cull pass (see [Culling](#culling)) — the tree doubles as both the spatial index for queries and the cull hierarchy, with no separate data mirror. Loose filing is also what makes each element single-parented at a stable depth: exactly one entry hosts it, so the render-group strata stay intact.
