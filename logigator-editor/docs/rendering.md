# Rendering Layer

The rendering layer owns the PixiJS renderer, the scene graph structure, spatial
indexing, shared graphics caching, the DOM input layer, and the transient visuals
of in-progress interactions. `Project` (a plain PixiJS `Container`) is the scene
root and composes every class here.

Two facts shape everything below: the whole app draws through **one** shared
renderer (`RendererService`) — the board and each open watch are render _targets_
of it, offscreen consumers render into textures on it — and **no canvas input goes
through PixiJS events**. The renderer is created with `eventFeatures` off; input
arrives as plain DOM events in `interaction/`, and element hits are manual
quad-tree queries.

## Directory Layout

```
src/app/rendering/
├── assets.service.ts               # Canvas bitmap-font atlas bootstrap
├── board-snapshot.service.ts       # Offscreen render-to-texture (previews, minimap, export)
├── board-surface.service.ts        # Where the board canvas sits on the page (page CSS px)
├── image-export.service.ts         # User-facing image export over BoardSnapshotService
├── renderer.service.ts             # The single lease-counted renderer
├── ticker-scheduler.ts             # Project ticker signals → board frames
├── drag-session.ts                 # DragSession contract
├── floating-layer.ts               # Visual host: drag ghosts + wire-tool hover previews
├── graphics-provider.service.ts    # Shared GraphicsContext cache
├── grid.ts                         # Infinite-seeming background grid
├── grid-element.ts                 # GridElement / Connectable interfaces
├── invalid-tint.ts                 # applyInvalidTint: collision tint / own-tint restore
├── multi-touch-gesture.ts          # Two-finger pan + pinch recognizer
├── placement-ghost.ts              # Single-component preview (hover + placement session)
├── quad-tree-container.ts          # Spatial index + cull hierarchy
├── quad-tree-debug.ts              # Read-only reports over a tree
├── interaction/                    # DOM input: pointer controller, router, per-mode tools
├── graphics/                       # One StaticGraphicsContext subclass per shared shape
└── sessions/                       # One DragSession per interaction + shared collision
```

---

## Core Concepts

### Pixel vs. grid coordinates

Circuit data is in **grid units**. `Project._gridSpace` has
`scale = environment.gridSize`, so `position.set(gx, gy)` on any object inside it
renders at world pixel `(gx * gridSize, gy * gridSize)` — no conversion at the
model layer. `fromGrid(n)` in `utils/grid.ts` survives only where geometry is
still pixel-authored (`Component._visualSpace`, the background grid). Wire
endpoints sit on **half-grid** positions so pins align with cell-edge midpoints.

### Scene graph

```
Project (stage root)                            ← the render root, carries pan/zoom
├── Grid                                        (pixel-authored, outside gridSpace)
└── _gridSpace  (scale = gridSize)
    ├── QuadTreeContainer<Wire>  (_wires)
    ├── QuadTreeContainer<Component>  (_components)
    ├── ConnectionPointLayer  (see connection-points.md)
    └── FloatingLayer
```

`Project` owns camera control (`viewport`), wire topology (`topology`) and the
element maps — see `project.md`. Toward rendering it exposes `ticker$` /
`triggerTicker` and `pasteRequest$` / `rotateRequest$`.

### Ticker signals

The board runs a never-auto-started PixiJS `Ticker`. Projects request frames
through `triggerTicker`: `'single'` for a discrete state change, `'on'`/`'off'`
to bracket continuous motion. `TickerScheduler` turns those into renders.

---

## `interaction/` — DOM input layer

The same two classes drive the board and every watch canvas.

### `PointerController`

**File:** `interaction/pointer-controller.ts`

Per-canvas listener bundle (pointer, wheel, contextmenu; detached through one
`AbortController`). Every event becomes a `PointerInput` —
`{ pointerId, pointerType, global, grid, clickCount }`, where `global` is
canvas-local CSS pixels (what `viewport.pan`/`zoomBy` expect) and `grid` is that
point through `canvasToGrid`, which reads `project.position`/`scale` directly so
it is fresh before the next render.

- **Primary button** — `setPointerCapture` (moves keep flowing when a drag
  leaves the canvas), streamed to the `PointerToolTarget`. Unpressed moves go to
  `hover`, `pointerleave` to `leave`. Click-vs-drag lives in the sessions
  (`PanSession`'s 5 px threshold), not here.
- **Click count** — each primary press carries its position in a run of quick
  presses, the DOM's own rule (within 500 ms and 6 px of the previous press,
  counted from `event.timeStamp` on the press itself), so a tool can tell a
  double click from two deliberate single clicks. Only the wire tool acts on it
  (`work-mode.md` § _Taps and modifiers_).
