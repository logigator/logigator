# Wire System

Wires connect circuit elements on the editor canvas. Each wire is an axis-aligned line segment that occupies a fixed direction (horizontal or vertical) and spans an integer number of grid cells. The wire model is intentionally minimal: there is no graph, no net-list, and no connectivity tracking at this layer — wires are purely positional scene objects.

## Directory Layout

```
src/app/wires/
├── wire.ts                    # Wire class (PixiJS Graphics subclass)
├── wire-direction.enum.ts     # HORIZONTAL / VERTICAL enum
└── serialized-wire.model.ts   # Persistence DTO

src/app/rendering/graphics/
└── wire.graphics.ts           # Shared GraphicsContext drawn by every Wire

src/app/actions/actions/
├── add-wires.action.ts        # Undo-able add-wire command
└── remove-wires.action.ts     # Undo-able remove-wire command
```

---

## Core Concepts

### Wire extends PixiJS Graphics

`Wire` subclasses the PixiJS `Graphics` class directly. Rather than drawing geometry per-instance, every `Wire` shares a single `GraphicsContext` produced by `WireGraphics` and cached by `GraphicsProviderService`. The context draws a 1×1 unit rectangle (`rect(0, 0, 1, 1)`) — the wire's actual size comes from `scale.x`, and its direction comes from `rotation`.

### Grid vs. Pixel Coordinates

All circuit data is stored in grid units. `environment.gridSize` (currently `16` px) is the conversion factor used by the helpers in `utils/grid.ts`:

| Helper | Purpose |
|---|---|
| `fromGrid(n)` | grid units → pixels: `n * gridSize` |
| `toGrid(n)` | pixels → grid units (rounded): `Math.round(n / gridSize)` |
| `toHalfGrid(n)` | pixels → half-grid (for wire centres): rounds to nearest 0.5 |

**Wire centres lie on half-grid positions.** The PixiJS `position` of a wire is set so that the wire visually spans from one grid line to the next. `gridPos` always returns/accepts half-grid coordinates (e.g. `(0.5, 2.5)` means "starting at column 0, row 2").

### Constant-Width Stroke

Wires must appear the same visual thickness regardless of zoom level. This is achieved by keeping `scale.y = 1 / currentScale` while `scale.x` encodes the wire's pixel length. `applyScale(scale)` is called by `Project.updateScale` on every zoom change and stores the inverse scale in `scale.y`.

---

## `WireDirection` enum

```
src/app/wires/wire-direction.enum.ts
```

```ts
export const enum WireDirection {
    HORIZONTAL, // = 0
    VERTICAL    // = 1
}
```

`HORIZONTAL` maps to `rotation = 0`; `VERTICAL` maps to `rotation = Math.PI / 2`. The direction getter/setter on `Wire` translates between the two representations.

---

## `Wire` class

**File:** `src/app/wires/wire.ts`

### ID

Each `Wire` gets a monotonically increasing integer ID from a module-level counter (`WIRE_ID_COUNTER`). The `id` setter bumps the counter when loading persisted data with higher IDs to prevent collisions.

### Coordinate Properties

| Property | Type | Description |
|---|---|---|
| `gridPos` | `Point` | Half-grid position of the wire's start point. Getter converts from pixel `position`; setter writes back via `fromGrid`. |
| `direction` | `WireDirection` | Axis of the wire. Backed by `rotation` (0 or π/2). |
| `gridLength` | `number` | Length in grid units. Backed by `scale.x` via `fromGrid`/`toGrid`. |
| `length` | `number` | Length in raw PixiJS scale units (same as `scale.x`). Use `gridLength` for circuit logic. |

### `connectionPoints`

Returns a tuple `[start, end]` of `Point` values in **grid coordinates** (half-grid):

- Horizontal wire: `[gridPos, {x: gridPos.x + gridLength, y: gridPos.y}]`
- Vertical wire: `[gridPos, {x: gridPos.x, y: gridPos.y + gridLength}]`

These are the endpoints that should connect to component ports.

### `applyScale(scale)`

Sets `scale.y = 1 / scale` to keep the wire's visual height constant as the canvas zooms. Called by `Project` whenever the view scale changes.

### Serialization

```ts
Wire.serialize(wire)       // Wire → SerializedWire  (save/action snapshot)
Wire.deserialize(serial)   // SerializedWire → Wire  (load/undo restore)
```

