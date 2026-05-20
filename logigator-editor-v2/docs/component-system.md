# Component System

The component system models every circuit element that can be placed on the editor canvas. Each component is a PixiJS `Container` subclass that owns its own rendering, configuration, and port topology.

## Directory Layout

```
src/app/components/
├── component.ts                    # Abstract base class
├── component-type.enum.ts          # Numeric ID enum for all component types
├── component-rotation.enum.ts      # Four-direction rotation enum
├── component-category.enum.ts      # UI palette grouping enum
├── component-option.ts             # Abstract base for configurable options
├── component-config.model.ts       # Static metadata + factory interface
├── serialized-component.model.ts   # Persistence DTO
├── component-provider.service.ts   # Angular service — registry and lookup
├── component-options/              # Reusable option implementations
└── component-types/                # One subdirectory per component type
    └── <name>/
        ├── <name>.config.ts        # ComponentConfig constant
        └── <name>.component.ts     # Component subclass
```

---

## Core Concepts

### Component extends PixiJS Container

Every circuit element is an instance of an `abstract Component extends Container`. Components live in `Project._gridSpace` (which has `scale = gridSize`), so their PixiJS `position` **is** the grid-unit position — no manual conversion is required. Rotation is expressed as a `ComponentRotation` enum value (four cardinal directions) rather than raw radians.

### `_visualSpace` — pixel-authored visual children

Visual children (component body graphics, port wire stubs, text labels) are pixel-authored: their coordinates are in pixels, not grid units. To keep those pixel formulas correct while `Component` itself lives in grid-space, every `Component` owns a private inner `Container` called `_visualSpace` with `scale.set(1 / environment.gridSize)`. The two scalings cancel, so visual geometry is unaffected. Subclasses add all visual objects to `_visualSpace`, never to `this` directly.

### Grid vs. Pixel Coordinates

`Component.position` is in **grid units** — it is the canonical circuit coordinate. All visual authoring happens inside `_visualSpace` where coordinates are back in pixel space. Helpers in `utils/grid.ts` (`fromGrid`) are still used inside `_visualSpace` (e.g., for wire stub offsets), but no conversion is needed at the model layer. Connection points are computed and returned in grid-unit space (parent `_gridSpace` coordinates).

### Options System

Each component type exposes a list of `ComponentOption` instances — observable values that drive component state. When a setting changes (e.g., number of inputs, rotation), the option emits on `onChange$` and the component reacts, updating its properties and triggering a redraw.

Options defined in `ComponentConfig` serve as **templates**. On instantiation, each option is `.clone()`'d so the live component owns independent copies.

### Serialization

A placed component round-trips through `SerializedComponent`:

```
Component  →  Component.serialize(c)         →  SerializedComponent   (save)
SerializedComponent  →  Component.deserialize(s, config)  →  Component  (load)
```

The serialized form stores the type, grid-unit position (`component.position.x / y`), and an array of raw option values positionally aligned to `config.options`. Because `position` is already in grid units there is no conversion step during serialization or deserialization.

---

## Enums

**`ComponentType`** — numeric ID for every component type; used as registry keys and stored in serialized data.

**`ComponentRotation`** — four cardinal directions (Right, Down, Left, Up) mapping directly to 90° increments. The `direction` setter on `Component` applies the PixiJS rotation automatically.

**`ComponentCategory`** — groups components for the UI palette (e.g., Basic, Advanced).

---

## `Component` (abstract base class)

**File:** `component.ts`

Subclasses must implement:

- `config: ComponentConfig` — reference to the singleton config for this type
- `inputLabels: string[]` — per-port labels rendered beside input wires
- `outputLabels: string[]` — per-port labels rendered beside output wires
- `draw(): void` — renders the component body (shapes, symbols, etc.)

Key public members:

- `id`, `direction`, `numInputs`, `numOutputs` — core state; setters on `numInputs`/`numOutputs` and `direction` trigger a redraw
- `position` (inherited from PixiJS Container) — the component's grid-unit position; this IS the canonical circuit coordinate
- `options: ComponentOption[]` — live option instances owned by this component
- `connectionPoints: Point[]` — port positions in grid-unit space (parent `_gridSpace` coordinates; inputs first, then outputs)
- `gridBounds: Rectangle` — axis-aligned bounding box in grid units, accounting for rotation; used by `QuadTreeContainer` for spatial indexing
- `applyScale(scale)` — applies a zoom scale factor and redraws (wires and component stroke widths are scale-dependent)
- `Component.serialize(c)` / `Component.deserialize(s, config)` — static round-trip helpers

### Rendering lifecycle

1. The constructor creates `_visualSpace` (with `scale = 1/gridSize`), adds it as a child, sets initial state, and calls `_draw()` once initialization is complete.
2. `_draw()` clears all children of `_visualSpace`, calls the abstract `draw()` for the component body, then auto-generates wire stubs for every port via `_drawConnections()`.
3. Port labels are positioned beside their respective wires, all inside `_visualSpace`.
4. Debug overlays (connection points, origins, hit boxes) are added to `_visualSpace` when enabled via environment config.

### Dependency injection

`Component` uses the static DI escape hatch (`getStaticDI()`) to access `ThemingService` and `GraphicsProviderService`. This is necessary because components are created with plain `new`, not by Angular's injector.

### `registerConstantRotationContainer(container)`

Children that must not rotate with the parent (e.g., text labels) can be registered here. The base class counteracts the parent rotation for these containers on every redraw.

---

## `ComponentOption<T>` (abstract base)

**File:** `component-option.ts`

An observable wrapper around a single configurable value.

- `value` — getter/setter; subclasses may override the setter for validation or clamping
- `onChange$: Subject<T>` — emits whenever `value` is set; components subscribe to react
- `clone(initialValue?)` — must return a fully independent copy; called during instantiation and deserialization
- `label: TranslationKey` — localization key for the UI label

### Option implementations in `component-options/`

**`SelectComponentOption<T>`** — categorical selection from a fixed list of choices. Supports optional icons per choice and a `'button' | 'dropdown'` UI hint.

**`NumberComponentOption`** — numeric value with `min` and `max` bounds. The value setter clamps automatically.

**`DirectionComponentOption`** — a preset `SelectComponentOption<ComponentRotation>` that exposes the four compass directions. No constructor arguments required.

---

## `ComponentConfig`

**File:** `component-config.model.ts`

Static metadata and factory definition for a component type:

- `type: ComponentType` — unique numeric ID
- `category: ComponentCategory` — palette grouping
- `symbol: string` — short label shown in the palette
- `name`, `description: TranslationKey` — localization keys
- `options: ComponentOption[]` — option templates, cloned per instance
- `implementation` — constructor reference used by `deserialize` and any factory code

---

## `ComponentProviderService`

**File:** `component-provider.service.ts`

Angular root-provided singleton. Wraps a static `COMPONENTS` record that maps every `ComponentType` to its `ComponentConfig`. Exposes lookup by type and grouped accessors by category (used by the UI palette).

To register a new component, add an entry to the `COMPONENTS` record — the service and palette pick it up automatically.

---

## Adding a New Component Type

1. Add a value to `ComponentType`.
2. Create `component-types/<name>/` with:
   - `<name>.config.ts` — export a `ComponentConfig` constant.
   - `<name>.component.ts` — extend `Component`, implement the four abstract members.
3. Add the entry to the `COMPONENTS` record in `component-provider.service.ts`.

The component appears in the palette under the category specified in its config.

---

## Type Hierarchy

```
PixiJS Container
└── Component (abstract)
    └── <concrete component classes>

ComponentOption<T> (abstract)
├── SelectComponentOption<T>
│   └── DirectionComponentOption
└── NumberComponentOption
```