- **Middle or right button** — pan-only drag by position deltas, bracketed by
  `nav.setActive(true/false)`. The canvas context menu is suppressed outright,
  as is the middle press's `mousedown`, which the browsers would otherwise turn
  into autoscroll.
- **Touch** — pointers feed `MultiTouchGesture` first; a second finger hands
  over to two-finger pan/pinch and cancels the tool stream, so one finger never
  both operates a tool and navigates.
- **Wheel** — non-passive, so page scroll/zoom stops. A mouse wheel zooms at
  the cursor, continuously and in proportion to its delta (`zoomBy`): a 100 px
  notch is one zoom-button step (×1.2). Proportional matters because Chromium
  merges the wheel input between two frames into one event and sums its delta,
  so a fast scroll over a slow frame is one event several notches long. The
  1.2 ladder belongs to the zoom buttons alone; `zoomBy` resyncs it so a button
  press continues from wherever the wheel left the zoom. A trackpad pans with two
  fingers (`PointerNavTarget.scroll`, which requests its own frame) and zooms
  continuously with a pinch, which browsers send as a ctrl-wheel — always at
  the pointer: the scroll events a browser interleaves with a pinch, carrying
  the fingers' drift, are dropped until the pinch ends. The DOM does
  not say which device scrolled; `wheel-input.ts` reads a horizontal component
  as a trackpad and holds that for the rest of a burst of events, and a
  ctrl-wheel of small pixel deltas as a pinch. Nothing weaker counts: fractional
  deltas come from high-resolution mice too (Chromium on Linux), and reading
  them as a trackpad made a mouse pan. A vertical-only trackpad swipe therefore
  zooms, smoothly, as the wheel does. Untuned against real trackpads.

The `PointerNavTarget` comes from the host (the board maps it onto the active
project plus ticker; a watch wraps `pan` to re-blit). Handlers are public so
specs drive them with plain objects instead of synthesized DOM events.

### `WorkModeRouter`

**File:** `interaction/work-mode-router.ts`

The board's `PointerToolTarget`: the current `WorkMode`, a
`Map<WorkMode, BoardTool>`, and the single `_activeDrag`. Mode behavior lives in
the tools; the router owns what must hold across all of them.

- `down` dispatches to the active tool, which opens a session through
  `ToolHost.startSession`. A session that outlives its opening gesture (paste,
  floating rotate/move) instead takes the press via `DragSession.onDown` —
  returning `false` asks the router to cancel it.
- `move` goes to `_activeDrag.onMove`, or to the tool's `hover` with no session.
- `up` asks `session.canEnd()` first; see the commit rules below.
- `cancel()` (a second finger) aborts via `onCancel()`. Escape unwinds one layer
  per press: active drag, then the selection, then the tool (escalating to PAN
  through `WorkModeService` so the toolbar follows). Simulation stays put.
- `setProject` / `setMode` cancel the in-flight session and `deactivate` the old
  tool on the old project, tearing down hover previews.
- **Undo lock** — while a session is live, `ActionManager.locked` is set:
  sessions hold elements detached in the drag layer, and a history operation
  touching them would corrupt the quad tree. The session's commit registers
  before the unlock.
- **Gesture stamp** — `gestureSeq` bumps on up/cancel/context switch; an async
  tool (the placement circuit load) re-validates it, so a stale load never opens
  a session with no pointer left to drive it.
- Paste and rotate stay router-level because they are event-initiated, not
  mode-initiated: a project emits `pasteRequest$` / `rotateRequest$`.

### tools/ — per-mode board tools

**Files:** `interaction/tools/*.tool.ts`, contract in `board-tool.ts`

One `BoardTool` per work mode: `down` opens the session a press means, optional
`hover` drives the previews, `deactivate` tears them down when the tool's context
ends, `onSessionStart` yields the preview to a starting session's ghosts.

