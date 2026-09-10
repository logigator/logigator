# Wire System

A wire is an axis-aligned segment on the grid lattice: one direction
(horizontal or vertical), an integer length, no connectivity state. There is no
graph and no net list at this layer — connectivity is derived from geometry
(`simulation/compiler/net-extractor.ts`), which is why the split/merge
invariants below have to hold.

```
src/app/wires/            wire.ts, wire-cut.ts, wire-snapshot.model.ts,
                          serialized-wire.model.ts
src/app/project/          wire-topology.ts, wire-integrator.ts,
                          wire-line-index.ts, wire-repair.ts (+ .service)
src/app/rendering/graphics/wire.graphics.ts
src/app/actions/actions/  add-wires.action.ts, remove-wires.action.ts
```

## Core concepts

`Wire` extends PixiJS `Graphics` and shares one `GraphicsContext`
(`WireGraphics`, cached by `GraphicsProviderService`) drawing a white 1×1 unit
rect. Size is `scale.x`, direction is `rotation` (`HORIZONTAL` → 0,
`VERTICAL` → π/2), color is the per-instance tint — white × tint is the tint
exactly, so the context is theme-independent and a theme change retints
instances instead of swapping contexts. `refreshTint()` re-derives it from the
theme and `selected`, and also restores it after a transient tint (collision
red).

Wires live in `Project._gridSpace` (`scale = gridSize`), so `position` **is**
the grid coordinate. **Wire endpoints lie on the half-grid lattice** (`n + 0.5`),
aligning the centre line with component port midpoints. The offset is a
convention added in `deserialize`, not stored: `serialize` floors to integer
grid coordinates.

`gridBounds` floors the origin and extends the spanning axis by `length + 1`, so
the AABB covers the half-grid padding at both ends. `intersectsGridBounds` is
its allocation-free mirror — the two must agree.

### Constant-Width Stroke

`applyScale(scale)` sets `scale.y = 1 / (scale * gridSize)`, absorbing both the
project zoom and `_gridSpace`'s scaling so the wire stays one device pixel tall.
`Component` gets the second factor from its `_visualSpace` counter-scaling;
`Wire` is a bare `Graphics` with no wrapper and compensates explicitly. The quad
tree calls it on zoom changes and when a cull pass brings a wire back into view.

Powered wires are `POWERED_WIRE_THICKNESS` (3) pixels thick, and that state is
**pure transform** on the same context: `_applyThickness` multiplies the
zoom-derived base scale and sets `pivot.y = POWERED_WIRE_PIVOT` so the
thickening stays centred on the unpowered pixel. Never swap in a thicker
context — reassigning a `Graphics` context detaches and re-attaches listeners on
the shared one (a linear scan over every attached wire and stub, quadratic
across a blinking board) and forces a full instruction rebuild, while transform
changes are patched into the existing batch. The same rule governs port stubs,
negation bubbles (alpha) and LEDs (tint).

## `Wire` class

Ids come from a static `IdAllocator`; the `id` setter `bump`s the allocator so
loading persisted data with higher ids cannot collide with fresh ones.

| Member                 | Meaning                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `position`             | Start point in grid units, half-grid — the canonical coordinate |
| `direction` / `length` | Backed by `rotation` / `scale.x`                                |
| `connectionPoints`     | `[start, end]`, the points that connect to ports                |
| `contains(p)`          | `p` on the closed segment (endpoints included)                  |
| `gridBounds`           | AABB for the quad tree                                          |

Statics: `serialize`/`deserialize` (persistence and undo replay), `snapshot`,
and the geometry constructors `split(w, at)` / `merge(a, b)` the integrator
builds on.

`SerializedWire` (`{ id, pos, direction, length }`, integer `pos`) is the
persistence form. `WireSnapshot` (`start`/`end`/`direction`/`gridBounds`) is the
runtime form, for geometry that must outlive the instance — `removeWire`,
`moveWire`, `SelectionMoveSession.onEnd`. `snapshotsShareSpan` (collinear with
positive-length overlap, so a mere endpoint touch does not count) identifies an
integration result as an input wire's successor: a merge result contains the
input span, a split piece lies within it. `SnapshotSpanIndex` buckets snapshots
by grid line, so a commit re-deriving a selection over a whole pasted set does
not compare every candidate against all of it.

