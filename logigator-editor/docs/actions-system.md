# Actions System

The actions system implements the **Command pattern** to provide undo/redo for all circuit-mutating operations. Every change a user makes (placing components, drawing wires, deleting elements) is wrapped in an `Action` subclass and recorded by the `ActionManager`.

## Directory Layout

```
src/app/actions/
├── action.ts                   # Abstract base class
├── action-manager.ts           # History stack, undo/redo controller
├── action-container.ts         # Composite action (groups multiple actions)
└── actions/
    ├── add-components.action.ts
    ├── remove-components.action.ts
    ├── add-wires.action.ts
    ├── remove-wires.action.ts
    ├── move-components.action.ts
    ├── move-wires.action.ts
    └── move-entry.model.ts     # Shared { id, oldPos, newPos } interface
```

---

## Core Concepts

### Action (abstract base)

**File:** `action.ts`

Every user operation is modelled as a pair of inverse operations:

```ts
abstract class Action {
  abstract do(project: Project): void;
  abstract undo(project: Project): void;
}
```

`do` applies the change; `undo` reverts it. Both receive the `Project` they operate on — actions are stateless with respect to the project and carry only the data needed to replay themselves.

### Serialization at construction time

`AddComponentsAction` / `RemoveComponentsAction` / `AddWiresAction` / `RemoveWiresAction` **serialize their subject immediately in the constructor** (`Component.serialize(c)` / `Wire.serialize(w)`). The action stores `SerializedComponent[]` or `SerializedWire[]`, not live PixiJS object references. This means:

- The action is fully self-contained after construction.
- Live objects can be destroyed or re-created freely without invalidating recorded history.
- `do` always deserializes fresh instances from the stored snapshot; `undo` calls `project.removeComponent/removeWire` by ID.

`MoveComponentsAction` / `MoveWiresAction` use a different strategy: they store `MoveEntry[]` — `{ id: number, oldPos: Point, newPos: Point }` — rather than full serialized snapshots. Positions are cloned at construction so they are safe from mutation. IDs are used instead of live references so that undo/redo works correctly even if an element was deleted and re-created (e.g., undo of a delete creates a new instance with the same ID). `project.moveComponent(id, pos)` / `project.moveWire(id, pos)` perform a live lookup at call time.

---

## `ActionManager`

**File:** `action-manager.ts`

Owned by `Project` as a public `actionManager` field. Manages a flat linear history using an internal array and a pointer.

```
history:  [ A, B, C, D ]
                  ^
               pointer = 3
```

### `push(action: Action)`

Calls `action.do(project)` immediately, then splices the history array at the current pointer position — this **truncates any redo history** that existed beyond the pointer before recording the new action.

```ts
this._history.splice(this._pointer, Infinity, action);
this._pointer = this._history.length;
action.do(this.project);
```

### `undo()` / `redo()`

- `undo()` decrements the pointer and calls `action.undo(project)` on the action that was just active.
- `redo()` calls `action.do(project)` on the action at the current pointer, then increments.
- Both are no-ops if `undoAvailable` / `redoAvailable` is false — and while `locked` is set (see below).

### `locked`

Set by the `WorkModeRouter` around every live drag session. Sessions detach elements into the drag layer, and a history operation touching them would corrupt the quad tree (duplicate ids, dangling instances), so undo/redo are inert while a session is live. Commits are unaffected — a session registers its action before the router unlocks.

### `topDone` / `retract(action)` / `coalesceTop(expectedTop, next)`

The history surface behind the scissor cut (see § _The scissor cut lives in history_):

