# Component System

The component system models every circuit element that can be placed on the editor canvas. Each component is a PixiJS `Container` subclass that owns its own rendering, configuration, and port topology.

## Directory Layout

```
src/app/components/
├── component.ts                    # Abstract base class
├── component-type.enum.ts          # Numeric ID enum for all component types
├── component-category.enum.ts      # UI palette grouping enum
├── component-option.ts             # Abstract base for configurable options
├── component-config.model.ts       # Static metadata + factory interface
├── serialized-component.model.ts   # Persistence DTO
├── component-provider.service.ts   # Angular service — registry and lookup
├── component-options/              # Per-option folders (model + renderer); see component-options.md
└── component-types/                # One subdirectory per component type
    └── <name>/
        ├── <name>.config.ts        # ComponentConfig constant
        └── <name>.component.ts     # Component subclass

src/app/utils/
└── direction.ts                    # Direction enum (E/S/W/N — clockwise from East)
```

---

## Core Concepts

### Component extends PixiJS Container

Every circuit element is an instance of an `abstract Component extends Container`. Components live in `Project._gridSpace` (which has `scale = gridSize`), so their PixiJS `position` **is** the grid-unit position — no manual conversion is required. Rotation is expressed as a `Direction` enum value (four cardinal directions: `E`, `S`, `W`, `N`) rather than raw radians.

### `_visualSpace` — pixel-authored visual children

Visual children (component body graphics, port wire stubs, text labels) are pixel-authored: their coordinates are in pixels, not grid units. To keep those pixel formulas correct while `Component` itself lives in grid-space, every `Component` owns a private inner `Container` called `_visualSpace` with `scale.set(1 / environment.gridSize)`. The two scalings cancel, so visual geometry is unaffected. Subclasses add all visual objects to `_visualSpace`, never to `this` directly.

### Grid vs. Pixel Coordinates

`Component.position` is in **grid units** — it is the canonical circuit coordinate. All visual authoring happens inside `_visualSpace` where coordinates are back in pixel space. Helpers in `utils/grid.ts` (`fromGrid`) are still used inside `_visualSpace` (e.g., for wire stub offsets), but no conversion is needed at the model layer. Connection points are computed and returned in grid-unit space (parent `_gridSpace` coordinates).

### Options System

Each component type exposes a named record of `ComponentOption` instances — observable values that drive component state. When a setting changes (e.g., number of inputs, rotation), the option emits on `onChange$` and the component reacts, updating its properties and triggering a redraw.

Options defined in `ComponentConfig` serve as **templates**. On instantiation, each option is `.clone()`'d so the live component owns independent copies. Options are accessed by name (e.g., `options.direction`, `options.numInputs`) rather than by array index.

### Serialization

A placed component round-trips through `SerializedComponent`:

```
Component  →  Component.serialize(c)         →  SerializedComponent   (save)
SerializedComponent  →  Component.deserialize(s, config)  →  Component  (load)
```

The serialized form stores the type, grid-unit position (`component.position.x / y`), and a record of raw option values keyed by option name. Because `position` is already in grid units there is no conversion step during serialization or deserialization.

---

## Enums