## Project integration

`Project` owns a `QuadTreeContainer<Wire>` (`_wires`) inside `_gridSpace`.
`addWire` inserts and re-tunes the wire to the live zoom; `removeWire` snapshots
the geometry before removing and forwards it to
`ConnectionPointManager.onWireRemoved` (see
[`connection-points.md`](connection-points.md)).

## Drawing wires (`WireToolSession`)

The drag locks its axis on the first non-zero grid step (X first → horizontal)
and keeps two preview wires in the drag layer as an L from origin to cursor. On
release, non-zero-length wires go through `project.topology.integrate`, the
surviving instances are added to the project directly, and
`ActionContainer(RemoveWires?, AddWires)` is registered against that
materialized state. A press that never moved is a tap, handled by the tool's
negate / connection-toggle callback instead.

`Project.hasWireBodyCollision(bounds)` tests the preview against component
bodies, stub padding excluded, so an endpoint meeting a port stub tip is not a
collision. Colliding segments are tinted invalid and `canEnd()` returns false.
Components with `ignoresWireCollision` (only `TextComponent`) are skipped, so
wires may cross a text annotation.

## Wire Integration Invariants

After every gesture commit the project satisfies three invariants:

- **I1** — no wire's interior contains another wire's endpoint.
- **I2** — no wire's interior contains a component port tip.
- **I3** — no two collinear wires share an endpoint unless a third
  _terminating_ thing (a perpendicular wire endpoint or a port tip) terminates
  there too.

I1 and I2 are **split-forcing**: an endpoint or port landing inside an interior
splits that wire. I3 is **merge-forcing**: with no third terminator, two
collinear wires fuse into one.

**Scissor cut exception.** A live (uncommitted) scissor cut violates I3 on
purpose. The integrator never runs against that state — the next gesture
coalesces the cut into its own action, or the selection clear retracts it. The
CP rule needs ≥3 terminations, so the violation draws no dot and stays
invisible.

### `project.topology.integrate(input)`

A pure query returning `{ toAdd: Wire[], toRemove: Wire[] }` — `toAdd` are fresh
instances the caller must insert (splits, merges, surviving `addedWires`),
`toRemove` are live tree wires it must drop. Callers wrap the result in
`ActionContainer(RemoveWiresAction, AddWiresAction)` beside their primary action
so the whole gesture undoes atomically; the integrator never runs inside
`Action.do/undo`, which replays from captured snapshots.

`IntegrationInput` describes the change: `addedWires` / `removedWires`,
`movedWires` (with the pre-move `oldSnapshot`, since queries already return the
new position), the three `*ComponentPorts` counterparts, and `vacatedPoints`.
The last seeds candidates for elements the caller already removed — the eraser
deletes live during its sweep, so the erased instances are gone by integration
time. The merge pass then heals a pair whose third terminator vanished, while
the split pass's termination guard keeps a vacated point with no current
terminator from splitting anything.

Integration runs **once per gesture**, at the session or command boundary: the
drag sessions' `onEnd`, `ClipboardService._applyDelete`, each automation
`applyEdit` op, and the `Component.portsChange$` subscription. Low-level
mutators (`addWire`, `removeWire`, `moveWire`, component analogues) never invoke
it. The `portsChange$` path applies its result without action wrapping, so
rotation-implied splits are not undoable (see
[`connection-points.md`](connection-points.md) § Future work).

### Algorithm

1. Seed candidate points from the input (endpoints, port positions, vacated
   points).
2. **Consolidate pass**, once per added or moved wire: absorb collinear
   overlapping wires into one span, so a wire drawn on top of an existing one
   does not leave the split pass producing duplicate pieces.
3. **Fixed-point loop** over the candidate set: **merge pass first**, then
   **split pass**. Merge takes each point where exactly two collinear wires end
   with no third terminator; split cuts any wire whose interior contains a point
   that something else actually terminates at.