| Tool             | Press opens                 | Notes                                                                                                                   |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PanTool`        | `PanSession`                | Tap single-selects.                                                                                                     |
| `SimulationTool` | `PanSession`                | Tap activates: button/switch → `userInput$`, inspectable → `inspectRequest$`. The only canvas interaction while locked. |
| `WireTool`       | `WireToolSession`           | Tap negates a port or toggles a junction; hovers preview the negation bubble / connection dot.                          |
| `SelectTool`     | move or marquee session     | One instance per flavor (SELECT, SELECT_EXACT); a press inside the committed grab zone moves instead of marqueeing.     |
| `PlacementTool`  | `ComponentPlacementSession` | Holds the palette config, follows the cursor with a `PlacementGhost`, awaits a cloud master's circuit load.             |
| `EraseTool`      | `EraseSession`              |                                                                                                                         |

The wire tool's previews survive a press and hide only once the gesture becomes
a drag; after a tap they re-derive in place. Its connection ghost dry-runs
`topology.connectionToggleKindAt`, so a non-toggleable T-junction shows nothing.

Per tool, beyond the table above:

- **`PanTool`** — with `dragSelectionInPanMode` on (the default) a press that
  grabs the committed selection opens a `SelectionMoveSession` instead, so a
  selection made by a tap can be dragged without leaving the hand tool; every
  other press pans, and the setting off pans on every press.
- **`WireTool`** — a press inside a selected component's body opens a
  `SelectionMoveSession` instead of drawing (a run from there collides with that
  body and is discarded anyway). Tap precedence: port negation →
  `topology.toggleConnectionAt` (which returns the action it recorded) → a plain
  select click through `SelectionManager.commit`; with the additive modifier
  held only that click or toggle happens, ahead of both circuit actions. A press
  whose `clickCount` continues the previous tap takes that tap back and swallows
  its own (`work-mode.md` § _Taps and modifiers_).
- **`SelectTool`** — a press on the selection that never moved runs
  `SelectionManager.clickInSelection`: narrow to the pressed element, or toggle
  it with the additive modifier.
- **`PlacementTool`** — `rotate(steps)` steps the sticky placement direction and
  turns the live preview; a direction the settings panel changed mid-hover is
  picked up on the next pointer move.
- **`EraseTool`** — Escape during the sweep cancels the session, which re-adds
  everything it removed.

---

## `TickerScheduler`

**File:** `ticker-scheduler.ts`

Translates one project's `ticker$` into frames of the board's ticker;
`BoardComponent` builds one per project and destroys it on switch, so a run-count
never leaks across projects.

**Reference-counted run-count** — any number of concerns (a simulation run, a
pan, a drag) hold the ticker on at once through `'on'`/`'off'`; it stops when the
last releases. Without it, finishing a pan would stop the ticker a running
simulation still needs. While the count is non-zero, `'single'` is a no-op.

**`'single'` coalescing** — one user operation can emit many `'single'`s
synchronously (undoing a move repositions N elements). The first queues a
`requestAnimationFrame` render, the rest are no-ops until it fires, and the
callback re-checks the run-count. So renders never outpace the display, and the
ticker still stops when idle — no always-running rAF loop.

> Renders are therefore deferred to the next animation frame. Code must not
> assume the canvas is up to date in the same synchronous tick as a `'single'`.

---

## `RendererService`

**File:** `renderer.service.ts`

The app's single PixiJS renderer. Canvases lease it (`acquire()` →
`lease.render(container, canvas)`); offscreen consumers read the `renderer`
getter and gate on the `available` signal instead of leasing, since they only
render while a canvas host is alive.

- Created lazily on the first lease (`autoDetectRenderer`, `webgl` → `canvas`),
  destroyed when the last lease releases. The board holds one for its lifetime.
- **WebGPU is deliberately disabled** — see `docs/webgpu.md` for the findings and
  the re-enablement checklist. One consequence lives in code:
  `BoardSnapshotService` honors `SnapshotOptions.coverageBoost` on WebGL only,
  whose readbacks come back darker.
- WebGL runs with `multiView` — an off-DOM master canvas blitted to each target,
  one extra copy per frame.
- `lease.render` sizes the backing store through the target's cached
  `CanvasSource` (CSS box × DPR), never via `canvas.width`, which would desync
  pixi's cached render target. Render space stays CSS pixels; the DPR only
  sharpens.
- **Culling is the caller's concern.** The board culls before rendering; a
  watch calls `Project.uncull()` and a snapshot `Project.presentForSnapshot()`
  instead, since no cull pass runs for them and `culled` bits from another view
  would hide content. Both visit the quad trees' group roots only — nothing
  below one, and no element, is ever culled.

---

## `Grid`

**File:** `grid.ts`

An infinite-looking dot grid tiled from fixed 32-grid-unit `Graphics` chunks that
share one `GraphicsContext` per `(chunkSize, scale)` pair. `draw()` creates,
repositions or destroys chunks to cover the viewport, and the container is offset
by `chunkAligned(-position/scale)` so panning shifts the tiling modulo one chunk —
continuous scroll over a viewport-sized set. `updateScale` swaps each chunk's
context rather than rebuilding the set: the context bakes `1/scale` dot sizes so
dots stay one screen pixel. Below 0.25 zoom the dot alpha halves.

---

## `FloatingLayer`

**File:** `floating-layer.ts`

A `Container` inside `_gridSpace`, above the permanent layers — so its
coordinates are grid units too. Purely visual: it hosts the transient overlays of
in-progress interactions while lifecycle stays in the router. It holds
`_dragLayer` (ghosts and detached elements), the lazily-created negation and
connection-toggle hover ghosts, and — transiently, added by `SelectRectSession` —
the select rect.

**`updateScale(scale)`** forwards `applyScale` to everything in `_dragLayer`.
This is load-bearing: elements detached for a drag are absent from the quad
trees, so `Project.updateScale` would otherwise miss them.

### Sessions

Each session in `rendering/sessions/` implements `DragSession`: `onMove`,
`onEnd`, `onCancel`, `canEnd`, plus the optional `onDown` for sessions that
outlive their opening gesture.

**Commit convention** — every mutating session **materializes its final state in
the live project**, then records via `ActionManager.register` (record without
`do()`). `push` — record _and_ run — is reserved for instantaneous non-gesture
operations (wire-tap toggles, option panels). See `actions-system.md` §
_push vs register_.

**`canEnd()`** is asked before committing; collision sessions return
`!_hasCollision`. What a blocked release does depends on
`discardOnInvalidRelease`: placement and wire drawing set it, so a colliding drop
is abandoned and the ghost clears for the next attempt; move and paste leave it
unset and stay frozen until the user finds a valid drop.

| Session                     | Shape                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ComponentPlacementSession` | Wraps `PlacementGhost` — a fresh `Component` in `_dragLayer` at the snapped pointer. On commit it integrates the ghost's ports against the net and adds that same instance, never a copy.  |
| `SelectionMoveSession`      | Detaches the selection into `_dragLayer` and offsets the layer; commit applies the delta, reattaches, re-integrates wires. Also carries `rotate` and `moveBy`.                             |
| `WireToolSession`           | Two lazily-created `Wire`s forming an L, axis locked to whichever moved first; commit integrates and destroys only the instances the net did not absorb.                                   |
| `SelectRectSession`         | Scales `_selectRect` by the grid delta, then hands a normalized `Rectangle` to `selectionManager.commit`. A zero-area rect is the single-click hit test.                                   |
| `PastePlacementSession`     | Two-phase: ghosts wait where the router put them (`onMove` is a no-op) until a press inside the group's padded rect calls `beginDrag`; a press outside cancels and destroys the instances. |
| `EraseSession`              | Sweep-erase, registers on release.                                                                                                                                                         |

