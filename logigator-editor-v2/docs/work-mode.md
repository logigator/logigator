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

| Member                | Value          | Notes                                              |
| --------------------- | -------------- | -------------------------------------------------- |
| `WIRE_DRAWING`        | `'drawWire'`   |                                                    |
| `WIRE_CONNECTION`     | `'connWire'`   |                                                    |
| `SELECT`              | `'sel'`        |                                                    |
| `SELECT_EXACT`        | `'selExact'`   | Scissor select — see note below                    |
| `ERASE`               | `'erase'`      |                                                    |
| `COMPONENT_PLACEMENT` | `'placeComp'`  | Also covers text placement (TEXT component type)   |
| `SIMULATION`          | `'simulation'` | Editing locked — see `WorkModeService` below       |

The string values are used as i18n key suffixes — `statusBar.modes.<value>` — so changing them is a breaking i18n change.

> **SELECT vs SELECT_EXACT**: Both modes share the same rubber-band rectangle UI in `FloatingLayer`. They diverge in `SelectionManager.commit`:
>
> - **SELECT** selects every component and wire whose `gridBounds` intersect the rect — the standard "touching" rule.
> - **SELECT_EXACT** also selects every touching **component**, but for **wires** that extend past the rect boundary it scissors them at the boundary, keeps the inside portion selected, and leaves the outside portion(s) as separate, unselected wires. The cut is **tentative** — `SelectionManager` mutates the project directly but does not push to `ActionManager`. The cut becomes a real undo entry only when a move follows (`SelectionMoveSession` claims it via `claimPendingCut` and folds it into the move's `ActionContainer`, so cut + move revert with one Ctrl+Z). Any cancel path — selection clear, mode change, Escape, or Ctrl+Z while no move has happened — rolls the cut back, restoring the original wires. See `wires.md` § _Wire Scissor Cutting_ for the cut geometry and § _Tentative cut + commit on move_ for the lifecycle.

> **SIMULATION**: No drag sessions — `FloatingLayer`'s `pointerdown` branch only hit-tests for user-input components (button/lever) and emits them on `Project.userInput$`; `SimulationService` reacts to those events. Pan/zoom keep working.

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
      → project.mode = workModeService.mode()
         project.componentToPlace = workModeService.selectedComponentConfig()
        → FloatingLayer.mode setter (aborts in-progress interaction, pokes ticker)
          → switch(project.mode) in FloatingLayer pointer handlers
```

**Step 1 — UI triggers the change**

`ToolBarComponent` calls `workModeService.setMode(WorkMode.*)` directly for each tool button. When the user picks a component from the component palette, `ComponentListComponent.selectComponent()` calls both `setMode(WorkMode.COMPONENT_PLACEMENT)` and `setSelectedComponentType(component.type)`.

**Step 2 — BoardComponent bridges Angular and PixiJS**

`BoardComponent` has an `effect()` that runs whenever `workModeService.mode()` or `workModeService.selectedComponentConfig()` changes. It writes both values straight onto the `Project` instance that is the PixiJS stage root:

```ts
project.mode = this.workModeService.mode();
project.componentToPlace = this.workModeService.selectedComponentConfig();
```

**Step 3 — Project delegates to FloatingLayer**

`Project.mode` is a pass-through property. Getting or setting it talks directly to `FloatingLayer.mode`. The setter calls `abortSelection()` (drops any ghost components or wire previews) and then emits a `'single'` ticker pulse to force one render frame.

**Step 4 — FloatingLayer acts on pointer events**

`FloatingLayer` is the transparent PixiJS `Container` that sits in front of all circuit elements and receives all pointer input. Its three handlers — `onPointerDown`, `onPointerMove`, `onPointerUp` — each switch on `project.mode`:

- **`COMPONENT_PLACEMENT`** — on `pointerdown`, snaps to grid and adds a ghost `Component` to the selection container. On `pointermove`, follows the pointer. On `pointerup`, calls `commitSelection()`, which wraps the placed components in an `AddComponentsAction` and pushes it to `ActionManager`.
- **`WIRE_DRAWING`** — on `pointerdown`, snaps to half-grid (wire endpoints sit between grid cells). During `pointermove`, determines drag direction on first movement and updates two orthogonal `Wire` objects (one horizontal, one vertical) to create an L-shaped preview. On `pointerup`, commits non-zero-length wires via `AddWiresAction`.
- **`SELECT` / `SELECT_EXACT`** — on `pointerdown`, attaches a `Graphics` rectangle to the layer. During `pointermove`, rescales it to follow the drag. On `pointerup`, normalizes the rect to positive width/height and hands it (with the active mode) to `SelectionManager.commit`, which performs the touching-or-scissor selection described above.
- **`ERASE`** — on `pointerdown`, immediately erases all elements whose `gridBounds` intersect the clicked grid cell, then starts an `EraseSession`. During `pointermove`, sweeps the AABB from the previous cursor position to the current one and erases everything in that rectangle, deduplicating by element ID so each element is removed at most once. On `pointerup`, records a single `ActionContainer` (combining `RemoveComponentsAction` and `RemoveWiresAction`) to `ActionManager.register` (mutations are already applied to the project). Pressing Escape calls `onCancel`, which re-adds all deleted elements, reverting the drag. If nothing was erased, no action is recorded.

---

## Ticker Management

`FloatingLayer` holds a reference to the shared `Subject<'on' | 'off' | 'single'>` from `InteractionContainer`. Pointer activity drives this ticker:

- `pointerdown` — emits `'on'` to start continuous rendering during interaction
- `pointerup` — emits `'off'` to stop the ticker after committing or clearing
- Mode setter — emits `'single'` for one render pass after an abort

`BoardComponent` subscribes to `project.ticker$` and relays the values to `app.ticker.start()`, `app.ticker.stop()`, or `app.ticker.update()` accordingly. The app normally runs with `autoStart: false` to avoid unnecessary GPU work when nothing is changing.

---

## Adding a New Mode

1. Add a value to `WorkMode`.
2. Add a translation key under `statusBar.modes.<value>` in every locale file (`src/i18n/`).
3. Add a toolbar button in `ToolBarComponent` that calls `setMode()`, plus a computed style signal for its active state.
4. Add `case WorkMode.<NEW>:` branches to all three pointer handlers in `FloatingLayer` (`onPointerDown`, `onPointerMove`, `onPointerUp`).

---

## Type Relationships

```
WorkModeService
├── mode: Signal<WorkMode>
├── selectedComponentType: Signal<ComponentType | null>
└── selectedComponentConfig: Signal<ComponentConfig | null>   (derived)

BoardComponent  →  effect()  →  Project.mode / Project.componentToPlace
                                  ↓
                              FloatingLayer
                              ├── mode setter  (aborts + ticks)
                              └── pointer handlers  (switch on project.mode)
                                  ├── COMPONENT_PLACEMENT  →  AddComponentsAction
                                  ├── WIRE_DRAWING         →  AddWiresAction
                                  ├── ERASE                →  RemoveComponentsAction + RemoveWiresAction
                                  └── SELECT / SELECT_EXACT →  SelectionManager.commit
                                                                ├── SELECT       (intersect-touch)
                                                                └── SELECT_EXACT (scissor cut + select inside)
```