4. Diff the working set against the tree wires for `{ toAdd, toRemove }`.

Merge-before-split resolves a real ambiguity: where a collinear pair's shared
endpoint sits on a third wire's interior, each pass is self-justifying — the
pair's endpoints are the only terminations justifying the split, and the split
pieces would be the only terminators blocking the merge. Merging first settles
it as a plain crossing, so moving both halves of a previously split wire across
another wire behaves like moving one unsplit wire.

The loop is capped at 8 iterations (it converges in 1–2) and throws at the cap
rather than silently producing wrong geometry.

### Junction preservation

A junction has no state of its own — it exists only as the split state of the
wires meeting at it, and the consolidate pass destroys that evidence: absorbing
one arm into a span puts the junction point in the span's _interior_, the
perpendicular pair loses its third terminator, I3 fires, and the junction
silently becomes a crossing.

So consolidation records every absorbed endpoint that lands inside the merged
span with a perpendicular wire endpoint on it. The merge pass skips those
points and the split pass re-cuts the span there. A collinear neighbour ending
at the point is no marker — it overlaps the span and gets absorbed too. Ports
need none either: `hasPort` reports them independently of the wires. The rule is
deliberately narrow — a point is protected only when consolidation removed a
termination that was there.

### Join / split toggling

`topology.toggleConnectionAt(p)` is the wire tool's tap on a half-grid point:
where a connection point exists it **joins** (merges each collinear pair ending
at `p`, then integrates), otherwise it **splits** a pure 2-wire crossing into
four wires so a dot appears. Both push a normal `ActionContainer`.
`connectionToggleKindAt(p)` answers what the tap would do for the hover ghost;
the join case dry-runs the full plan and discards it, so a T-junction — where
integration would immediately re-split at `p` — correctly reports `null` instead
of offering a no-op. Plans must be discarded: the actions snapshot their wires
on construction, and the temporary instances would otherwise leak.

### Board-wide repair

`project/wire-repair.ts` plus `WireRepairService` handle boards that already
carry violations.

- `auditWireInvariants(project)` — pure scan classifying every violation
  (`overlap`, `endpoint-in-interior`, `port-in-interior`, `unmerged-pair`) with
  a loggable detail string.
