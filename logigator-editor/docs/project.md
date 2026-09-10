# Project Layer

`Project` is the root PixiJS scene node the board renders and the single source
of truth for circuit state. `ProjectService` is the Angular-managed registry of
loaded and active projects. Beside them in `src/app/project/`:
`selection-manager.ts`, `selection-inspector.service.ts` (selection summary for
UI panels), `editor-command-state.service.ts` (which toolbar commands are
no-ops), `viewport-controller.ts`, `wire-topology.ts` + `wire-integrator.ts` +
`wire-line-index.ts`, and `wire-repair.ts` + `wire-repair.service.ts`.

## Scene graph and coordinates

```
Project (render root)
├── Grid                             — infinite background dots (pixel-authored)
└── _gridSpace                       — scale = gridSize; coordinates are grid units
    ├── QuadTreeContainer<Wire>
    ├── QuadTreeContainer<Component>
    ├── ConnectionPointLayer          — derived junction dots
    └── FloatingLayer                 — transient interaction overlay
```

All circuit data is stored in **grid units**. `_gridSpace` has
`scale.set(environment.gridSize)`, so a component's PixiJS `position` **is** its
grid-unit position — nothing converts. Pan and zoom write only `Project.position`
and `Project.scale`; element positions never move. `_gridSpace` is public as
`gridSpace`, so a pointer event resolves straight into grid units
(`e.getLocalPosition(project.gridSpace)`).

`Project` listens to no pointer events — the DOM `PointerController` drives the
camera (see `rendering.md`). `actionManager` and `selectionManager` are public
plain-class peers owned by `Project`, neither Angular-managed.
`connectionPoints` owns the derived junction dots: not persisted, not selectable
(see [`connection-points.md`](connection-points.md)).

## Camera — `project.viewport` (`ViewportController`)

Stepped zoom walks the ladder `1.2^step`, `step ∈ [-12, +5]` (≈0.112 – 2.49);
`zoomBy` (pinch) and `fitBounds` are continuous but clamp to the same bounds and
resync the step. Pivot-correct zoom is a matrix chain `translate(-center) →
unscale(old) → scale(new) → translate(+center)`, keeping the point under the
cursor fixed.

The camera keeps an exact `_truePosition` and hands the container only its
device-pixel-snapped mirror: wires are one-device-pixel hairlines that shimmer
under a fractional translation, and snapping the source would accumulate drift.
`viewportChange$` / `viewportState` publish `{ gridOrigin, scale, viewportSize }`
for overlays.

A zoom re-tunes scale-dependent visuals through the quad trees' `applyScale`,
which touch **on-screen entries only**; `Project.cull()` catches an off-screen
entry up on the frame that un-culls it (`rendering.md` § Culling). Zoom methods
request one `'single'` render frame; pans don't — they only happen inside
gestures that already hold the ticker on.

## Circuit mutation

Adds, removes, moves and rotations go through `Project` (`addComponent`,
`removeComponent`, `addWire`, `removeWire`, `moveComponent`, `moveWire`,
`rotateComponent`, `setWireGeometry`), never through the quad trees directly.
Each keeps the id → element maps in lock-step with quad-tree membership, so
`getComponentById` / `getWireById` are O(1) and a drag-detached element is absent
from both. `QuadTreeContainer.insert` re-buckets an already-tracked element and
re-tunes it to the live zoom, so a move is just "write position, then insert".

**Connection-point ordering is an invariant:** removals snapshot the old geometry
(`Wire.snapshot` / `component.connectionPoints`) **before** mutating the quad tree
and recompute **after** the tree reflects the post-state; adds mirror it. The CP
manager queries the trees to decide. `evict` runs before `destroy()` for the same
class of reason. Bulk loaders pass `deferConnectionPoints = true` and follow with
one `recomputeConnectionPoints()` instead of a query per element.

`addComponent` subscribes to `component.portsChange$`. That handler **skips
itself while the component is not indexed** (mid-drag, or inside
`rotateComponent`, which unindexes around the direction write): the owner
re-buckets and integrates undoably itself, so an automatic pass would corrupt the
detach and double-apply the integration. When it does run, it re-buckets and then
applies `topology.integrate` **outside `ActionManager`** — the splits and merges a
rotation implies are deliberately not undoable.

