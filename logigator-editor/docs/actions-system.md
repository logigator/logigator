# Actions System

Undo/redo for every circuit-mutating operation, as the Command pattern: each
operation is an `Action` subclass recorded by the `ActionManager` that `Project`
owns as its `actionManager` field.

## Actions

`Action` declares `do(project)` / `undo(project)` plus `serialize()`. Actions
hold no live PixiJS references — only the data needed to replay themselves —
so history stays valid across destroy/recreate cycles.

- **Add / Remove actions** serialize their subject in the constructor
  (`Component.serialize` / `Wire.serialize`). `do` deserializes fresh instances
  from that snapshot (components through `ComponentProviderService`, which lets
  `do` skip a type the registry can no longer resolve); `undo` removes by id.
- **Move actions** store `MoveEntry[]` (`{ id, oldPos, newPos }`, positions
  cloned) and resolve the element by id at apply time, so they still work after
  an undone delete recreated it under the same id.
- **Rotate actions** extend that entry with a direction pair, because neither
  move nor change-option round-trips a rotation on its own: a component's
  direction setter re-anchors its position, and a quarter-turned wire changes
  its axis. `project.rotateComponent` temporarily unindexes the component around
  the direction write so the `portsChange$` handler's automatic (non-undoable)
  wire integration stays out — the containing `ActionContainer` replays the wire
  changes explicitly.

`serialize()` feeds the debug Project Dump only; `deserializeAction`
(`action-codec.ts`) is the read side and throws on an unknown type rather than
leaking `undefined` into the restored stack. It is not a circuit persistence
format.

`ActionContainer` groups children into one undo step: `do` runs them forward,
`undo` in reverse, because sub-operations have ordering dependencies (wires come
out before the components they connect). `ReorderPlugsAction` and
`UpdateInstanceAction` are containers with fixed children.

## `ActionManager`

A flat array plus a pointer; `push` and `register` both splice at the pointer,
truncating any redo history beyond it. `undo`/`redo` step the pointer and run
the entry, then call `selectionManager.retintCps()`: the mutations replace
connection-point instances (a move cycles the terminations at its junctions), so
the selection has to re-derive which dots it holds.

`clear()` empties the history on project load or discard. `history` / `pointer`
/ `restore(history, pointer)` exist for the debug dump — `restore` swaps the
stack in **without** re-applying anything, the circuit body having been loaded
first.

### `push` vs `register`

- **`push(action)`** — records AND runs `action.do(project)`. For
  instantaneous, non-gesture operations (wire-tap toggles, option/ports/settings
  panels) that build a fresh action against the current state.
- **`register(action)`** — records WITHOUT running `do()`. **Drag sessions
  always use this**: they materialize their final state in the live project
  during the gesture (their ghosts become the committed elements), so re-running
  `do()` would double-apply and re-deserialize instances whose ids are already
  in the quad tree. Wire repair and the automation API's edit batches record the
  same way.

### `locked`

While `locked` is set, undo/redo are inert; recording stays allowed. The
`WorkModeRouter` locks around every live drag session: sessions detach elements
into the drag layer, and a history operation touching them would corrupt the
quad tree (duplicate ids, dangling instances). A session registers its action
before the router unlocks. Clipboard and automation entry points refuse to run
while it is set.

### `onBeforeRecord(hook)`

Hooks run synchronously before `push`/`register` records (never on `retract`,
`coalesceTop`, `undo` or `redo`), and may themselves mutate the history — e.g.
retract a provisional entry — before the new action lands; history operations a
hook performs never re-enter the hook pass. Returns an unsubscribe function.
`ActionManager` carries no knowledge of what any hook does.

### `topDone` / `retract` / `coalesceTop`

The surface for **provisional entries** — entries whose owner may still take
them back or fold them into a follow-up:

- `topDone` — the newest done entry (what the next undo would revert).
- `retract(action)` — if `action` is `topDone`, runs its `undo()` and drops it,
  returning `true`; otherwise touches nothing.
- `coalesceTop(expectedTop, next)` — replaces the newest done entry with
  `ActionContainer(expectedTop, next)` **without executing anything** (`next`'s
  state must already be materialized). Falls back to `register(next)` when
  `expectedTop` is no longer on top.

### The scissor cut lives in history

A `SELECT_EXACT` marquee that scissors wires registers the cut
(`ActionContainer(RemoveWires, AddWires)`) immediately; `SelectionManager` keeps
the reference and considers it **live** while it is still `topDone`. Three
exits:

- **Commit** — a selection move or delete consumes the cut and `coalesceTop`s it
  with its own container, so cut + move / cut + delete revert with one Ctrl+Z.
- **Cancel** — clearing the selection `retract`s the entry: the originals come
  back and history shows no trace.
- **Dissolve** — any unrelated `push`/`register` while a cut is live first
  clears the selection (retracting the cut), so an uncommitted split is never
  orphaned behind newer entries. This is `SelectionManager` policy, installed
  through `onBeforeRecord`.

A plain Ctrl+Z while the cut is live undoes it as the newest entry, and it stays
redoable.

## Adding a New Action

1. Create `actions/actions/<verb>-<noun>.action.ts` extending `Action`.
2. Serialize any live objects in the constructor.
3. Implement `do`/`undo` against `project` and your stored state, and
   `serialize()` with a new `SerializedAction` variant plus its
   `deserializeAction` case.
4. Commit per the convention: `push` for an instantaneous operation,
   materialize-then-`register` inside a drag session.

Wrap independent sub-changes in an `ActionContainer` so they undo atomically.
