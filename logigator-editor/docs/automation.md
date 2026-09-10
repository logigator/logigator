# Automation API

`window.__logigator` — a semantic, JSON-based surface for driving the editor
from a script or an AI agent, through Playwright/CDP `evaluate` today and any
other transport later. It models **editor state**, not chrome: menus, dialogs
and drag gestures stay a driver's own business, while what the editor owns —
which tool is armed, which document is open, which inspection is up — is a call
here.

```
src/app/automation/
├── automation-api.model.ts    # The JSON contract (types) + LogigatorAutomationApi
├── automation-api.service.ts  # The facade: install(), reads, camera, sim, docs, settings
├── catalog.ts                 # Registry-derived catalog, read off each type's ComponentMeta
├── edit-ops.ts                # Edit-op schema, validation, integrate → commit
└── port-index.ts              # component → link-id reverse index for port reads
```

## Gating

The `AUTOMATION_API` esbuild define (`src/define.d.ts`) is true in
`development`, false in production, where the guard in `AppComponent` folds away
at build time and this module tree is **absent from the bundle** — which is why
the gate is a define rather than an `environment` flag, and why the guarded
`injector.get(AutomationApiService)` must stay inlined in the branch.
`install()` runs right after `setStaticDIInjector`: the facade builds model
objects that resolve dependencies through the static injector.

## Contract rules

- **JSON in, JSON out** — everything is structured-cloneable; elements are
  numeric project ids and no live editor object crosses the boundary.