**Placement commit** — the ghost is built from the **palette config** (the
master, for a custom) and stays on it for the whole gesture, so what the settings
panel writes while placing (options, direction) lands on the very config the
commit builds from. A custom master is frozen **at commit**: the ghost
round-trips through `Component.serialize`/`deserialize` onto the placement
snapshot's config, carrying position, direction, options and negations, so a
setting added later is carried with no code in the session. A built-in lands as
the ghost itself (`PlacementGhost.release()` drops the selection look) and a
frozen replacement destroys it. `rotate(steps)` turns the ghost to the stepped
sticky placement direction.

**Paste positioning** — the router shifts the fresh instances by whole grid units
onto the cursor, or onto `viewport.gridView`'s centre when there is none (touch
never sets a cursor, leaving the canvas clears it). The resting cursor is stored
in canvas-local pixels and mapped at paste time: pans and the zoom buttons move
the camera with no pointer move behind them, so a stored grid coordinate would be
stale.

**Rotate flow / move flow** — `R`/`Shift+R` and the arrow keys land in the router
(the toolbar and mobile selection bar go through
`Project.requestSelectionRotation`). Both forward to the open session's
`rotate(steps)` / `moveBy(dx, dy)`; with only a hover preview standing they ask
the active tool first — `BoardTool.rotate?(steps)`, which turns the armed
placement ghost and returns true when the request is spent; with none, they open
a `SelectionMoveSession` over the committed selection with **no drag anchor**,
apply one step, and commit synchronously when collision-free — an in-place edit,
each press its own undo step. A colliding step instead leaves the red-tinted
group floating (still selected) until a further step or drag lands it somewhere
valid;
`_commitIfFloatingAndValid` commits the instant it becomes valid, gated on
`isAwaitingGrab()` so a turn mid-pointer-drag does not commit under the cursor.
Escape or a press off the selection reverts.

Rotation is exact quarter-turn arithmetic around the snapped bounding-box centre
(`sessions/rotate-elements.ts`), so grid and half-grid coordinates survive, and
the frozen grab rect turns with the group. Mid-drag, `moveBy` shifts the
drag-layer offset _and_ the locked anchor in the opposite direction, so the next
pointer move preserves the shift instead of snapping the group back under the
cursor. Clipboard `cut`/`delete` are gated on `actionManager.locked` so the
toolbar cannot delete elements a session holds detached.

A drag that commits a live scissor cut coalesces the cut's history entry with its
own into one undo step (`SelectionManager.consumeLiveCut` +
`ActionManager.coalesceTop`).

### Collision tint

`DragCollisionState` (`sessions/drag-collision.ts`) is shared by the move and
paste sessions: per `update()` it derives world bounds (`gridBounds +
dragLayer.position`) and runs the project's component–component,
component–wire-body and wire–component-body queries. `PlacementGhost` and
`WireToolSession` run their own narrower queries.

