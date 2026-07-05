# Work Mode

The work mode system tracks which editing tool is currently active and routes pointer interactions on the canvas accordingly.

## Directory Layout

```
src/app/work-mode/
├── work-mode.enum.ts          # Enum of all mode identifiers
├── work-mode.service.ts       # Angular signal-based state holder
└── work-mode.service.spec.ts  # Mode switching + simulation-lock tests
```

---

## Core Concepts

### WorkMode Enum

**File:** `work-mode.enum.ts`

Seven string-valued enum members identify the available interaction modes:

| Member                | Value          | Notes                                            |
| --------------------- | -------------- | ------------------------------------------------ |
| `WIRE_DRAWING`        | `'drawWire'`   |                                                  |
| `WIRE_CONNECTION`     | `'connWire'`   |                                                  |
| `SELECT`              | `'sel'`        |                                                  |
| `SELECT_EXACT`        | `'selExact'`   | Scissor select — see note below                  |
| `ERASE`               | `'erase'`      |                                                  |
| `COMPONENT_PLACEMENT` | `'placeComp'`  | Also covers text placement (TEXT component type) |
| `SIMULATION`          | `'simulation'` | Editing locked — see `WorkModeService` below     |

The string values are used as i18n key suffixes — `statusBar.modes.<value>` — so changing them is a breaking i18n change.