`topology.integrate(input)` is a pure read: it returns `{ toAdd, toRemove }` and
mutates nothing. Callers materialize the result and record
`ActionContainer(RemoveWiresAction, AddWiresAction)` alongside their primary
action, so a gesture and its implied splits/merges undo atomically. See
[Wire Integration Invariants](wires.md#wire-integration-invariants).

### Collision and queries

`queryComponentsInRange` / `queryWiresInRange` return a snapshot, so the project
may be mutated while iterating; pass `out` to query into a reused buffer.
`hasComponentCollision(bounds, bodyBounds, excludeIds?)` blocks only when a
**body** meets the other component's full extent — stub-on-stub overlap is legal
(perpendicular wire ends at a corner). `hasWireBodyCollision` tests against the
stub-free body, so a wire endpoint on a stub tip is not a collision, and skips
`ignoresWireCollision` types; `hasComponentBodyWireCollision` is its mirror.

### Drag operations

`detachForDrag` / `reattachFromDrag` move elements out of and back into the quad
trees and id maps without touching the action system — the caller records undo
separately. They only keep the CP manager's termination counts in step; the dots
themselves stay put until the session settles them
(`connectionPoints.captureDragCps` during the drag,
`recomputeCpsForMovedSelection` after reattach). Destroyed elements are skipped.

### Reactive outputs

`ticker$` (render-loop signals for the hosting canvas), `pasteRequest$` and
`rotateRequest$` (UI surfaces emit, the `WorkModeRouter` executes), `userInput$`
and `inspectRequest$` (simulation-mode taps). A theme effect re-derives every
theme-dependent color in place via `applyTheme()`, so a background tab the stage
swap never redraws self-heals too.

## `ProjectService`

Root-provided singleton over three signals: `mainProject` (the user's circuit),
`openComponents` (custom-component editor tabs, reorderable), and `activeProject`
(what the canvas shows; follows `setMainProject`, moves with `setActiveProject`,
reverts to `mainProject` when the active tab closes).

`mainProjectReplaced$` emits the **outgoing** project synchronously from inside
`setMainProject`, before the signals move — the seam for state tied to a project
the caller is about to destroy (`SimulationService` winds its session down there).
Silent on the first assignment.

## `SelectionManager`

Owns the committed selection — what stays selected across pointer interactions —
plus the grab rect and the live scissor cut. `clear()`, `boundingBox()` and
`isGrabbedAt()` skip `destroyed` elements, guarding paths that destroy an element
without going through `Project.removeComponent` / `removeWire`.

### Grab rect

The persistent rect is **frozen at the shape it was set with and never re-fit to
content**: a marquee stays exactly as drawn. `grabRect()` translates it by however
far the bounding box has moved since it was anchored, so it follows a committed
move (and its undo/redo) without resizing. `freezeGrabRect` replaces it wholesale
(rotation turns the rect with the selection); `clearGrabRect` drops it while
keeping the selection.

The same rect answers `isGrabbedAt(gridPoint)` — the router's
move-vs-new-selection hit test — so what the user sees and what they can grab
cannot drift. A single-click selection draws nothing and has no rect; grabbing
then falls back to the elements' own bounds. A programmatic selection (a committed
paste) rects its content bounds plus `GRAB_MARGIN`.

`retintCps()` highlights a connection point only when the rect touches its
grid-unit cell, so selecting a wire does not drag endpoint junctions shared with
unselected wires into the highlight. `suppressTintForRender()` neutralizes every
highlight and returns a restorer, so an offscreen render (minimap, image export,
server preview) never bakes it into committed content.

### `commit` behavior

**Rectangle drag** clears, selects every component the rect touches, then in
`SELECT` mode every wire it touches, and in `SELECT_EXACT` (scissor) runs
`cutWire` per candidate — `skip` (centerline outside), `keep`, or `cut` into
pieces. Cut originals are removed and pieces added directly, and the pair is
`register`ed as its own history entry; the inside pieces become the selection.

**Single click** builds a 1×1 grid-unit rect around the point (PixiJS
`Rectangle.intersects()` fails on a zero-area rect) and post-filters with
`gridBounds.contains`. When a component and a wire both match, the smaller
bounding-box area wins — the more precisely-aimed target.

### Cut lifecycle

A registered cut is live only while it is still the newest history entry
(`hasLiveCut`, validated lazily against `ActionManager.topDone`). The move or
delete that commits it calls `consumeLiveCut()` and coalesces it with its own
action, so cut + move is one Ctrl+Z. Cancelling the selection retracts it,
leaving no history trace. Any unrelated action would orphan it as an invisible
split, so the manager hooks `ActionManager.onBeforeRecord` and clears the
selection before that action lands. See `wires.md` § _Cut lifecycle_.