All of them tint through `applyInvalidTint` (`invalid-tint.ts`), which tints
**elements individually, never the drag layer**: a container tint multiplies with
the children's own tints — wires carry their color as tint over a white base — so
a layer tint would darken the invalid red toward black. Tints are written only
when the collision state flips. `reset()` restores each element's own tint, and
sessions call it before reattaching or committing so a cancel mid-collision does
not leak the red onto the board.

| Value                       | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| selection look (`selected`) | Ghost default — theme `selectTint` / `wireSelectColor`         |
| theme `invalid`             | Collision — per element, never on the drag layer               |
| `refreshTint()`             | Neutral — each element re-derives its own theme/selection tint |

---

## `QuadTreeContainer<T extends GridElement>`

**File:** `quad-tree-container.ts`

A `Container` subclass maintaining a **loose quad tree** (looseness factor 2)
over its children, used as `_wires` and `_components`. It is both the spatial
index and the cull hierarchy, with no mirrored data structure.

`GridElement` (`grid-element.ts`) is what keeps the tree off the PixiJS bounds
APIs: `gridBounds`, `cullBounds`, and `intersectsGridBounds(rect)` — the same
answer as `gridBounds.intersects(rect)` without materializing a `Rectangle`,
because `queryRange` runs it once per candidate and on a board-sized scan the
allocation dominates. Implementations share the `overlapsRect` helper, and
`Component` derives both from the same local extents in `component-geometry.ts`
so the two cannot drift. `Connectable` adds `connectionPoints`.

`pickBounds` / `intersectsPickBounds` are the pair `queryRange` tests: what a
click selects by, which is the footprint unless the element draws beyond it — a
text label widens it to its glyph box, so a click, a marquee or an eraser sweep
reaches the element where the user sees it. The tree still **files** by
`cullBounds`, which therefore has to cover the pick bounds; collision and the
element's own bounds keep reading `gridBounds`, while everything that frames
content — export, previews, the minimap, a watch view — reads `cullBounds`, so
a label is inside the frame it is subtracted from.

### Tree structure

Each `QuadTreeEntry` owns a **tight cell** (`region`, its slot in the quadrant
lattice) and **loose bounds** (`boundsArea`, the cell doubled and centered on
it). An element files by **center point** into the deepest cell at least as large
as itself, so it always lies inside its entry's loose bounds however it
overhangs, and a child's loose bounds nest in its parent's — the containment
guarantee query pruning and culling run on. Only an element's _size_ parks it
above the leaf level (in `oversizeItems`); its position never does.

Every entry sits at position `(0, 0)`; the spatial extent is `region`/
`boundsArea` alone, so reparenting an element never shifts its world coordinates.

| Constant              | Value | Meaning                                                      |
| --------------------- | ----- | ------------------------------------------------------------ |
| `INITIAL_SIZE`        | 64    | Root cell in grid units — a small circuit needs no expansion |
| `MAX_LEAF_ELEMENTS`   | 16    | A leaf this full splits on the next insert                   |
| `MIN_BRANCH_ELEMENTS` | 8     | A branch with fewer descendants collapses on remove          |
| `MIN_LEAF_SIZE`       | 1     | One-cell leaves never split (stops infinite recursion)       |

The leaf limits were measured on the 99k-component bench board
(`plans/rendering_bench.json`), 4 against 8 against 16 with `MIN_BRANCH_ELEMENTS`
at half. 16 halves the entries against 8 (components 17.6k vs 34.9k, wires 15.0k
vs 24.0k; 4 made 47.0k and 44.3k) — each entry being three containers every
render-group build recurses through — and built the board no slower (4 was
clearly slowest). Queries barely moved: a marquee-sized query costs the same
within noise, dominated by the elements it returns, and a drag-collision-sized
one ~40 µs instead of ~30 µs, against a handful issued per pointer move. Leaf
size no longer affects culling or rebuild granularity, both being the render
group's.

**Callers must use `insert`/`remove`, not `addChild`** — the container's
`super.addChild` is reserved for the internal tree structure.

`expand()` doubles the root toward an out-of-range center, making the old root a
child in the opposite quadrant so its coordinates survive. Expansion re-files
nothing: filing depends only on an element's size against its entry's cell and
its center lying in that cell, and stacking ancestors changes neither.

### `queryRange(range, out?)`

Appends matches to `out` (a fresh array when omitted) and returns it: oversize
items whose grid bounds intersect, then recursion into branches whose **loose**
bounds intersect (an element can overhang the cell but never the loose bounds),
then intersecting leaf items. Partial overlaps count.

Deliberately not a generator — a `yield*` recursion costs a frame per visited
entry and re-yields every result up the delegation chain, outweighing the
per-element tests the walk exists for. It also avoids the four-element array
`Object.values(entry.branches)` allocates.

