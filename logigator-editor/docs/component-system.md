# Component System

Every circuit element is a `Component`, an abstract PixiJS `Container` subclass
owning its rendering, options and port topology. Its identity, option
constraints and geometry are **not** declared in the editor: they are a pure
`ComponentMeta` in `@logigator/core` (`catalog/built-ins/<name>.meta.ts`,
collected in `BUILT_IN_META`), shared with the API.

```
src/app/components/
├── component.ts                    # Abstract base class
├── component-geometry.ts           # Pure port/bounds math (lattice-exact, unit-tested)
├── component-option.ts             # Abstract base for configurable options
├── component-config.model.ts       # Static metadata + factory interfaces
├── config-from-meta.ts             # ComponentMeta → ComponentConfig; schema kind → option class
├── meta-translation-keys.ts        # Type-level gate: every meta key is a TranslationKey
├── component-provider.service.ts   # Registry and lookup
├── component-options/              # Per-option folders (model + renderer); component-options.md
└── component-types/<name>/         # <name>.config.ts + <name>.component.ts
```

## Coordinates: grid outside, pixels inside

Components live in `Project._gridSpace` (`scale = gridSize`), so a component's
PixiJS `position` **is** its grid-unit position — the canonical circuit
coordinate, with no conversion at the model layer or during serialization.
Visual children (body graphics, port stubs, labels) are pixel-authored, so every
`Component` owns an inner `_visualSpace` with `scale.set(1 / gridSize)`; the two
scalings cancel. **Subclasses add visual objects to `_visualSpace`, never to
`this`.** `fromGrid` (`utils/grid.ts`) is still used inside `_visualSpace`, e.g.
for stub offsets. Connection points come back out in grid units.

`connectionPoints`, `gridBounds` and `bodyGridBounds` delegate to
`component-geometry.ts`, whose pure functions take a plain shape descriptor
(direction, port counts, body extent, position) and involve no PixiJS. That is
what keeps the lattice invariants — ports exactly on the half-grid, exact
quarter-turn arithmetic instead of trig — pinned by `component-geometry.spec.ts`.
`gridBounds` **includes** 0.5-unit stub padding (spatial index, component–component
collision); `bodyGridBounds` excludes it, so a wire endpoint touching a stub tip
is not a collision.

## `Component` (abstract base)

A subclass implements `config` and `draw()`, and passes its
`ComponentGeometrySource` to `super(source, options)` — the meta for a built-in,
a definition-derived equivalent for a custom component. The base derives
`numInputs`/`numOutputs`, port labels and body extent from it and subscribes to
every option, so

> **port counts are read-only: change an option to change the arity.**

`onOptionsChanged()` re-derives all of it in one pass (override for anything
beyond a redraw, calling `super` first): when the arity moves it re-anchors,
redraws and fires `portsChange$` **once**, even if both counts change; when it
does not it still redraws, since labels and body extent read option values too.
Options are read by name (`this.options.numInputs.value`), never by index —
`Component` is generic over a per-type interface (`AndOptions`, `NotOptions`, …).

