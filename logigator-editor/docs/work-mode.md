# Work Mode

The work mode system tracks which editing tool is active and routes canvas
pointer interactions accordingly. `work-mode.enum.ts` holds the identifiers,
`work-mode.service.ts` the signal state, `work-mode-tools.ts` the tool
descriptors the tool bar and mobile HUD share.

## `WorkMode`

| Member                | Value          | Notes                                                  |
| --------------------- | -------------- | ------------------------------------------------------ |
| `PAN`                 | `'pan'`        | Hand tool; the navigate-first default                  |
| `WIRE_TOOL`           | `'wireTool'`   | Drag draws; a tap negates a port or toggles a junction |
| `SELECT`              | `'sel'`        |                                                        |
| `SELECT_EXACT`        | `'selExact'`   | The select tool's scissor sub-state                    |
| `ERASE`               | `'erase'`      |                                                        |
| `COMPONENT_PLACEMENT` | `'placeComp'`  | Also covers text placement (the TEXT component type)   |
| `SIMULATION`          | `'simulation'` | Editing locked                                         |

The values are i18n key suffixes — `statusBar.modes.<value>`, declared
`satisfies Record<WorkMode, string>` in every locale file — so changing one is a
breaking i18n change the build catches.

### SELECT vs SELECT_EXACT

One select tool covers both marquee flavors. `SELECT_EXACT` is entered through
the scissor toggle (`ScissorToggleComponent`, a floating pill shown on both
breakpoints while the select tool is active) or transiently by holding the
`SELECT_SCISSOR` key — bare Alt by default, rebindable; `ShortcutService.isHeld`
reports the live state and `heldChange$` notifies mid-gesture. Both share
`SelectRectSession`, which restyles the marquee (`theme.selectRect` vs
`theme.scissorRect`) the moment the key or drag state flips. They diverge in
`SelectionManager.commit`: **SELECT** takes every component and wire whose
`gridBounds` intersect the rect, **SELECT_EXACT** does the same for components
but scissors a wire crossing the boundary, keeping the inside piece selected and
leaving the outside pieces as separate unselected wires.

That cut registers immediately as its own history entry. A following move or
delete **consumes** it (`SelectionManager.consumeLiveCut`) and coalesces it into
its own action, so cut + move is one undo; cancelling the selection retracts the
entry instead, restoring the original wires and leaving no trace. Any unrelated
action recorded while the cut is live dissolves the selection first, so an
uncommitted split can never be orphaned behind newer history. Geometry and flow:
`wires.md` § _Wire Scissor Cutting_ and § _Cut lifecycle_.

## `WorkModeService`

Root-provided; holds `mode` (initially `PAN`), `selectedComponentType` (non-null
only while `COMPONENT_PLACEMENT` is active) and the derived
`selectedComponentConfig` as signals.

`setMode(mode)` clears `selectedComponentType` for anything but
`COMPONENT_PLACEMENT`. `SIMULATION` is fenced off both ways: requesting it
throws (a simulation session needs a compiled board), and while it is active
`setMode` and `setSelectedComponentType` are silently ignored — so tool
shortcuts and palette clicks during a simulation are no-ops without a guard at
each call site. `setSimulationMode(simulating)` is the lifecycle's only doorway
past that lock (`true` enters, `false` returns to `PAN`; both clear the
placement type), called only by `SimulationService.enter()`/`exit()`.

`placementDirectionFor(type)` / `setPlacementDirection(type, value)` hold the
sticky per-type placement direction (session-lifetime, default East). The
settings panel writes it while a placement is armed and every fresh ghost of
that type picks it up, so consecutive placements keep facing the chosen way.

## Integration Flow

```
ToolBarComponent / ToolHudComponent / ComponentListComponent
  → WorkModeService.setMode() / setSelectedComponentType()
    → BoardComponent effect()  →  WorkModeRouter.setMode / .componentToPlace
      → the mode's BoardTool (rendering/interaction/tools/) on the next press
```

Tool descriptors keep `isActive`/`activate` as functions rather than a plain
mode value because the TEXT tool is `COMPONENT_PLACEMENT` **plus** a selected
type. `WorkModeRouter.setMode` aborts any in-flight session, deactivates the old
tool (tearing down its hover previews), clears the selection and triggers one
render frame; `componentToPlace` forwards to the `PlacementTool`.
`PointerController` streams the primary pointer to the router, which dispatches
to the active mode's `BoardTool`:

| Mode                    | Tool → session                                               |
| ----------------------- | ------------------------------------------------------------ |
| `PAN`, `SIMULATION`     | `PanTool` / `SimulationTool` → `PanSession`                  |
| `COMPONENT_PLACEMENT`   | `PlacementTool` → `ComponentPlacementSession`                |
| `WIRE_TOOL`             | `WireTool` → `WireToolSession`                               |
| `SELECT`/`SELECT_EXACT` | `SelectTool` → `SelectionMoveSession` or `SelectRectSession` |
| `ERASE`                 | `EraseTool` → `EraseSession`                                 |

Press/hover/commit behavior lives in `rendering.md` § _Tools_. Three things are
mode-specific rather than session-specific:

- `SelectTool` is registered **once per flavor**, so a session opened from
  either gets the right base mode while the hold-to-scissor key stays live in
  both.
- `PlacementTool` defers loading a cloud master's circuit to place-time (a
  microtask no-op except for a first, uncached master). The host's **gesture
  stamp**, bumped on pointer-up, cancel and context switches, keeps a load whose
  gesture already ended from opening a session with no pointer to drive it.
- `SimulationTool`'s tap hit-tests the component body under the cursor: a
  button/switch emits on `Project.userInput$`, an inspectable component emits an
  inspect request. Editing stays locked; pan and zoom keep working.

`WorkModeRouter` also drives `project.ticker$` around session lifecycles —
`'on'` at start, `'off'` at end/cancel, `'single'` after a mode change aborts
one. The scheduler behind those signals is `rendering.md` § _`TickerScheduler`_.

## Adding a New Mode

1. Add a value to `WorkMode`.
2. Add `statusBar.modes.<value>` to every locale file in `src/i18n/`.
3. Add a tool descriptor in `work-mode-tools.ts` (both surfaces render from it).
4. Add a `BoardTool` in `rendering/interaction/tools/` — usually opening a new
   `DragSession` — and register it in `WorkModeRouter`'s tool table.
