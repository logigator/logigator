# Connection Points

Connection points (**CPs**) are the dots drawn at half-grid positions where
three or more wire endpoints or component port tips meet. They are derived
visual sugar: never persisted, never hit-tested, absent from every model graph.
They appear and disappear as a consequence of wire/component mutations on
`Project`.

## Detection rule

**A CP exists at `P` iff at least 3 terminations occur at `P`** — a wire
endpoint (`wire.connectionPoints`) or a component port tip
(`component.connectionPoints`) exactly equal to `P`. Wire interiors never count,
and never have to: under the split-on-touch invariants `WireIntegrator` enforces
(see [wires.md](./wires.md)), no interior can contain another wire's endpoint or
a port tip — those states are normalized into split wires first.

| Scenario                                         | Terminations | CP  |
| ------------------------------------------------ | ------------ | --- |
| Single endpoint, or an L-corner of two wires     | 1–2          | no  |
| Pure 2-wire crossing (no endpoint, no port at P) | 0            | no  |
| Port alone, or port + one wire endpoint          | 1–2          | no  |
| T or X junction (wire body already split at P)   | 3–4          | yes |
| Port + two wire endpoints                        | 3            | yes |

A wire crossing another wire's body looks like two wires but counts as three:
the body is already split into two wires that both end at the touch point.

### Termination counts

`ConnectionPointManager` keeps a `PointMap<number>` of how many terminations sit
at each point, so evaluation is a map lookup (`count >= 3`) rather than a
quad-tree range query. The map must stay in lock-step with the project's
quad-tree membership: every add, remove, move and drag detach/reattach path
adjusts it at the affected points, and multiplicity matters (two endpoints at
one point count as two, so the counting pass never de-duplicates).

Coordinates are lattice-exact half-integers (`n + 0.5`), which is what makes
this work: `PointMap`/`PointSet` key on `"x,y"` with no rounding and no epsilon
(`utils/point-key.ts`), so a point produced by trig or by live bounds instead of
nominal geometry would silently fail to match its own dot.

## The dot

`ConnectionPoint` extends `Graphics` and shares one `ConnectionPointGraphics`
context — a white unit square, `themeIndependent`, cached by
`GraphicsProviderService`. The dot's colour is therefore its tint
(`refreshTint()`: `theme.wire`, or `theme.wireSelectColor` while `selected`),
and a theme change retints in place. It sits at its half-grid `position`,
pivoted at `(0.5, 0.5)` so the square is centred, and `applyScale` sizes it:
`scaleForScale` is `DIAMETER` (6 px at 100 % zoom) clamped to a 3–8 px on-screen
floor and ceiling, so the dot scales with the board only between those bounds.

`ConnectionPointLayer` forwards `applyScale` to its children and is **its own
render group**: dots live board-wide in this one container, so an insertion or
removal dirties only this group's instruction set instead of making the root
group re-collect and re-batch the whole scene. It sits above wires and
components (dots draw over wire fills) and below the floating layer (drag
previews draw over stable dots).

## `ConnectionPointManager`

Owns the layer, the `PointMap<ConnectionPoint>` lookup, the termination counts
and every mutation hook. Its only constructor argument is a `getScale` lambda
(a fresh dot must render at the current zoom); holding no `Project` reference
keeps it free of a circular dependency and unit-testable on its own.