`serialize` floors the grid position to integer coordinates (the position is stored at the grid-line origin, not the half-grid centre). `deserialize` adds 0.5 back so the internal `gridPos` is correctly centred.

---

## `SerializedWire` interface

**File:** `src/app/wires/serialized-wire.model.ts`

```ts
interface SerializedWire {
    id: number;               // Wire ID (for undo/redo lookup)
    pos: [number, number];    // Integer grid position [x, y] of the start point
    direction: WireDirection;
    length: number;           // Grid-unit length
}
```

This is the canonical persistence format used by both the undo/redo action system and project serialization.

---

## `WireGraphics`

**File:** `src/app/rendering/graphics/wire.graphics.ts`

A `GraphicsContext` subclass that draws a single 1×1 white rectangle filled with the `wire` colour from `ThemingService`. All `Wire` instances share this context — it is cached by `GraphicsProviderService` the first time `WireGraphics` is requested, so theme changes that happen after construction are not reflected automatically.

---

## Project Integration

`Project` owns a dedicated `Container<Wire>` (`_wires`) that sits in the display list between the grid layer and the components layer:

```
Project (InteractionContainer)
├── Grid
├── _wires  ← Container<Wire>
├── _components
└── FloatingLayer
```

`Project.addWire(wire)` calls `wire.applyScale(this.scale.x)` before adding it to `_wires`, ensuring the wire renders at the correct thickness for the current zoom level. `Project.removeWire(wireId)` is not yet implemented (marked TODO).

---

## Wire Drawing Interaction (FloatingLayer)

When `WorkMode.WIRE_DRAWING` is active, `FloatingLayer` handles the user drag gesture:

1. **`pointerdown`** — records the drag start in world space, snapped to the half-grid (`alignPointToHalfGrid`). The `FloatingLayer`'s position is set to this snapped point.

2. **`pointermove` → `handleMouseMoveWhilePlacingWire`** — on first non-zero mouse movement, the dominant axis is determined:
   - Movement on X first → `WireDirection.HORIZONTAL` locked.
   - Movement on Y first → `WireDirection.VERTICAL` locked.
   
   Two `Wire` children are added to `_wireSelection` — one horizontal and one vertical — creating an L-shaped preview routed from the drag origin to the cursor. Positions and lengths are updated every frame:
   - The horizontal wire's `position.x` tracks the leftmost extent (`Math.min(0, mouseX)`).
   - The vertical wire's `position.y` tracks the topmost extent (`Math.min(0, mouseY)`).
   - The elbow of the L is placed at the cursor's axis-locked coordinate.

3. **`pointerup` → `commitSelection`** — wires with `gridLength > 0` are collected, their positions are converted from local → world coordinates (adding `FloatingLayer.position`), and an `AddWiresAction` is pushed to the `ActionManager`. Zero-length wires are silently discarded.

4. **Mode change or abort** — `abortSelection` destroys the preview wires without committing.

---

## Undo / Redo

Wire mutations go through the `ActionManager` on `Project.actionManager`.

### `AddWiresAction`

Accepts one or more `Wire` instances at construction time. Immediately serializes them to `SerializedWire[]` so the action is self-contained and immune to further mutations on the live objects.

| Method | Effect |
|---|---|
| `do(project)` | Deserializes each wire and calls `project.addWire(...)` |
| `undo(project)` | Calls `project.removeWire(wire.id)` for each stored ID |

### `RemoveWiresAction`

Mirror of `AddWiresAction` with `do` and `undo` swapped.

### `ActionContainer`

When a single user gesture places both components and wires (e.g., a component placement also lays connecting wires), the `FloatingLayer.commitSelection` wraps multiple actions in an `ActionContainer` so the whole operation undoes atomically.

---

## Type Hierarchy

```
PixiJS Graphics
└── Wire

GraphicsContext
└── WireGraphics  (shared instance, cached by GraphicsProviderService)

Action (abstract)
├── AddWiresAction
└── RemoveWiresAction
```

---

## Known Gaps / TODOs

- `Project.removeWire(wireId)` is not implemented — `RemoveWiresAction.do` will throw at runtime.
- There is no wire intersection or T-junction detection; the system does not split wires when another wire crosses them.
- No connectivity graph is maintained. Net-list extraction (required by the simulation layer) must be derived externally from the positional data in `_wires.children`.