- `computeWireRepair(project)` — rebuilds the wires in an offline working set,
  re-adding each through the integrator one at a time (valid state plus one wire
  is the integrator's designed input), then multiset-diffs against the live wires
  by exact geometry. Wires whose spans survive keep their live instances, so ids,
  selection and history references stay intact and only the changed remainder is
  in the plan. A repair never changes which cells are wired, only how they group
  into `Wire` instances; zero-length wires are dropped.

Both run off a `WireRowColumnIndex` (`project/wire-line-index.ts`, shared with
`WireIntegrator`) and issue no rect queries. A wire spans exactly one grid row
or column, so the index buckets it on that one line: collinear pairs are a
sorted sweep per line, and a buried endpoint or port is a binary search into the
row and column through that point. Cost is bounded by what shares a line with
the wire rather than by wire length, which keeps a full-width bus from dragging
in everything it crosses. The quad tree files by size class instead, parking
long wires where every descending query rescans them — fine for point-sized
interactive queries, ruinous for a whole-board pass. Lines sort lazily, so the
mutation-heavy `computeWireRepair` never pays for ordering. Indexed wires must
not move.

Both entry points are user-initiated; a load never repairs by itself.
`repairManually` (Edit → "Repair Wires") clears the selection first, retracting a
live scissor cut whose seam is a deliberate transient I3 violation the repair
must not fuse. It registers the fix as one undoable entry, always toasts
(including "no wire issues found") and re-audits, logging an error if anything
survived. A live simulation session is exited first, once the plan is known to
change something: the compiled board's link → render mapping addresses the very
`Wire` instances the plan destroys, so a session left up writes powered state
onto freed objects on its way out. `SimulationService` is resolved through the
`Injector` there, since injecting it would close a cycle back through the
shortcut and save chain. `offerRepairOnLoad` audits a freshly loaded document and raises a
warning toast whose action runs `repairManually`, touching nothing until the
user accepts. That toast never auto-dismisses, so the handler re-checks
`project.destroyed` — the offer can outlive its document. Read-only shares are
skipped: a share can neither be saved nor exported, so an accepted repair would
have nowhere to go.

Analytics measure field corruption instead of inferring it from bug reports.
`wire_repair_offered` carries the violation count and distinct kinds, never a
detail string (those name elements); `wire_repair_run` carries `trigger`
(`menu` / `load-offer`, the latter doubling as the offer's acceptance),
`outcome` and, on a repaired run, `leftSimulation`. Two outcomes are bug signals rather than usage: `no-diff` means the
rebuild reproduced what the audit flagged, and a `repaired` run with non-zero
`survivingViolations` means the audit still fails on the repair's own output.

## Wire Scissor Cutting

A `SELECT_EXACT` rubber band splits every wire extending past the rectangle at
its boundary; the inside piece joins the selection, the outside pieces stay in
place unselected. Semantics live in [`work-mode.md`](work-mode.md) § _SELECT vs
SELECT_EXACT_, orchestration in [`project.md`](project.md) § _`commit`
behavior_; the geometry is the pure `wires/wire-cut.ts`.

`cutWire(wire, rect)` returns one of three variants:

| Variant                                | Meaning                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `{ kind: 'skip' }`                     | Centreline outside the rect — the half-cell padding of `gridBounds` produced the AABB hit. Do not select. |
| `{ kind: 'keep' }`                     | Wire stays whole (contained, or the clamping collapsed to the original). Select as-is.                    |
| `{ kind: 'cut', pieces, insideIndex }` | 2–3 pieces in axis order; `pieces[insideIndex]` overlaps the rect.                                        |

For a horizontal wire (vertical mirrors onto Y):

```
leftCut  = max(wStart, floor(rect.x - 0.5) + 0.5)
rightCut = min(wEnd,   ceil(rect.right - 0.5) + 0.5)
```

Cuts land on the first half-grid position at or outside the rect on each side:
endpoints live on that lattice, and the marquee is never snapped, so its edges
are arbitrary floats. A rect drawn strictly inside one grid unit cuts exactly
that unit. Where the outside pieces land does not matter — `SelectionManager`
holds the new instances and picks the inside one by id.

**No integration on scissor.** `Project.addWire` does not run the integrator, so
the pieces keep their shared endpoints — detaching inside from outside is the
whole point. Only 2 collinear terminations meet at the cut, so no CP dot appears.

### Cut lifecycle

A cut is a real history entry from the start, but stays _live_ (committable or
retractable) only while it is the newest one. `SelectionManager` mutates the
project directly through `addWire`/`removeWire`, so the inside piece is a real,
selectable `Wire`, then registers `ActionContainer(RemoveWiresAction,
AddWiresAction)` via `ActionManager.register` and keeps it in `_cutAction`.

- **Move or delete** — `SelectionMoveSession.onEnd` (with movement) and
  `ClipboardService._applyDelete` call `consumeLiveCut()` and
  `ActionManager.coalesceTop`, so cut + move is one Ctrl+Z. The cut's
  `AddWiresAction` captured the pieces at their **post-cut** positions, so the
  move action in the same container transitions them post-cut → post-move on
  redo.
- **Cancel** (`clear()`, mode change, click on empty space) —
  `ActionManager.retract`: the pieces go, the originals come back, history shows
  no trace.
- **Ctrl+Z while live** — a plain undo of the newest entry; the cut stays
  redoable.
- **An unrelated action while live** — the selection clears (retracting the cut)
  before the new entry is recorded, so an uncommitted split is never orphaned
  behind newer history. `SelectionManager` installs this through
  `ActionManager.onBeforeRecord`.
- **No-move drag** — the session returns without consuming; the next clear
  retracts.

So I3 is never observably violated: the split state survives only once a move
has actually separated the pieces.