Rotation is **not** an option: every component rotates, so `direction` is
first-class state alongside `position` and the negation sets, with its own
serialized field and a fixed direction row in the settings panel. Its setter
applies `rotation = value · π/2`, counter-rotates anything registered through
`registerRotationCounterContainer` (text labels, custom symbols), redraws, and
emits `portsChange$`. `Project` reacts to that by re-running `topology.integrate`
and the CP markers (see `project.md` and
[Wire Integration Invariants](wires.md#wire-integration-invariants)).

**Body re-anchoring.** The body is drawn from, and rotated around, the local
origin, so the `direction` setter and every arity change run through
`_withFixedBodyAnchor`, which holds the body's top-left corner fixed by shifting
`position` by the change in `bodyGridBounds`. Rotation therefore never moves a
component (E↔W / N↔S stay put) and added ports grow the body downward (E/W) or
rightward (S/N) instead of jumping. Group rotation is different — it pivots about
the selection midpoint, and `RotateComponentsAction` stores the direction _and_
the orbited position per entry.

Also worth knowing: `ignoresWireCollision` (only `TextComponent`; wires may pass
through), the per-side negation sets (out-of-range entries ignored on read and
pruned on serialize, so a resize stays undo-safe), `isInputHigh` (the display
components' read of an input, which a bubble inverts — see
[Simulation](simulation.md#units-and-links)), and `Component.serialize` /
`deserialize`, which store type, grid-unit position, direction (omitted when
East) and raw option values keyed by name.

### Build vs. rescale vs. restyle

The visual tree is rebuilt only on a **structural** change (construction,
direction, arity, option changes — all through `_draw()`). **Zoom** and **theme**
are handled in place, which keeps a wheel notch from re-rasterizing every
component and a theme toggle (or a dual-theme save preview) from rebuilding the
scene:

- `applyScale(scale)` runs the rescalers registered during the last `draw()`. The
  quad tree calls it only for components the viewport can see
  (`rendering.md` § Culling).
- `refreshTheme()` re-runs those rescalers — the shared `GraphicsContext` cache
  key includes the theme, so context-baked colors swap pointers — plus the
  restylers registered via `onApplyTheme`, then `refreshTint()`.

So in a `draw()`: register anything whose on-screen size must stay constant
across zoom via `onApplyScale` / `addBody` / `addScaledGraphics`, and **every
theme-color read** via `onApplyTheme`. `theme-restyle.spec.ts` asserts a restyle
matches a fresh build for every registered type, so a missed registration fails
the suite. Themed text is white `fill` plus `tint`: `fill` is baked into the
text's proxy context and rewriting it re-runs glyph layout. `BitmapText` labels
come from the pre-installed atlas and need no rescaler at all.

Registrations reset on each `draw()` and must be made from inside it. `redraw()`
forces a structural rebuild for bespoke state (`TextComponent` uses it for text
content and font size).

Instances are created with plain `new`, so `Component` reaches `ThemingService`
and `GraphicsProviderService` through `getStaticDI()`. A `symbol` override must
read a module-level config constant, not `this.config`: it is evaluated during
the base constructor's draw, before the subclass field exists.

## `ComponentOption<T>` and `ComponentMeta`

An option is an observable wrapper around one value: `value` (subclasses may
validate or clamp in the setter), `onChange$`, `label`, and `clone()`, which must
return a fully independent copy — the options on a `ComponentConfig` are
**templates**, cloned per instance and on deserialization. The concrete classes
live under `component-options/` beside their renderers; see
[`component-options.md`](component-options.md).

The pure half of each lives in the meta:

- `type`, `category`, `symbol`, `name`, `description`. The two translation keys
  are opaque `string`s in core; `meta-translation-keys.ts` collects their literal
  types and asserts the union against the translation schema, so a typo fails the
  editor's type check.
- `options: Record<string, OptionSchema>` — one schema per option kind
  (`number`, `select-button`, `select-dropdown`, `text`, `textarea`, `memory`)
  carrying its constraints and default. `validateOptionValue(schema, value)` is
  the single definition of a legal value, shared by the automation write path and
  the server.
- `ports(options)`, `labels(options)`, `body(options, direction)` — pure
  functions. The segment display is the only type whose body also reads
  `direction` (fixed upright width when turned).
- `legacyV0Slots` — frozen positional mapping to the v0 format; see
  [`persistence.md`](persistence.md).

`configFromMeta(meta, extras)` composes the editor's config around one: it
instantiates an option class per schema kind, and the caller supplies only what
the editor has — the `create` factory, the palette `symbolShape`, the inspector
`actions`, the `inspection`. A built-in's `<name>.config.ts` is therefore its meta
plus its factory, with **no** hand-written option list. Custom components have no
meta — their `CustomComponentDefinition` _is_ that data, and
`buildCustomComponentConfig` fills the same fields from it.

## `ComponentConfigView` / `ComponentConfig`

`ComponentConfigView` is the read-only side exposed as `Component.config`: the
meta's identity fields plus `options`, `defaultPorts`, and the editor-only
`symbolShape` / `actions` / `inspection` / `source` (`'server' | 'browser'`,
customs only). `name` and `description` are `LocalizableText` — a built-in's
`TranslationKey` or a custom's `{ literal }`. `defaultPorts` is read off the meta
or the definition rather than probed by constructing an instance.

`symbolShape` is SVG **path data** in an 18-unit box, carried only by types whose
canvas body is a drawn shape rather than their symbol text (LED, switch, button,
LED matrix, segment display), so a palette tile always previews what placing
yields. Path data rather than markup because it binds through `[attr.d]` —
Angular's sanitizer drops SVG from `[innerHTML]` outright.

`ComponentConfig` adds `create(options)`. A factory rather than a constructor
reference lets a config close over per-definition state, which is what lets one
`CustomComponent` class back every custom type (see
[`custom-components.md`](custom-components.md)).

## `ComponentProviderService`

Root-provided singleton holding a signal-backed `Map<number, ComponentConfig>`
seeded from `BUILT_IN_COMPONENTS`. It is keyed by numeric type id, **not** by the
closed `ComponentType` enum, so runtime-allocated custom configs
(`register` / `unregister`, ids ≥ `CUSTOM_TYPE_ID_BASE` = 1000) sit alongside
built-ins. The per-category lists (`basicComponents`, `advancedComponents`,
`ioComponents`, `userComponents`) are `computed` over the map, so the palette
tracks registrations. `HIDDEN` types (`TextComponent`) appear in none of them;
`PORT` (the INPUT/OUTPUT plugs) is shown only while editing a custom component.
Built-in ids mirror the old editor's `ElementTypeId`; the list is core's
`component-type.enum.ts`.

## Adding a new built-in

1. Add a value to `BuiltInComponentType` in `@logigator/core`.
2. Write `catalog/built-ins/<name>.meta.ts` as `as const satisfies
ComponentMeta<…>` and add it to `BUILT_IN_META`. Add the translation keys to
   the locale files and the `MetaKeys<typeof …>` arm in
   `meta-translation-keys.ts`.
3. Create `component-types/<name>/`: `<name>.config.ts` exporting the named
   options interface and `configFromMeta(<name>Meta, { create })`, and
   `<name>.component.ts` extending `Component<YourOptions>`, passing the meta to
   `super` and implementing `config` and `draw`.
4. Add the config to `BUILT_IN_COMPONENTS` in `component-provider.service.ts`.