- `topDone` — the newest done entry (what the next undo would revert).
- `retract(action)` — if `action === topDone`: runs its `undo()`, removes it from history, returns `true`. Otherwise touches nothing. How a cancelled scissor selection takes its cut back out of history.
- `coalesceTop(expectedTop, next)` — replaces the newest done entry with `ActionContainer(expectedTop, next)` **without executing anything** (`next`'s state must already be materialized). How cut + move / cut + delete collapse into one undo step. Falls back to a plain `register(next)` when `expectedTop` is no longer on top.

### `clear()`

Resets history to an empty state. Called when loading a new project or discarding changes.

---

## `ActionContainer`

**File:** `action-container.ts`

A composite `Action` that holds an ordered list of child actions and delegates to them:

- `do` iterates children **forward**.
- `undo` iterates children **in reverse** — this is required when child operations have ordering dependencies (e.g., removing wires before removing components they connect).
- `add(action)` appends a child after construction.
- `length` returns the child count; callers use this to skip pushing an empty container.

### Typical usage

**`push`** — action applies the state (used when the state hasn't been applied yet):

```ts
const action = new ActionContainer();

if (components.length > 0) {
  action.add(new AddComponentsAction(...components));
}
if (wires.length > 0) {
  action.add(new AddWiresAction(...wires));
}

if (action.length > 0) {
  project.actionManager.push(action); // calls action.do(project) internally
}
```

**`register`** — state already applied; action is recorded for undo only:

```ts
const action = new ActionContainer();
if (components.length > 0)
  action.add(new RemoveComponentsAction(...components));
if (wires.length > 0) action.add(new RemoveWiresAction(...wires));

for (const c of components) project.removeComponent(c.id); // state already mutated
for (const w of wires) project.removeWire(w.id);

project.actionManager.register(action); // does NOT call action.do()
```

---

## Concrete Actions

All four built-in actions follow the same structure: serialize inputs at construction, `do` adds or removes, `undo` is the inverse.

### `AddComponentsAction` / `RemoveComponentsAction`

These two classes are exact inverses. `AddComponentsAction` deserializes via `ComponentProviderService` (accessed through the static DI escape hatch `getStaticDI()`) to reconstruct the correct subclass. `RemoveComponentsAction` removes by ID.

|                          | `do`                                   | `undo`                                 |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| `AddComponentsAction`    | `project.addComponent(deserialize(…))` | `project.removeComponent(id)`          |
| `RemoveComponentsAction` | `project.removeComponent(id)`          | `project.addComponent(deserialize(…))` |

### `AddWiresAction` / `RemoveWiresAction`

Same pattern for wires. Wire deserialization does not require a registry; `Wire.deserialize(s)` is sufficient.

|                     | `do`                                   | `undo`                                 |
| ------------------- | -------------------------------------- | -------------------------------------- |
| `AddWiresAction`    | `project.addWire(Wire.deserialize(…))` | `project.removeWire(id)`               |
| `RemoveWiresAction` | `project.removeWire(id)`               | `project.addWire(Wire.deserialize(…))` |

### `MoveComponentsAction` / `MoveWiresAction`

Move actions record `MoveEntry[]` — the shared interface in `move-entry.model.ts`:

```ts
interface MoveEntry {
  id: number;
  oldPos: Point;
  newPos: Point;
}
```

`do` applies `newPos`; `undo` applies `oldPos`. Both call `project.moveComponent` / `project.moveWire` which look up the element by ID, update its position, and rebucket it in the quad tree.

These actions are recorded by `SelectionMoveSession.onEnd()` after a successful selection drag-move, wrapped in an `ActionContainer` alongside any companion wire entries. Selection tint is not cleared on commit — elements remain selected after moving.

|                        | `do`                                               | `undo`                                             |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `MoveComponentsAction` | `project.moveComponent(id, newPos)` for each entry | `project.moveComponent(id, oldPos)` for each entry |
| `MoveWiresAction`      | `project.moveWire(id, newPos)` for each entry      | `project.moveWire(id, oldPos)` for each entry      |

---

## Integration with the rest of the app

`Project` creates and exposes `actionManager` as a public field. Call sites:

| Call site                         | Committed via | Action(s) recorded                                                                                          |
| --------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `ComponentPlacementSession.onEnd()` | `register`  | `ActionContainer(RemoveWires?, AddComponents, AddWires?)` (placement commit, integrated against the net)     |
| `WireToolSession.onEnd()`         | `register`    | `ActionContainer(RemoveWires?, AddWires)` (drawn wires, integrated against the net)                          |
| `SelectionMoveSession.onEnd()`    | `register` / `coalesceTop` | `ActionContainer(MoveComponents?, MoveWires?, RemoveWires?, AddWires?)`; coalesces with a live scissor cut |
| `PastePlacementSession.onEnd()`   | `register`    | `ActionContainer(AddComponentsAction, AddWiresAction)` (paste commit)                                        |
| `EraseSession.onEnd()`            | `register`    | `ActionContainer(RemoveComponentsAction, RemoveWiresAction)`                                                 |
| `ClipboardService._applyDelete()` | `register` / `coalesceTop` | `ActionContainer(RemoveComponentsAction, RemoveWiresAction)`; coalesces with a live scissor cut  |
| `SelectionManager._scissorAndSelectWires()` | `register` | `ActionContainer(RemoveWiresAction, AddWiresAction)` — the scissor cut itself                       |
| `WireTool` tap                    | `push`        | `TogglePortNegationAction`, or the join/split containers built by `WireTopology`                             |
| Option / ports / settings panels  | `push`        | `ChangeOptionAction`, `ReorderPlugsAction`, …                                                                |

Undo/redo keyboard shortcuts are wired through Angular UI components that call `project.actionManager.undo()` / `.redo()` directly.

### `push` vs `register`

`ActionManager` has two commit styles, with one convention:

- **`push(action)`** — records the action AND calls `action.do(project)`. For **instantaneous, non-gesture operations** (wire-tap toggles, option panels) that build fresh actions against the current state.
- **`register(action)`** — records the action WITHOUT calling `do()`. **Drag sessions always use this**: they materialize their final state in the live project during the gesture (their ghosts/instances become the committed elements), so re-running `do()` would double-apply — and re-deserialize instances whose ids are already in the quad tree.

### The scissor cut lives in history

A `SELECT_EXACT` marquee that scissors wires registers the cut (`ActionContainer(RemoveWires, AddWires)`) as its own history entry immediately; `SelectionManager` keeps the reference and considers it **live** while it is still `topDone`. Three exits:

- **Commit** — a selection move or delete consumes the cut (`consumeLiveCut`) and coalesces it with its own container (`coalesceTop`), so cut + move / cut + delete revert with one Ctrl+Z.
- **Cancel** — clearing the selection retracts the entry (`retract`): the originals come back and the history shows no trace.
- **Dissolve** — any unrelated `push`/`register` while a cut is live first clears the selection (retracting the cut), so an uncommitted split can never be orphaned behind newer history entries.

A plain Ctrl+Z while the cut is live simply undoes it as the newest entry (and it stays redoable).

---

## Adding a New Action

1. Create `actions/<verb>-<noun>.action.ts` extending `Action`.
2. In the constructor, serialize any live objects you will need to replay.
3. Implement `do` (apply the change) and `undo` (reverse it), both operating only on `project` and your serialized state.
4. Commit at the call site following the convention above: `push` for an instantaneous operation, materialize-then-`register` inside a drag session.

If the operation involves multiple independent sub-changes, wrap them in an `ActionContainer` so they undo atomically.

---

## Type Hierarchy

```
Action (abstract)
├── ActionContainer
├── AddComponentsAction
├── RemoveComponentsAction
├── AddWiresAction
├── RemoveWiresAction
├── MoveComponentsAction
└── MoveWiresAction
```