The result is a snapshot, not a live view, so callers may mutate while iterating
it — the scissor cut and `EraseSession`'s sweep both rely on that.

An element files by size class, so a long wire lands in the `oversizeItems` of a
shallow entry that every descending query rescans. Fine for interactive queries,
expensive for board-wide ones — which is why `auditWireInvariants` uses its own
row/column index and no rect queries (`wires.md` § Board-wide repair).

### Debug introspection

`stats`, `formatDistributions`, `formatTree` and `validate` are one-line
delegates over read-only walks in `quad-tree-debug.ts`, driven from the title-bar
Debug menu. The two numbers worth reading first: **branch oversize by depth** (a
root-level oversize element is tested by every query the tree answers) and **root
expansions vs. occupied extent** (content drifted into one quadrant of a doubled
root is invisible in a depth histogram).

`validate()` catches what the `PANIC` throws cannot — above all an element whose
`cullBounds` left its loose bounds or whose center left its cell, i.e. one moved
without re-insertion. It distinguishes two overfull leaves: `Rectangle.containsRect`
excludes the far edge, so a 1×1 element does not fit a 1×1 quadrant and unit-sized
elements pile up as straddlers a split cannot relieve (`saturatedLeaves`), not as
`overfullSplittableLeaves`.

---

## Culling

Off-screen nodes are skipped via the plain PixiJS `culled` flag, driven by the
app's own grid-space cull pass. PixiJS's `Culler` is not used: it recomputes a
world transform per tested node, which dominated pan-frame cost. The board's
frame callback runs `project.cull()` immediately before each blit — so the pass
also covers demand-driven `'single'` frames and needs no scheduling of its own.
`ViewportController.gridView()` folds the camera into one grid-unit rectangle
(allocation-free) and `QuadTreeContainer.cull(view)` tests it against entry
`boundsArea` regions — pure rectangle math, no matrices.