> **SELECT vs SELECT_EXACT**: Both modes share the same rubber-band rectangle UI (`SelectRectSession`). They diverge in `SelectionManager.commit`:
>
> - **SELECT** selects every component and wire whose `gridBounds` intersect the rect — the standard "touching" rule.
> - **SELECT_EXACT** also selects every touching **component**, but for **wires** that extend past the rect boundary it scissors them at the boundary, keeps the inside portion selected, and leaves the outside portion(s) as separate, unselected wires. The cut is **tentative** — `SelectionManager` mutates the project directly but does not push to `ActionManager`. The cut becomes a real undo entry only when a move follows (`SelectionMoveSession` claims it via `claimPendingCut` and folds it into the move's `ActionContainer`, so cut + move revert with one Ctrl+Z). Any cancel path — selection clear, mode change, Escape, or Ctrl+Z while no move has happened — rolls the cut back, restoring the original wires. See `wires.md` § _Wire Scissor Cutting_ for the cut geometry and § _Tentative cut + commit on move_ for the lifecycle.

> **SIMULATION**: `WorkModeRouter`'s `down` branch starts a `PanSession` (one-finger / left-drag pan, like `WorkMode.PAN`); a tap that never crosses the pan threshold instead hit-tests for a user-input component (button/lever) and emits it on `Project.userInput$`, which `SimulationService` reacts to. Editing stays locked — no tool drag sessions; pan/zoom keep working.

---

## `WorkModeService`

**File:** `work-mode.service.ts`

Root-provided Angular service. Holds the current mode and the selected component type as `signal`s.

### Signals

- `mode: Signal<WorkMode>` — the active mode; initial value is `WIRE_DRAWING`
- `selectedComponentType: Signal<ComponentType | null>` — non-null only while `COMPONENT_PLACEMENT` is active
- `selectedComponentConfig: Signal<ComponentConfig | null>` — computed from `selectedComponentType`; resolves the full `ComponentConfig` via `ComponentProviderService`

### Methods

**`setMode(mode: WorkMode): void`**

Sets the active mode. If `mode` is anything other than `COMPONENT_PLACEMENT`, `selectedComponentType` is cleared to `null` — the placement type cannot survive a mode switch.

`SIMULATION` is fenced off: requesting it through `setMode` throws (a simulation session needs a compiled board, which only `SimulationService.enter()` provides), and while the current mode is `SIMULATION` all `setMode` calls are silently ignored — editing is locked, so tool shortcuts and palette clicks during a simulation are no-ops without needing guards at each call site.

**`setSimulationMode(simulating: boolean): void`**

The simulation lifecycle's only doorway past that lock: `true` enters `SIMULATION`, `false` returns to `SELECT`; both clear `selectedComponentType`. Called exclusively by `SimulationService.enter()`/`exit()`.

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
          → switch(mode) in WorkModeRouter.down on the next press
```

**Step 1 — UI triggers the change**

`ToolBarComponent` calls `workModeService.setMode(WorkMode.*)` directly for each tool button. When the user picks a component from the component palette, `ComponentListComponent.selectComponent()` calls both `setMode(WorkMode.COMPONENT_PLACEMENT)` and `setSelectedComponentType(component.type)`.

**Step 2 — BoardComponent bridges Angular and the canvas**

`BoardComponent` has an `effect()` that runs whenever `workModeService.mode()` or `workModeService.selectedComponentConfig()` changes. It writes both values onto the `WorkModeRouter`:

```ts
this._router.setMode(this.workModeService.mode());
this._router.componentToPlace = this.workModeService.selectedComponentConfig();
```

`setMode` cancels any in-flight drag session, clears the selection, and emits a `'single'` ticker pulse to force one render frame.

**Step 3 — WorkModeRouter acts on pointer input**

The `PointerController` (plain DOM listeners on the board canvas — see `rendering.md`) streams the primary pointer to the `WorkModeRouter`, whose `down` handler switches on the active mode:

- **`COMPONENT_PLACEMENT`** — on `pointerdown`, snaps to grid and adds a ghost `Component` to the selection container. On `pointermove`, follows the pointer. On `pointerup`, calls `commitSelection()`, which wraps the placed components in an `AddComponentsAction` and pushes it to `ActionManager`.
- **`WIRE_DRAWING`** — on `pointerdown`, snaps to half-grid (wire endpoints sit between grid cells). During `pointermove`, determines drag direction on first movement and updates two orthogonal `Wire` objects (one horizontal, one vertical) to create an L-shaped preview. On `pointerup`, commits non-zero-length wires via `AddWiresAction`.
- **`SELECT` / `SELECT_EXACT`** — on `pointerdown`, attaches a `Graphics` rectangle to the layer. During `pointermove`, rescales it to follow the drag. On `pointerup`, normalizes the rect to positive width/height and hands it (with the active mode) to `SelectionManager.commit`, which performs the touching-or-scissor selection described above.
- **`ERASE`** — on `pointerdown`, immediately erases all elements whose `gridBounds` intersect the clicked grid cell, then starts an `EraseSession`. During `pointermove`, sweeps the AABB from the previous cursor position to the current one and erases everything in that rectangle, deduplicating by element ID so each element is removed at most once. On `pointerup`, records a single `ActionContainer` (combining `RemoveComponentsAction` and `RemoveWiresAction`) to `ActionManager.register` (mutations are already applied to the project). Pressing Escape calls `onCancel`, which re-adds all deleted elements, reverting the drag. If nothing was erased, no action is recorded.

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
3. Add a toolbar button in `ToolBarComponent` that calls `setMode()`, plus a computed style signal for its active state.
4. Add a `case WorkMode.<NEW>:` branch to `WorkModeRouter.down` (usually a new `DragSession` in `rendering/sessions/`).

---

## Type Relationships

```
WorkModeService
├── mode: Signal<WorkMode>
├── selectedComponentType: Signal<ComponentType | null>
└── selectedComponentConfig: Signal<ComponentConfig | null>   (derived)

BoardComponent  →  effect()  →  WorkModeRouter.setMode / .componentToPlace
                                  ↓
                              WorkModeRouter
                              ├── setMode  (aborts + ticks)
                              └── down()  (switch on mode)
                                  ├── COMPONENT_PLACEMENT  →  AddComponentsAction
                                  ├── WIRE_DRAWING         →  AddWiresAction
                                  ├── ERASE                →  RemoveComponentsAction + RemoveWiresAction
                                  └── SELECT / SELECT_EXACT →  SelectionManager.commit
                                                                ├── SELECT       (intersect-touch)
                                                                └── SELECT_EXACT (scissor cut + select inside)
```
