# Work Mode

The work mode system tracks which editing tool is currently active and routes pointer interactions on the canvas accordingly.

## Directory Layout

```
src/app/work-mode/
├── work-mode.enum.ts          # Enum of all mode identifiers
├── work-mode.service.ts       # Angular signal-based state holder
├── work-mode.service.spec.ts  # Mode switching + simulation-lock tests
└── work-mode-tools.ts         # Shared tool descriptors (tool bar + mobile HUD) + scissor toggle
```

---

## Core Concepts

### WorkMode Enum

**File:** `work-mode.enum.ts`

Seven string-valued enum members identify the available interaction modes:

| Member                | Value          | Notes                                                                |
| --------------------- | -------------- | -------------------------------------------------------------------- |
| `PAN`                 | `'pan'`        | Hand tool; the navigate-first default                                |
| `WIRE_TOOL`           | `'wireTool'`   | The wire tool: drag draws, a tap negates a port / toggles a junction |
| `SELECT`              | `'sel'`        |                                                                      |
| `SELECT_EXACT`        | `'selExact'`   | The select tool's scissor sub-state — see note below                 |
| `ERASE`               | `'erase'`      |                                                                      |
| `COMPONENT_PLACEMENT` | `'placeComp'`  | Also covers text placement (TEXT component type)                     |
| `SIMULATION`          | `'simulation'` | Editing locked — see `WorkModeService` below                         |

The string values are used as i18n key suffixes — `statusBar.modes.<value>` — so changing them is a breaking i18n change.

> **The wire tool (WIRE_TOOL)**: a drag draws wires as before. A press that never leaves its starting grid step is a **tap**, which `WireToolSession` reports back to its tool (`WireTool`, via `onTap`): a port within 0.5 grid units toggles its negation bubble (undoably, via `TogglePortNegationAction`) — this is what the hover ghost previews — otherwise the nearest half-grid point toggles the wire connection there (`project.topology.toggleConnectionAt`: join/split, a graceful no-op when neither applies). If a port and a junction are both in reach, the port wins, matching the ghost. There are no separate wire-connection or port-negation modes.

> **SELECT vs SELECT_EXACT**: One select tool covers both; `SELECT_EXACT` is its scissor sub-state, entered through the scissor toggle (`ScissorToggleComponent`, a floating pill over the canvas that appears while the select tool is active — both breakpoints), or transiently by holding the `SELECT_SCISSOR` key (a bare Alt by default, rebindable in the shortcut manager — `ShortcutService.isHeld` reports the live state, `heldChange$` notifies mid-gesture). Both flavors share the same rubber-band rectangle UI (`SelectRectSession`, which restyles the marquee — `theme.selectRect` vs `theme.scissorRect` — the moment the key state or drag changes); they diverge in `SelectionManager.commit`:
>
> - **SELECT** selects every component and wire whose `gridBounds` intersect the rect — the standard "touching" rule.
> - **SELECT_EXACT** also selects every touching **component**, but for **wires** that extend past the rect boundary it scissors them at the boundary, keeps the inside portion selected, and leaves the outside portion(s) as separate, unselected wires. The cut registers immediately as its own history entry (state materialized directly, recorded via `ActionManager.register`), so one Ctrl+Z reverts it like any other action. A move or delete that follows **consumes** it (`SelectionManager.consumeLiveCut`) and coalesces it with its own action (`ActionManager.coalesceTop`), so cut + move still revert with one Ctrl+Z. Cancelling the selection instead — clear, mode change, click on empty space — retracts the entry (`ActionManager.retract`), restoring the original wires and leaving the history without a trace; any unrelated action recorded while the cut is live dissolves the selection (retracting the cut) first, so an uncommitted split can never be orphaned behind newer history. See `wires.md` § _Wire Scissor Cutting_ for the cut geometry and § _Cut lifecycle_ for the flow.

> **SIMULATION**: `SimulationTool` starts a `PanSession` (one-finger / left-drag pan, like `WorkMode.PAN`); a tap that never crosses the pan threshold instead hit-tests for a user-input component (button/switch) and emits it on `Project.userInput$`, which `SimulationService` reacts to. Editing stays locked — no tool drag sessions; pan/zoom keep working.

---

## `WorkModeService`