| Method                                           | Purpose                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `onWireAdded` / `onWireRemoved(snapshot)`        | Adjust counts and recompute the wire's two endpoints                |
| `onComponentAdded` / `onComponentRemoved(ports)` | Same for a component's port tips                                    |
| `addTerminations` / `removeTerminations`         | Adjust counts **without** recomputing dots — the drag lifecycle     |
| `recomputeAt(p)`                                 | Create or destroy the dot at one point; idempotent                  |
| `recomputeAll(wires, components)`                | Clear and rebuild counts and dots in one linear pass                |
| `refreshTheme()`                                 | Retint every dot; existence depends on the circuit, never the theme |
| `getCpAt` / `hasCpAt` / `getCpsAtPoints`         | Lookup by exact position                                            |
| `detachCp` / `reattachCp`                        | Remove from / insert into layer + map without destroying            |
| `captureDragCps(comps, wires, dragLayer, only?)` | Detach dots at the dragged elements' terminations into `dragLayer`  |
| `discardDragCps` / `restoreDragCps`              | Destroy them on commit / put them back on cancel                    |
| `recomputeCpsForMovedSelection(…)`               | One recompute over old and new affected points after a drag commit  |

Only a wire's own endpoints can change CP state for a wire mutation, so
`affectedPointsForWire` / `affectedPointsForSnapshot` simply return
`[start, end]`.

## `Project` integration

`addWire` / `addComponent` fire the add hook after inserting into the quad tree;
`removeWire` / `removeComponent` snapshot the geometry **before** removing, then
fire the remove hook — the snapshot is the only record of where the element was.
`moveWire` / `moveComponent` fire both. `detachForDrag` / `reattachFromDrag`
adjust counts only; the drag-follow helpers own the visuals.

Bulk loaders pass `deferConnectionPoints: true` to `addComponent`/`addWire` and
follow the batch with one `Project.recomputeConnectionPoints()`, deriving every
dot in a single de-duplicated pass. Whatever they insert must already satisfy
the wire invariants, or be run through `project.topology.integrate` first.

### Port changes

`Component.portsChange$` fires whenever `direction`, `numInputs` or `numOutputs`
changes. `Project.addComponent` subscribes and, for a component still indexed in
the tree, re-buckets it (its `gridBounds` changed), integrates the implied
splits and merges, and recomputes the old and new port points. A component
detached into a drag session or mid-`rotateComponent` is skipped: its owner
integrates undoably itself, and a second pass here would double-apply.

### Selection and drag-move

Dots are not hit-tested, but `SelectionManager` tints the ones at a selected
element's terminations (`getCpsAtPoints`, `cp.selected = true`). A
`SelectionMoveSession` passes exactly that set as `captureDragCps`'s `only`
argument, so what moves matches what looks selected: a junction linking the
selection to unselected wires stays put and is rebuilt afterwards. Nothing
recomputes mid-drag. On commit the captured dots are discarded and
`recomputeCpsForMovedSelection` runs over old plus new points; on cancel or a
zero-distance commit they are restored.

Undo and redo need no action-layer awareness: `do`/`undo` go through the same
`Project` methods, which fire the same hooks. The integrator is not re-run —
the captured snapshots are the source of truth.

## Tap-to-toggle

A wire-tool tap (a press that never moved a grid step, with no port in negation
reach) snaps to the nearest half-grid point and calls
`WireTopology.toggleConnectionAt(p)`, which dispatches on `hasCpAt(p)`:

- **No dot** — `_splitAt` needs a horizontal and a vertical wire crossing `p`.
  It cuts both and integrates; four terminations now meet at `p`, so the dot
  appears.
- **Dot present** — `_joinAt` merges the collinear pairs ending at `p`. If the
  integrator re-splits at `p` (a third wire's endpoint on the merged interior,
  as at a T-junction) the plan is discarded and the tap is a silent no-op;
  otherwise the dot disappears.

Both paths push an `ActionContainer(RemoveWiresAction, AddWiresAction)` through
`ActionManager`, so undo/redo work normally.
`connectionToggleKindAt(p)` answers `'join' | 'split' | null` without mutating —
the join case dry-runs the whole plan, blocked check included, then discards it
— which is what drives the wire tool's hover ghost.

## Future work

The `portsChange$` integration above applies its wire splits and merges outside
`ActionManager`, so an option-driven port-count change is undoable in its option
value but not in the wires it rearranged. Wrapping the property write and the
integration result in one `ActionContainer` would close that gap.