**Culling happens at render-group granularity only; elements are never
bounds-checked.** The walk tests the entries that root a render group (size ≥
`RENDER_GROUP_MIN_SIZE`, `QuadTreeEntry.isGroupRoot`) and stops there: entries
below a group root are never culled, and a group on screen draws its whole
subtree. A culled group is skipped whole, so an off-screen region costs one test
regardless of content and per-frame cost tracks visible _groups_, not visible
entries or elements. "Skipped whole" depends on the local pixi.js patch
described under [Render groups](#render-groups): stock PixiJS skips it only when
drawing, and still transforms and builds it.

Culling finer than a group was dropped because it bought nothing and cost the
most: a flip of an entry inside a group is a structural change that rebuilds the
whole containing group, the same as the group itself flipping, and constant
flips at the viewport edge kept rebuilding groups on a pan; what it saved was
drawing the off-screen part of a group partly on screen, which the GPU clips.
And the walk visited every entry of both trees on each frame of a zoomed-out
pan — 1.37 s of 2.18 s of frame time in a trace of the bench board, with the
main thread saturated. `Grid` and `ConnectionPointLayer` are never culled: chunks are
repositioned every frame anyway, and a flat dot layer with no spatial index would
cost an O(n) check per dot with nothing to prune.

Culling only writes the `culled` flag and never touches the tree's arrays, so
queries and collision logic are unaffected.

### The cull pass also drives zoom re-tuning and snapshot restore

Every group root carries a **presentation stamp** (`QuadTreeEntry.presentation`):
the zoom scale its group's elements' screen-constant visuals (stroke widths,
port stubs, dots) are tuned to, and whether their text is hidden. A stamp covers
the group's own elements and those of every entry below it down to the next
group root, which stamps its own; entries below a group root carry none. The
board's presentation is the live zoom with text shown. Switching a group is not
cheap — a re-tune dirties every leaf's transform and swaps every body's cached
context, a text flip is a structural change — and doing either board-wide is
what made zoom and the minimap expensive. The payoff is viewport-sized, so the
work is too:

- **`setBoardScale(scale)`** moves the board's presentation and re-tunes
  nothing. A zoom step only records its scale on the `Project`; the pass before
  the next render (`Project.cull`, or `uncull`/`presentForSnapshot` for renders
  without one) hands it to the trees, the connection-point layer and the
  floating layer. Several wheel events inside one frame therefore cost one
  re-tune, to the scale the frame draws with. This is not a debounce: the
  re-tune still lands before the frame it affects, so no stroke is ever drawn
  at a stale width.
- **`cull(view)`** compares each on-screen group's stamp against the board's and
  catches it up on mismatch — all of a visible group, including the part of it
  off screen. Running right before each blit, an element is current by the time
  it can be drawn, whether zoom, a pan or a snapshot left it behind. Only the
  half of the stamp that differs is applied.
- **`present(presentation)`** is the snapshot's walk
  (`Project.presentForSnapshot`): it un-culls every group and switches the ones
  not already in the snapshot's state. The restore is just the next
  **`cull`** (`Project.restoreBoardPresentation`), so only what the viewport
  shows returns to the board. Off-screen groups keep the snapshot's state —
  and, being skipped while culled, their instruction sets — so a repeated
  snapshot (the minimap, after every committed action) finds them current and
  costs what the viewport moved through, not the board.
- **`uncull()`** is `present` in the board's presentation, for the watch canvas,
  which renders a project no cull pass ever runs on.
- **`insert`** tunes the arriving element to the stamp of the group it lands in
  (it may carry a drag layer's, a lagging group's or a snapshot's state).
  **`splitLeaf`** hands the leaf's stamp to children that root groups of their
  own; smaller children stay under the group's. **`expand`** gives the new,
  empty groups the board's (any stamp is true of an empty group), and
  **`minifyBranch`** absorbing child groups keeps a stamp only if every element
  it gathers shares it — absorbing a culled group in another state is the one
  case a stamp would otherwise vouch wrongly; merging entries below a group root
  leaves the stamp alone, their elements being under it already. The root never
  shrinks below `INITIAL_SIZE`, so every entry has a group root at or above it.
  **`detach`** (a drag session taking elements out) returns them to the board's
  presentation, so a ghost is never dragged at a snapshot's scale with its
  labels hidden.

Text hiding needs no tree walk: a component registers every text node it draws
through `Component.addText`, and `setTextHidden` flips those; the state survives
`_draw()`, so a redraw's new texts are born hidden too.

`ConnectionPointLayer` is not culled, so its dots are still re-tuned board-wide —
the remaining floor. Between roughly 0.5× and 1.33× zoom `scaleForScale` returns a
constant, so the write is a no-op PixiJS discards; outside that band the clamp to
a fixed screen diameter makes it zoom-dependent and every dot is dirtied.

## Render groups

**pixi.js carries a local patch** (`.yarn/patches/pixi.js-npm-8.21.0-*.patch`,
applied through the `patch:` protocol in `logigator-editor/package.json`). Stock
`RenderGroupSystem._updateRenderGroups` recurses into every child render group
without looking at whether it will be drawn, and `_buildInstructions` starts
from the group root's children, past the root's own `culled` check. A culled
entry was therefore skipped only when the frame was drawn: its transforms were
updated and its instructions built — every `BitmapText` and `Graphics` set up on
the GPU — like a visible one's. On a 99k-component board that was ~2.7 s of the
first frame, for a viewport showing a few percent of it. The patch skips a child
group whose root's `globalDisplayStatus` is below 7 (culled, invisible or
unrenderable — exactly what makes the parent leave it out of its own
instructions), with its descendants. Nothing is cleared: its
`structureDidChange` and pending update lists wait, and the first visit after it
comes back applies them. The GC's per-frame tick walk is separate and still
reaches skipped groups, so their renderables count as used and are never
unloaded while culled. `render-group-culling.spec.ts` fails if a pixi.js upgrade
drops the patch; a new version needs the patch regenerated (`yarn patch
pixi.js`), and `.angular/cache` cleared before `ng serve` serves it.

PixiJS caches one instruction set per render group and rebuilds it **in full** on
any structural change inside — a `culled` flip included. With the whole scene in
the root group, one flipped entry would re-batch every visible element per pan
frame. The scene is split so rebuilds stay local:

- **Quad-tree entries of size ≥ `RENDER_GROUP_MIN_SIZE` (32 grid units)** are
  their own groups, so a flip rebuilds one entry-sized region. Lower means
  smaller rebuilds but more groups, each breaking batching and adding fixed
  per-frame cost for every visible one (a culled group costs nothing per frame,
  given the patch above). The threshold compares the tight cell, so the group
  population tracks the lattice, not the doubled loose bounds. It is also the
  cull and stamp granularity (see [Culling](#culling)).
- **`ConnectionPointLayer`** is one group, so dot churn during edits never
  re-batches the board.
- **`Grid`** is one group: a zoom step swaps every chunk's context, which from
  the root group would re-collect the entire scene. Chunks carry ~1k rects each,
  past the batchable vertex limit, so they never batched with content anyway and
  the boundary costs no draw calls.

---

## Shared graphics

`GraphicsProviderService` (root-provided) deduplicates the `GraphicsContext`
geometry many `Graphics` share, keyed by constructor then `params.join()` — every
caller passes numbers. `Wire` and `Grid` reach it through `getStaticDI`, being
plain PixiJS classes.

Only `StaticGraphicsContext` subclasses (`graphics/`) are cacheable: each bakes
its geometry in its constructor and is immutable after, and the cache never
evicts. The base class encodes that contract in a perf-critical way — it drops
all `update`/`unload` subscriptions (`on`/`once` no-op for those events) and sets
`autoGarbageCollect = false`, so a dropped `unload` can never leave `Graphics`
holding stale batch clones. Neither event can say anything about an immutable,
never-collected context, and empty listener lists make a context swap O(1) per
`Graphics`. With the stock subscriptions, eventemitter3 rebuilds the shared
listener array on every detach, making the zoom-step swap wave over a big board
quadratic — the dominant cost in zoom profiles.

The subclasses bake scale compensation so strokes stay screen-constant:
`ComponentGraphics` (chamfered body rect, `2 / scale` stroke, theme colors read at
construction), `GridGraphics` (`1/scale` dots), and the white unit rects of
`WireGraphics` / `ConnectionPointGraphics`, whose color is the per-instance tint so
the context stays theme-independent — plus the per-component shapes.

**Scale-keyed contexts are baked at the zoom's stroke rung, never the raw
scale** (`graphics/stroke-scale.ts`, `strokeScaleFor`): the nearest power of
1.05, so a stroke is within ±2.5% of its intended width. The zoom itself is
continuous (wheel, pinch), and the cache never evicts, so a raw-scale key would
bake a new context per wheel event for every body size on screen, for the rest
of the session. `Component.addScaledGraphics`, the negation bubble and ghost and
the grid all snap. The board's content is tuned to the same rung
(`Project._applyPendingScale`), so a zoom that stays within one rung re-tunes
nothing and swaps no context — no render group rebuilds — and crossing a rung
costs one re-tune. Transform-only compensation (port stubs, wires, dots) is
tuned to the rung with everything else, holding it to the same ±2.5%.

## `AssetsService`

**File:** `assets.service.ts`

Registers the woff2 faces with PixiJS `Assets`, then in `init()` bakes the
bitmap-font atlases: the general canvas font (`CANVAS_FONT_FAMILY`, Roboto Mono)
plus the DSEG7/DSEG14 segment-display faces. All canvas text is `BitmapText` from
these atlases, so zoom scales glyph quads instead of re-rasterizing. Glyphs bake
at 96 physical px (48 px × resolution 2), above the largest size built-in text
reaches on screen; characters outside the baked set (`CANVAS_FONT_CHARS` —
printable ASCII, Latin-1, Latin Extended-A) are silently dropped. `dynamicFill`
keeps the atlas white, so a `BitmapText`'s `fill` acts as a per-instance tint.

The FontFace is registered under the bake-only family `Roboto Mono Canvas`, not
`Roboto Mono`: the Google Fonts stylesheet registers lazy same-named faces, and
resolving the bake to a still-unloaded one would rasterize a fallback into the
atlas.

`BoardComponent.ngOnInit` awaits `init()` before acquiring the renderer lease, so
the atlas exists before scene construction creates any `BitmapText`.

Its constructor also installs `installAsciiGraphemeFastPath`
(`grapheme-segmenter.ts`) over PixiJS's public
`CanvasTextMetrics.graphemeSegmenter`, which every text layout calls — more than
once per `BitmapText` — and whose default is an `Intl.Segmenter` pass: about
670 ms on a big board's first full render. ASCII other than CR is split per
character, which is exactly what the segmenter answers for it (CR LF is the one
ASCII pair forming a single cluster); anything else goes to the original.

---

## `BoardComponent` wiring

`ui/board/board.component.ts` is the Angular host, owning only what is
per-canvas. It awaits `AssetsService.init()`, acquires a renderer lease for its
lifetime, runs the cull-then-blit ticker, builds a `TickerScheduler` per project,
re-homes the `WorkModeRouter` on project switches, feeds `resizeViewport` from a
`ResizeObserver`, and creates the `PointerController` with the router as tool
target and the active project as nav target. `WorkModeService.mode()` and
`selectedComponentConfig()` are mirrored onto the router through an Angular
`effect`.

## PixiJS-specific patterns

- **No PixiJS events** — `eventFeatures` is off at renderer creation and no node
  sets `eventMode`/`hitArea`. Hit testing is quad-tree queries plus
  `bodyGridBounds`/port-distance checks.
- **Demand-driven render loop** — the ticker is stopped between interactions, so
  an idle canvas burns nothing.
- **Scale-compensated stroke widths** — contexts bake `1/scale` factors;
  `Component` gets the `gridSize` factor from `_visualSpace` counter-scaling
  (`scale = 1/gridSize`, cancelling `_gridSpace`), while `Wire` extends
  `Graphics` directly and compensates explicitly in `applyScale`.
- **Rescale in place, never rebuild** — `Component.applyScale` swaps to the
  correctly-scaled shared context and updates stub/text scale in place; it never
  re-runs `_draw()` (see `component-system.md`, "Build vs. rescale").