**File:** `work-mode.service.ts`

Root-provided Angular service. Holds the current mode and the selected component type as `signal`s.

### Signals

- `mode: Signal<WorkMode>` — the active mode; initial value is `PAN`
- `selectedComponentType: Signal<ComponentType | null>` — non-null only while `COMPONENT_PLACEMENT` is active
- `selectedComponentConfig: Signal<ComponentConfig | null>` — computed from `selectedComponentType`; resolves the full `ComponentConfig` via `ComponentProviderService`

### Methods

**`setMode(mode: WorkMode): void`**

Sets the active mode. If `mode` is anything other than `COMPONENT_PLACEMENT`, `selectedComponentType` is cleared to `null` — the placement type cannot survive a mode switch.

`SIMULATION` is fenced off: requesting it through `setMode` throws (a simulation session needs a compiled board, which only `SimulationService.enter()` provides), and while the current mode is `SIMULATION` all `setMode` calls are silently ignored — editing is locked, so tool shortcuts and palette clicks during a simulation are no-ops without needing guards at each call site.

**`setSimulationMode(simulating: boolean): void`**

The simulation lifecycle's only doorway past that lock: `true` enters `SIMULATION`, `false` returns to `PAN`; both clear `selectedComponentType`. Called exclusively by `SimulationService.enter()`/`exit()`.

**`setSelectedComponentType(componentType: ComponentType | null): void`**

Sets the component type independently. Ignored while `SIMULATION` is active, for the same editing-lock reason. Callers should normally use the higher-level flow below rather than calling this directly.

---

## Integration Flow

The mode change that starts in the UI and reaches the canvas travels through several layers:

```
UI (ToolBarComponent / ComponentListComponent)
  → WorkModeService.setMode() / setSelectedComponentType()
    → BoardComponent effect()
      → router.setMode(workModeService.mode())
         router.componentToPlace = workModeService.selectedComponentConfig()
        → WorkModeRouter.setMode (aborts in-progress session, pokes ticker)
          → the mode's BoardTool (rendering/interaction/tools/) on the next press
```

**Step 1 — UI triggers the change**

`ToolBarComponent` and the mobile `ToolHudComponent` both render the shared tool descriptors from `work-mode-tools.ts` (`createWorkModeTools`); the select tool's scissor sub-toggle (`createScissorToggle`) is rendered by `ScissorToggleComponent`, a floating pill over the canvas on both breakpoints. Each descriptor's `activate()`/`toggle()` calls `workModeService.setMode(WorkMode.*)`. When the user picks a component from the component palette, `ComponentListComponent.selectComponent()` calls both `setMode(WorkMode.COMPONENT_PLACEMENT)` and `setSelectedComponentType(component.type)`.

**Step 2 — BoardComponent bridges Angular and the canvas**

`BoardComponent` has an `effect()` that runs whenever `workModeService.mode()` or `workModeService.selectedComponentConfig()` changes. It writes both values onto the `WorkModeRouter`:

```ts
this._router.setMode(this.workModeService.mode());
this._router.componentToPlace = this.workModeService.selectedComponentConfig();
```

`setMode` cancels any in-flight drag session, deactivates the old mode's tool (tearing down its hover previews), clears the selection, and emits a `'single'` ticker pulse to force one render frame. `componentToPlace` forwards to the `PlacementTool`.

**Step 3 — the mode's tool acts on pointer input**

The `PointerController` (plain DOM listeners on the board canvas — see `rendering.md`) streams the primary pointer to the `WorkModeRouter`, which dispatches to the active mode's `BoardTool` (`rendering/interaction/tools/` — see `rendering.md` § _Tools_). Per tool:

- **`COMPONENT_PLACEMENT`** (`PlacementTool`) — hovers the component the next press would place; on `pointerdown`, opens a `ComponentPlacementSession` whose ghost follows the pointer (after ensuring a cloud master's circuit is loaded — the tool's gesture-stamp guard drops a load whose gesture already ended). On `pointerup`, the session adds the ghost instance to the project (plus any wire splits under its ports) and records the action via `ActionManager.register`.
- **`WIRE_TOOL`** (`WireTool`) — on `pointerdown`, snaps to half-grid (wire endpoints sit between grid cells). During `pointermove`, determines drag direction on first movement and updates two orthogonal `Wire` objects (one horizontal, one vertical) to create an L-shaped preview. On `pointerup`, the session adds the drawn wires (integrated: splits/merges applied with live instances) and records via `ActionManager.register` — unless the pointer never left its starting grid step, in which case the session fires its `onTap` callback and the tool runs the tap action (port negation, else connection toggle; see the wire-tool note above). While no pointer is pressed, `hover` previews the tap: the negation ghost over negatable ports, the connection ghost over toggleable junctions (`project.topology.connectionToggleKindAt` — 'split' shows the dot a tap would create, 'join' tints the existing dot red for removal; a dry-run of the join plan keeps T-junctions ghost-free). The previews survive the press itself and hide only when the gesture becomes a drag; after a tap the ghost re-derives in place (split ⇄ join).
- **`SELECT` / `SELECT_EXACT`** (`SelectTool`, one instance per flavor) — a press inside the committed selection's grab zone starts a `SelectionMoveSession` instead; otherwise, on `pointerdown`, attaches a `Graphics` rectangle to the layer. During `pointermove`, rescales it to follow the drag and re-checks the scissor state (`SELECT_EXACT` mode, or the held `SELECT_SCISSOR` key), restyling the marquee when it flips. On `pointerup`, normalizes the rect to positive width/height and hands it (with the effective mode) to `SelectionManager.commit`, which performs the touching-or-scissor selection described above.
- **`ERASE`** (`EraseTool`) — on `pointerdown`, immediately erases all elements whose `gridBounds` intersect the clicked grid cell, then starts an `EraseSession`. During `pointermove`, sweeps the AABB from the previous cursor position to the current one and erases everything in that rectangle, deduplicating by element ID so each element is removed at most once. On `pointerup`, records a single `ActionContainer` (combining `RemoveComponentsAction` and `RemoveWiresAction`) to `ActionManager.register` (mutations are already applied to the project). Pressing Escape calls `onCancel`, which re-adds all deleted elements, reverting the drag. If nothing was erased, no action is recorded.

---

## Ticker Management

`WorkModeRouter` drives the project's `ticker$` (`Subject<'on' | 'off' | 'single'>`) around session lifecycles:

- session start — emits `'on'` to start continuous rendering during interaction
- session end/cancel — emits `'off'` to stop the ticker after committing or clearing
- `setMode` — emits `'single'` for one render pass after an abort

`BoardComponent` subscribes to `project.ticker$` and relays the values to `app.ticker.start()`, `app.ticker.stop()`, or `app.ticker.update()` accordingly. The app normally runs with `autoStart: false` to avoid unnecessary GPU work when nothing is changing.

---

## Adding a New Mode

1. Add a value to `WorkMode`.
2. Add a translation key under `statusBar.modes.<value>` in every locale file (`src/i18n/`).
3. Add a tool descriptor in `work-mode-tools.ts` (both the desktop tool bar and the mobile HUD render from it).
4. Add a `BoardTool` in `rendering/interaction/tools/` (usually opening a new `DragSession` from `rendering/sessions/`) and register it in `WorkModeRouter`'s tool table.

---

## Type Relationships

```
WorkModeService
├── mode: Signal<WorkMode>
├── selectedComponentType: Signal<ComponentType | null>
└── selectedComponentConfig: Signal<ComponentConfig | null>   (derived)

BoardComponent  →  effect()  →  WorkModeRouter.setMode / .componentToPlace
                                  ↓
                              WorkModeRouter (dispatch + session lifecycle)
                              └── down()  →  tools.get(mode).down()
                                  ├── PlacementTool         →  ComponentPlacementSession
                                  ├── WireTool              →  WireToolSession
                                  │     └── tap →  TogglePortNegationAction | topology.toggleConnectionAt
                                  ├── EraseTool             →  EraseSession
                                  ├── PanTool / SimulationTool →  PanSession
                                  └── SelectTool            →  SelectionMoveSession | SelectRectSession
                                                                → SelectionManager.commit
                                                                  ├── SELECT       (intersect-touch)
                                                                  └── SELECT_EXACT (scissor cut + select inside;
                                                                      also via held SELECT_SCISSOR key)
```
