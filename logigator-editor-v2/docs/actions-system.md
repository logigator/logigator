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
- Both are no-ops if `undoAvailable` / `redoAvailable` is false.

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

```ts
const action = new ActionContainer();

if (components.length > 0) {
  action.add(new AddComponentsAction(...components));
}
if (wires.length > 0) {
  action.add(new AddWiresAction(...wires));
}

if (action.length > 0) {
  project.actionManager.push(action);
}
```

---

## Concrete Actions

All four built-in actions follow the same structure: serialize inputs at construction, `do` adds or removes, `undo` is the inverse.

### `AddComponentsAction` / `RemoveComponentsAction`

These two classes are exact inverses. `AddComponentsAction` deserializes via `ComponentProviderService` (accessed through the static DI escape hatch `getStaticDI()`) to reconstruct the correct subclass. `RemoveComponentsAction` removes by ID.

| | `do` | `undo` |
|---|---|---|
| `AddComponentsAction` | `project.addComponent(deserialize(…))` | `project.removeComponent(id)` |
| `RemoveComponentsAction` | `project.removeComponent(id)` | `project.addComponent(deserialize(…))` |

### `AddWiresAction` / `RemoveWiresAction`

Same pattern for wires. Wire deserialization does not require a registry; `Wire.deserialize(s)` is sufficient.

| | `do` | `undo` |
|---|---|---|
| `AddWiresAction` | `project.addWire(Wire.deserialize(…))` | `project.removeWire(id)` |
| `RemoveWiresAction` | `project.removeWire(id)` | `project.addWire(Wire.deserialize(…))` |

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

These actions are pushed by `FloatingLayer._commitDrag()` after a successful selection drag-move, wrapped in an `ActionContainer` alongside any companion wire or component entries. Selection tint is not cleared on commit — elements remain selected after moving.

| | `do` | `undo` |
|---|---|---|
| `MoveComponentsAction` | `project.moveComponent(id, newPos)` for each entry | `project.moveComponent(id, oldPos)` for each entry |
| `MoveWiresAction` | `project.moveWire(id, newPos)` for each entry | `project.moveWire(id, oldPos)` for each entry |

---

## Integration with the rest of the app

`Project` creates and exposes `actionManager` as a public field. Call sites:

| Call site | Action(s) pushed |
|---|---|
| `FloatingLayer.commitSelection()` | `AddComponentsAction`, `AddWiresAction` (placement commit) |
| `FloatingLayer._commitDrag()` | `MoveComponentsAction`, `MoveWiresAction` (selection drag-move) |

Undo/redo keyboard shortcuts are wired through Angular UI components that call `project.actionManager.undo()` / `.redo()` directly.

---

## Adding a New Action

1. Create `actions/<verb>-<noun>.action.ts` extending `Action`.
2. In the constructor, serialize any live objects you will need to replay.
3. Implement `do` (apply the change) and `undo` (reverse it), both operating only on `project` and your serialized state.
4. Push the action via `project.actionManager.push(action)` at the call site.

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