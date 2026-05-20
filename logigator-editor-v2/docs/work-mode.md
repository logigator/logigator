# Work Mode

The work mode system tracks which editing tool is currently active and routes pointer interactions on the canvas accordingly.

## Directory Layout

```
src/app/work-mode/
├── work-mode.enum.ts          # Enum of all mode identifiers
├── work-mode.service.ts       # Angular signal-based state holder
└── work-mode.service.spec.ts  # Basic smoke test
```

---

## Core Concepts

### WorkMode Enum

**File:** `work-mode.enum.ts`

Seven string-valued enum members identify the available editing tools:

| Member | Value | Status |
|---|---|---|
| `WIRE_DRAWING` | `'drawWire'` | Implemented |
| `WIRE_CONNECTION` | `'connWire'` | Enum only — not yet wired to canvas interaction |
| `SELECT` | `'sel'` | Implemented |
| `SELECT_EXACT` | `'selExact'` | Implemented (no behavioral difference from `SELECT` yet — see note below) |
| `ERASE` | `'erase'` | Enum only — not yet wired to canvas interaction |
| `PLACE_TEXT` | `'text'` | Enum only — not yet wired to canvas interaction |
| `COMPONENT_PLACEMENT` | `'placeComp'` | Implemented |

The string values are used as i18n key suffixes — `statusBar.modes.<value>` — so changing them is a breaking i18n change.

> **SELECT vs SELECT_EXACT**: Both modes produce the same rubber-band selection behavior in `FloatingLayer`. They share fall-through case labels in all three pointer handlers. The intended semantic distinction (exact containment vs. partial intersection) has not yet been implemented.

> **WIRE_CONNECTION, ERASE, PLACE_TEXT**: These values can be selected through the toolbar UI, and `WorkModeService` accepts them, but `FloatingLayer` contains no `case` branch for any of them. Pointer events on the canvas are effectively no-ops while these modes are active.

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

Sets the active mode. If `mode` is anything other than `COMPONENT_PLACEMENT`, `selectedComponentType` is cleared to `null`. This is the only non-trivial logic in the service: the placement type cannot survive a mode switch.

**`setSelectedComponentType(componentType: ComponentType | null): void`**

Sets the component type independently. Callers should normally use the higher-level flow below rather than calling this directly.

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
- **`SELECT` / `SELECT_EXACT`** — on `pointerdown`, attaches a `Graphics` rectangle to the layer. During `pointermove`, rescales it to follow the drag. On `pointerup`, clears it. Full selection logic (collecting intersecting elements) is not yet implemented.

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
                                  └── SELECT / SELECT_EXACT →  rubber-band rect (commit unimplemented)
```