- **Grid units everywhere**, bar the named [grid ↔ screen](#grid--screen) calls.
- **Element bodies reuse the persistence body** (`SerializedComponentBody` /
  `SerializedWireBody` plus `id`): what an agent reads is what it writes.
- **The active project is the target**, resolved per call, project or custom
  component alike. No `Project` is cached — an import destroys the old one.
- **The catalog is generated** from `ComponentProviderService.allComponents()`,
  so a runtime-loaded custom component appears on the next call.

## Driving the editor from an agent

```js
const api = window.__logigator; // Playwright: browser_evaluate
const and = api.describeCatalog().find((entry) => entry.symbol === '&');

const result = api.applyEdit([
  // one batch, one undo step
  {
    op: 'addComponent',
    type: and.type,
    pos: [4, 4],
    options: { numInputs: 2 }
  },
  { op: 'addWire', pos: [0, 4], direction: 0, length: 4 }
]);
if (!result.ok) throw new Error(JSON.stringify(result.errors));

const id = result.createdIds[0].componentId;
api.select({ elementIds: [id] }); // a real selection, as if drawn by hand
api.camera.focus({ elementIds: [id] });

await api.sim.enter(); // sim reads are async — this order is
api.sim.pause(); // the deterministic recipe
await api.sim.setInput(leverId, true);
await api.sim.step();
const [readout] = await api.sim.readPorts([id]);
```

## Surface

### Discovery

`version()` reports the contract version plus editor version/commit.
`describeCatalog()` lists every registered type — category, symbol, names, port
counts, `negatable`, option descriptors — by ascending type id. Shape data is read off each
config's `ComponentMeta` (`@logigator/core`), never probed from a throwaway
instance, so the reported constraints are the ones a document is validated
against; an adjustable type's port counts come from an option whose `number`
descriptor gives the span.

An `OptionDescriptor` is keyed by `kind`: `number` (`min`/`max`), `select`
(`values`), `text` (`maxLength`, `forbiddenChars` as a regex source string),
`textarea` (`maxLength`), `memory` (base64 bit-packed blob), `unknown`. Both
select schema kinds flatten to one `select` — button-versus-dropdown is a
rendering choice a driver has no use for. `hidden` marks system-managed options
(e.g. a plug's index).

### Reads

`getProject()` returns name/id/documentType/source, dirty flag, content bounds,
undo/redo availability, the current `busy` reason, and all elements.
`getElements(query)` filters by `componentIds` / `wireIds` / `bounds` (a
quad-tree range query) / `types`; naming ids of one kind restricts the read to
that kind.

### Edits

`applyEdit(ops)` commits the batch as **one** `ActionContainer` — Ctrl+Z reverts
agent work exactly like user work. `undo()` / `redo()` report whether they had
anything to do.

| op                           | payload                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `addComponent`               | `{ type, pos, direction?, options?, negInputs?, negOutputs? }` |
| `addWire`                    | `{ pos, direction, length }`                                   |
| `remove`                     | `{ componentIds?, wireIds? }`                                  |
| `moveComponent` / `moveWire` | `{ id, to }`                                                   |
| `rotateComponent`            | `{ id, direction }` — absolute facing, 0–3                     |
| `setOption`                  | `{ id, key, value }`                                           |
| `setPortNegation`            | `{ id, side, index, negated }`                                 |

`EditResult` is `{ ok: true, createdIds, integratedWires }` or
`{ ok: false, errors }`.

- **All-or-nothing.** Malformed ops return a per-op error list with nothing
  applied; an op failing against live state (collision, unknown id) rolls the
  batch back. Neither records a history entry.
- **Wire positions are integers** — the half-grid lattice offset is added
  internally, `moveWire`'s `to` included, so a body read back round-trips.
- **Topology integration runs per op**: a port landing on a wire's interior
  splits it, collinear wires merge, a removal re-merges a pair that lost its
  last third terminator. It belongs to the same undo step and is reported in
  `integratedWires` (requested removals are not).
- **Rotation moves the position** — the component turns around its footprint's
  pivot, so read the position back.
- **Option values are rejected, not clamped**, since the option model would
  silently clamp a number and strip forbidden characters: success means the
  value was stored verbatim.
- **A bubble is refused where the simulation would never see it** — the plugs,
  the tunnel and every placed custom component, the set the catalog reports as
  `negatable: false` and the wire tool offers no bubble on
  (`components/port-negation.ts` is the one rule both read). It covers
  `addComponent`'s `negInputs`/`negOutputs` as well as `setPortNegation`.
  _Clearing_ one is always accepted, so a board an older batch negated can be
  put right.

### Busy refusal

Mutations are refused while the editor holds project state mid-change:

| reason           | when                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `session-active` | a drag session is live (`actionManager.locked`), a still-floating paste or rotate group included |
| `simulation`     | the circuit is running — editing is locked                                                       |
| `no-project`     | no document is open                                                                              |

`applyEdit` reports it as a per-op error, `undo`/`redo` return `false`,
`importProject`/`newProject` throw. Reads and camera calls are always allowed,
and `getProject().busy` is how a caller sees the state. `select` is refused too
— it is an editing affordance, and a scissor cut mutates outright. A placement
is also refused when it would close a custom-component dependency cycle.

### Validation and persistence

`check()` compiles the active circuit and returns the `CompileDiagnostic`s that
would block simulation, without entering it. `exportProject()` returns the
native file JSON (a `.lgix` export's inner payload); `importProject(json)`
replaces the open document and persists it as a browser draft, like the UI's
file import; `newProject()` opens an empty draft.

### Simulation

`sim.enter()` compiles and boots the engine, resolving once it is up — or with
`state: 'inactive'` plus the `diagnostics` that blocked entry. It resolves
`'running'` rather than `'ready'` when the user's auto-start preference is on,
so read the returned `state`.

| call                     | does                                              |
| ------------------------ | ------------------------------------------------- |
| `play()` / `pause()`     | run / hold the engine                             |
| `step(count?)`           | `count` ticks while paused (default 1)            |
| `stop()`                 | reset to tick 0, session stays up                 |
| `exit()`                 | leave simulation entirely, back to editing        |
| `status()`               | state, mode, target/measured Hz, tick             |
| `setTarget(value, unit)` | target speed; unit `'Hz' \| 'kHz' \| 'MHz'`       |
| `setInput(id, value)`    | drive a lever/button                              |
| `readPorts(ids?)`        | per-port powered booleans, `inputs` and `outputs` |

- `setInput` is **absolute**: a lever already at `value` sends no engine event,
  a button pulses on `true` and ignores `false`. Never read-then-toggle.
- `step(count)` posts the ticks back to back and pulls **one** snapshot, so
  settling a circuit costs one round trip rather than one per tick.
- `readPorts` builds a component → link-id reverse index once per compiled board
  (`port-index.ts`) over the compiler's `LinkMapping`.
- **Read-after-write:** the engine applies an input at its next tick, so
  `setInput`, `step` and `readPorts` are async — each pulls a fresh full
  snapshot and resolves after it is applied. See the recipe above.

### Camera

Pointing the camera at what changed is part of the contract: agents work _with_
a watching user. No camera call is a history entry; all work during simulation.

- `getViewport()` — visible grid rect, zoom factor, screen size.
- `pan(delta)` (grid units; `+x` scrolls the view right), `setCenter(pos)`,
  `setZoom(factor, center?)` clamped to the editor's zoom ladder, plus
  `zoomIn` / `zoomOut` / `zoom100`.
- `focus(target, opts?)` — frames a `GridRect`, `{ elementIds }` or `'content'`
  and returns the resulting viewport; `paddingGrid` defaults to 2 and `maxZoom`
  to 1, so framing one gate does not fill the screen.

#### Grid ↔ screen

Grid units end here. A driver aiming at the board — a synthetic click, a
screenshot clip — needs the camera's mapping _and_ the canvas's page offset, so
both live here rather than being reimplemented outside. `camera.boardRect()` is
the board canvas's box in **viewport CSS px** (throws when no board is mounted);
`toScreen`/`toScreenRect` map grid → viewport CSS px, `toGrid`/`toGridRect`
invert them.

### Work mode

`getWorkMode()` / `setWorkMode(mode, opts?)` arm the board's tool without
matching a localized label. Modes are the `WorkMode` values verbatim: `pan`,
`wireTool`, `sel`, `selExact`, `erase`, `placeComp`. `placeComp` requires
`{ componentType }` and every other mode refuses one. `simulation` is read-only:
`getWorkMode` reports it, `setWorkMode` refuses it (that is `sim.enter()`) and
refuses any switch while a simulation runs.

Switching tools clears the live selection, and the board picks the mode up in an
effect — so `setWorkMode`, and the switch `select()` makes on its way in, flush
the pending view update before returning. A driver has no tick to wait on, and a
selection made before that effect ran would be wiped a frame later.

### Selecting a region

`select(region, opts?)` **is** the select tool: caught elements carry the
selection tint, the drawn rectangle persists as the grab rect, and the mode
switches to SELECT so the result is movable, rotatable and deletable like any
other. `clearSelection()` clears it, like clicking empty canvas.

- `{ bounds }` is the marquee; a zero-area rectangle behaves like a **click** —
  the single element under the point, no persistent rect.
- `{ elementIds }` selects those directly (unknown ids skipped), rect-ing their
  padded bounds the way a committed paste does.
- `{ cut: true }` scissors the marquee: wires crossing its edge are cut there
  and only the inside pieces join the selection. It registers a **provisional
  history entry** — one Ctrl+Z reverts it, the following move or delete folds it
  in, and `clearSelection()` retracts it so a cut nothing acted on leaves no
  trace. A cut needs an edge, so `{ elementIds }` refuses it.
- `{ rect: false }` selects without a persistent grab rect; grabbing then falls
  back to the elements' own bounds.

`SelectionState` is `{ componentIds, wireIds, rect, cut }`. Read `wireIds` after
a cut: the inside pieces are **new** wires with fresh ids.

### Inspection

The live views a tap opens while the simulation runs — the ROM data inspector
and the custom-component **watch**. Opening is refused outside simulation and
for a component whose config declares no inspection.

`inspect.open(componentId)` opens or focuses one and returns an
`InspectionInfo`: a session `id` (the handle every other call takes), the
component, the `kind`, the title, the window `bounds` in viewport CSS px (`null`
in the compact sheet) and, for a watch, the breadcrumb `trail`. Then `list()`,
`close(id)`, `closeAll()`, and `setBounds(id, box)`, clamped to the board it
floats over and returning the box actually taken.

A **watch** is a second board: each breadcrumb level is a fresh copy of the
inner circuit, so its elements carry the copy's ids, not the placed instance's.
Its four calls below all refuse a data inspection.

- `getElements(id, query?)` — the visible level's circuit.
- `activate(id, componentId)` — the watch's one gesture: drives an inner
  lever/button, drills into a nested custom, or opens an inner component's own
  inspection.
- `navigateTo(id, level)` — pops every level deeper than `level`.
- `camera.*` — `getViewport` / `pan` / `setCenter` / `setZoom` / `focus` against
  the visible level. A level fits its circuit once, when it first shows; a write
  here takes that turn instead of being overwritten on the next frame.

### Documents

`tabs.list()` is the tab strip: the pinned main project at index 0, then the
open component editors. `activate(index)` switches what every other call
targets; `close(index)` closes a component editor, and a dirty one needs
`{ discardChanges: true }` because the UI asks the user here and a driver has
nobody to ask. Both are refused during simulation, and the main tab cannot be
closed.

`library.list()` is the library the palette places from: the **masters**, not
the snapshots placed from them. `library.edit(type)` opens a master's circuit in
its own tab, taking a master's type id or a placed instance's — an instance
whose master is gone is restored into the browser library first.

### Editor settings

`settings.describe()` / `get()` / `set(patch)` cover theme, language and every
boolean preference, the boolean half enumerated from
`EditorSettingsService.settings` so a preference added later appears on its own.
Writes go through `ThemingService` / `TranslationService` / `EditorSetting`, so
they behave as if the user flipped the controls — user preferences, never
history entries. `set` validates the whole patch first: an unknown key or
unaccepted value throws and applies nothing.