**`ComponentType`** — numeric ID for every component type; used as registry keys and stored in serialized data. Built-ins (ids match the old editor's `ElementTypeId`): the basic types `NOT = 1` … `TUNNEL = 8`, the advanced types `HALF_ADDER = 10` … `DEMUX = 21` (including `ROM = 12` and `RAM = 17`), the plug types `INPUT = 100` / `OUTPUT = 101`, and the I/O types `BUTTON = 200` … `LED_MATRIX = 204` — see `component-type.enum.ts` for the full list. Numeric ids ≥ `CUSTOM_TYPE_ID_BASE` (1000) are runtime-allocated custom components.

**`Direction`** (in `utils/direction.ts`) — four cardinal directions clockwise from East: `E = 0`, `S = 1`, `W = 2`, `N = 3`. The numeric layout is load-bearing: `rotation = value * π/2` (Component direction → PixiJS rotation) and `oppositeDir = (value + 2) % 4` (input stub ↔ output stub flip). The `Component.direction` setter applies the PixiJS rotation automatically. Shared with the connection-points layer.

**Body re-anchoring** — the body is drawn from, and rotated around, the local origin, so the `direction`, `numInputs`, and `numOutputs` setters all run their mutation through `_withFixedBodyAnchor`, which holds the body's top-left corner fixed by shifting `position` by the change in `bodyGridBounds` (matching the legacy editor): rotation never moves the component (E↔W / N↔S flips stay put), and added ports grow the body toward the bottom (E/W) or the right (S/N) instead of jumping. The rotation shift is a reversible function of direction + body size, so undo via `ChangeOptionAction` round-trips without storing position.

**`ComponentCategory`** — groups components for the UI palette. Values: `HIDDEN`, `BASIC`, `ADVANCED`, `IO`, `PORT`, `USER`. The sidebar queries the matching reactive list in `ComponentProviderService` (`basicComponents` / `advancedComponents` / `ioComponents` / `userComponents`), so `HIDDEN` components never appear in the palette. `TextComponent` uses `HIDDEN`. `USER` is for custom (user-defined) components; `IO` is the input/output hardware (button, switch, LED, segment display, LED matrix); `PORT` is the INPUT/OUTPUT plug components, shown only while editing a custom component. The INPUT/OUTPUT plugs are built-ins whose port counts are fixed (`super(0, 1)` / `super(1, 0)`) and whose `label`/`index` options round-trip through the `s`/`n[0]` wire slots.

---

## `Component` (abstract base class)

**File:** `component.ts`

Subclasses must implement:

- `config: ComponentConfigView<TOptions>` — reference to the singleton config for this type
- `inputLabels: string[]` — per-port labels rendered beside input wires
- `outputLabels: string[]` — per-port labels rendered beside output wires
- `draw(): void` — renders the component body (shapes, symbols, etc.)

`Component` is generic over its options type: `Component<TOptions extends Record<string, ComponentOption>>`. Each component type exports a named options interface (e.g., `AndOptions`, `NotOptions`) that maps option names to their concrete `ComponentOption` subtypes. The component class uses that interface as its type parameter.

Key public members:

- `id`, `direction`, `numInputs`, `numOutputs` — core state; setters on `numInputs`/`numOutputs` and `direction` trigger a redraw and emit on `portsChange$`
- `position` (inherited from PixiJS Container) — the component's grid-unit position; this IS the canonical circuit coordinate
- `options: TOptions` — live option instances owned by this component, accessed by name (e.g., `this.options.direction.value`)
- `ignoresWireCollision: boolean` (default `false`) — when `true`, the component is skipped by `Project.hasWireBodyCollision` (wires may pass through its body) and `hasComponentBodyWireCollision` returns `false` for it. Currently only `TextComponent` sets this to `true`.
- `connectionPoints: Point[]` — port positions in grid-unit space (parent `_gridSpace` coordinates; inputs first, then outputs). This and the bounds below delegate to the pure functions in `component-geometry.ts`, which work on a plain shape descriptor (`direction`, port counts, body extent, position) — no PixiJS involved, so the lattice invariants (ports exactly on the half-grid, exact quarter-turn arithmetic instead of trig) are pinned by `component-geometry.spec.ts`
- `portsChange$: Subject<{ oldPorts, newPorts }>` — fires whenever the `direction`, `numInputs`, or `numOutputs` setter runs after construction. `Project.addComponent` subscribes on insert and unsubscribes in `removeComponent`. The handler runs `topology.integrate({ movedComponentPorts })` to enforce the split-on-touch invariants (a new port landing on a wire's interior auto-splits that wire), then updates CP markers. The integrator pass is applied directly without `ActionManager` wrapping, so the implied splits/merges aren't undoable — rotation never had undo support anyway. See [Wire Integration Invariants](wires.md#wire-integration-invariants).
- `gridBounds: Rectangle` — axis-aligned bounding box in grid units, accounting for rotation; **includes** 0.5-unit stub padding on the input and output sides; used by `QuadTreeContainer` for spatial indexing and component–component collision
- `bodyGridBounds: Rectangle` — same AABB as `gridBounds` but **excluding** stub padding; used for wire–body collision checks so that a wire endpoint touching a port stub tip is not falsely reported as a collision
- `applyScale(scale)` — updates zoom-dependent visual props **in place** (port-stub thickness, scaled `GraphicsContext` swaps) without rebuilding the visual tree. It runs the rescalers registered during the last `draw()` — it does **not** call `_draw()`, so it stays cheap on large projects during continuous zoom. Text needs no rescaler at all: labels are `BitmapText` drawn from the pre-installed atlas (see `AssetsService` in [rendering.md](rendering.md)), so zoom only scales glyph quads.
- `refreshTheme()` — restyles every theme-dependent visual **in place** after a theme change, never rebuilding children. Re-running the rescalers re-fetches the shared scale-keyed contexts (their cache key includes the active theme), so context-baked colors swap pointers; the theme restylers registered via `onApplyTheme` rewrite instance tints and glyph colors; `refreshTint()` re-derives the selection highlight.
- `Component.serialize(c)` / `Component.deserialize(s, config)` — static round-trip helpers

Protected helpers available to subclasses:

- `redraw()` — triggers a full redraw (structural rebuild). Call from option `onChange$` handlers when bespoke component state (other than `numInputs` / `numOutputs` / `direction`) changes the visual. `TextComponent` uses this to react to text content and font-size changes.
- `onApplyScale(fn)` — registers a zoom-scale-dependent visual update. The callback runs immediately with the current scale and again on every `applyScale`. Reset on each `draw()`, so register from inside `draw()`.
- `onApplyTheme(fn)` — registers a theme-dependent color write (a tint or glyph color). The callback runs immediately and again on every `refreshTheme`; zoom does **not** run these. Any `draw()` code that reads a theme color must do so inside one of these callbacks — the `theme-restyle.spec.ts` invariant test (restyle must match a fresh build, for every registered type) fails on a missed registration. Themed text is white-`fill` + tint: `fill` is baked into the text's proxy context (a write re-runs glyph layout), so construct `BitmapText`s with `fill: 0xffffff` and apply the theme color as `tint`.
- `addBody(width, height)` — adds the standard chamfered body outline; its `ComponentGraphics` stroke stays screen-constant across zoom via a registered context swap. Returns the `Graphics`.
- `addScaledGraphics(contextFor)` — adds a `Graphics` whose shared `GraphicsContext` depends on zoom scale (e.g. `ButtonGraphics`), swapping to the correctly-scaled cached context on `applyScale`.

### Build vs. rescale vs. restyle

A component's visual tree is built once per **structural** change (construction, `numInputs`/`numOutputs`/`direction`/option changes — all routed through `_draw()`). **Zoom** and **theme** are handled in place: `applyScale` refreshes the scale-dependent properties of the already-built elements via the rescalers each `draw()` registers, and `refreshTheme` re-runs those same rescalers (context re-fetch under the new theme key) plus the color restylers registered via `onApplyTheme`. This split keeps zooming from re-rasterizing every component per wheel notch and keeps a theme change (live toggle, dual-theme save previews) from destroying and rebuilding the whole scene. When writing a `draw()`, register any element whose on-screen size must stay constant across zoom through `onApplyScale` / `addBody` / `addScaledGraphics`, and any theme-color read through `onApplyTheme`.

### Rendering lifecycle

1. The constructor creates `_visualSpace` (with `scale = 1/gridSize`), adds it as a child, sets initial state, and calls `_draw()` once initialization is complete.
2. `_draw()` clears all children of `_visualSpace`, calls the abstract `draw()` for the component body, then auto-generates wire stubs for every port via `_drawConnections()`.
3. Port labels are positioned beside their respective wires, all inside `_visualSpace`.
4. Debug overlays (connection points, origins, hit boxes) are added to `_visualSpace` when enabled via environment config.

### Dependency injection

`Component` uses the static DI escape hatch (`getStaticDI()`) to access `ThemingService` and `GraphicsProviderService`. This is necessary because components are created with plain `new`, not by Angular's injector.

### `registerRotationCounterContainer(container)`

Children that must not rotate with the parent (e.g., text labels, a custom component's symbol) can be registered here. The base class counteracts the parent rotation for these containers on every redraw.

---

## `ComponentOption<T>` (abstract base)

**File:** `component-option.ts`

An observable wrapper around a single configurable value.

- `value` — getter/setter; subclasses may override the setter for validation or clamping
- `onChange$: Subject<T>` — emits whenever `value` is set; components subscribe to react
- `clone(initialValue?)` — must return a fully independent copy; called during instantiation and deserialization
- `label: TranslationKey` — localization key for the UI label

### Option implementations

The concrete option classes (`NumberComponentOption`, `SelectButtonComponentOption<T>`, `SelectDropdownComponentOption<T>`, `DirectionComponentOption`, `TextAreaComponentOption`, `TextInputComponentOption`) live in per-kind folders under `component-options/`, alongside the Angular components that render them in the side panel. See [`component-options.md`](component-options.md) for the option model, the renderer contract, and how to add a new option kind. Writing to `DirectionComponentOption.value` from the side panel flows into `Component.direction = ...`, which fires `portsChange$` and lets the CP manager rebuild dots at the new tip positions.

---

## `ComponentConfigView` and `ComponentConfig`

**File:** `component-config.model.ts`

Static metadata and factory definition for a component type, split into two interfaces:

**`ComponentConfigView<TOptions>`** — the read-only metadata side, exposed by `Component.config`:

- `type: ComponentType` — unique numeric ID
- `category: ComponentCategory` — palette grouping
- `symbol: string` — short label shown in the palette
- `name`, `description: TranslationKey` — localization keys
- `options: TOptions` — option templates as a named record (e.g., `{ direction: DirectionComponentOption, numInputs: NumberComponentOption }`), cloned per instance

**`ComponentConfig<TOptions>`** extends `ComponentConfigView<TOptions>` and adds the factory:

- `create(options: TOptions): Component<TOptions>` — builds an instance from its options; called by `Component.deserialize` and placement code. A factory (rather than a bare constructor reference) lets a config close over per-definition state — this is what lets one `CustomComponent` class back every custom type (see [`custom-components.md`](custom-components.md)).

The separation ensures that a `Component` instance only carries the view interface (it doesn't need its own constructor), while the registry and placement code use the full config with the factory.

---

## `ComponentProviderService`

**File:** `component-provider.service.ts`

Angular root-provided singleton. Holds a signal-backed `Map<number, ComponentConfig>`, seeded from the built-in configs and keyed by numeric type id (not the closed `ComponentType` enum) so runtime-allocated custom configs can be registered alongside built-ins. `getComponent(type: number)` looks up by id; `register(config)` / `unregister(typeId)` add/remove custom configs dynamically; the reactive per-category lists (`basicComponents` / `advancedComponents` / `userComponents` / `ioComponents`) are `computed` over the map, so the palette updates automatically as configs are registered.

To add a new built-in, add its config to the `BUILT_IN_COMPONENTS` array. Custom components are registered at runtime by the [`CustomComponentRegistry`](custom-components.md).

---

## Adding a New Component Type

1. Add a value to `ComponentType`.
2. Create `component-types/<name>/` with:
   - `<name>.config.ts` — export a named options interface (e.g., `AndOptions`) and a `ComponentConfig<YourOptions>` constant with named option keys.
   - `<name>.component.ts` — extend `Component<YourOptions>`, implement the four abstract members. Access options by name via `this.options.<key>`.
3. Add the entry to the `COMPONENTS` record in `component-provider.service.ts`.

The component appears in the palette under the category specified in its config.

---

## Type Hierarchy

```
PixiJS Container
└── Component (abstract)
    └── <concrete component classes>

ComponentOption<T> (abstract)
├── NumberComponentOption
├── SelectButtonComponentOption<T>
│   └── DirectionComponentOption
└── SelectDropdownComponentOption<T>
```
