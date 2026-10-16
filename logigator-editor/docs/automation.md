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
await api.sim.step(2); // on the AND's input after one tick, its output after two
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

An `OptionDescriptor` is keyed by `kind`: `number` (`min`/`max`, integers),
`select` (`values`), `text` (`maxLength`, `forbiddenChars` as a regex source
string), `textarea` (`maxLength`), `memory` (base64 bit-packed blob),
`name-map` (a plain object of names keyed by `keys`, each at most `maxLength`
and free of `forbiddenChars`; a key left out or set to `''` keeps its default
name), `unknown`.
Both select schema kinds flatten to one `select` — button-versus-dropdown is a
rendering choice a driver has no use for. `hidden` marks system-managed options
(e.g. a plug's index).

### Reads

`getProject()` returns name/id/documentType/source, dirty flag, content bounds
(each element's drawn extent, a text label included), undo/redo availability,
the current `busy` reason, and all elements.
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

### Image

`renderImage({ multiplier, background?, region?, margin? })` resolves the
active circuit as a base64 PNG with its pixel size: the picture **File → Export
image** would download, rendered by the same `ImageExportService` path.
`multiplier` is output px per grid unit over the grid size, `background`
(default `true`) is the theme colour plus the dot grid rather than transparency,
`region` is a `FocusTarget` — a `GridRect`, `{ elementIds }` or `'content'`, the
default — and `margin` is the grid units kept around it. `getBounds(target)`
reads the grid rectangle a `FocusTarget` covers, which is how a caller composes
a region out of where elements are. It renders the live scene graph offscreen, so it
ignores the camera and the docked controls and includes a simulation's state as
it stands. A multiplier past the export's 8192 px cap is refused, not clamped.

### Simulation

`sim.enter()` compiles and boots the engine, resolving once it is up — or with
`state: 'inactive'` plus the `diagnostics` that blocked entry. It resolves
`'running'` rather than `'ready'` when the user's auto-start preference is on,
so read the returned `state`.

| call                          | does                                              |
| ----------------------------- | ------------------------------------------------- |
| `play()` / `pause()`          | run / hold the engine                             |
| `step(count?)`                | `count` ticks while paused (default 1)            |
| `stop()`                      | reset to tick 0, session stays up                 |
| `exit()`                      | leave simulation entirely, back to editing        |
| `status()`                    | state, mode, target/measured Hz, tick             |
| `setTarget(value, unit)`      | target speed; unit `'Hz' \| 'kHz' \| 'MHz'`       |
| `setInput(id, value, input?)` | drive a lever, button, pulse button or gamepad    |
| `type(id, text)`              | type a text into a keyboard                       |
| `setKey(id, key)`             | hold a keyboard key down, or `null` to let go     |
| `readPorts(ids?)`             | per-port powered booleans, `inputs` and `outputs` |

- `setInput` is **absolute**, and what that means follows from the input's
  `drive` alone, whatever its gesture: a `level` slot (lever, button) is set to
  `value` — one already there sends no engine frame, and a button is held by
  `true` until a `false` releases it; a `pulse` slot (pulse button) pulses on
  `true` and ignores `false`. Never read-then-toggle.
- `input` addresses one **slot** of the user input — output port `i` is slot
  `i`, output `i` of the input's one engine unit — by index or by one of the
  component's slot ids (`UserInput.slotIds`). It defaults to `0`, and a lever,
  button or pulse button has only that one. A gamepad has one slot per control, its slot ids
  being the control ids in port order (`up`, `down`, `left`, `right`, then
  whichever of `a`, `b`, `x`, `y`, `l`, `r`, `select`, `start` its options
  switch on), so a control's index moves with the options and its id does
  not. A custom button name (the
  `names` option, written like any other option through `setOption`) is never
  a slot address: names are free text and need not be unique. An address the
  component does not have is an error naming its valid indices and ids
  (`resolveInputSlot`).
- `value` is a boolean for the one addressed slot, or a **boolean array** that
  sets every slot at once, element `i` for slot `i` — `[true]` on a lever, and
  `[false]` on a pulse button the usual no-op. The array has exactly one
  element per slot and takes no `input`; either mistake is an error naming the
  slot count. It is validated whole before any slot is touched
  (`resolveInputWrites`, shared by `sim.` and `inspect.setInput`), then applied
  through the same absolute path as **one** input frame of the slots that
  change, so an unchanged slot sends nothing and every changed one lands on
  the same tick, paused or running. That is what lets the recipe above set a
  whole input in one `setInput` before its `step`.
- The engine applies an input frame on its next tick, so an input's own
  output port shows a write after **one** step, and a gate it feeds after
  two — the same one tick per stage as every other component.
- `setInput` writes a level as a state frame: written twice while paused, the
  circuit sees the last value and nothing in between. What a pointer does to a
  button is an event frame instead, each on the outputs for at least a tick
  before the next applies — so a button pressed and released while paused is
  high after the next step and low after the one after it. A pulse, from a
  pointer or from `setInput`, is always an event followed by the frame that
  ends it: high after the next step, low after the second.
- A **keyboard** is not a user input and `setInput` refuses it, naming `type`
  and `setKey`. Its calls build the frames its window sends, through the
  same `KeyboardComponent` methods, so both agree on the key held on `D`
  (`KeyboardComponent.heldKey`): a window key that automation let go of
  sends nothing on its keyup, and a key the window holds is one `setKey`
  already holds.
  - `type(id, text)` queues the text as taps, a press and a release per
    character, at the keyboard's timing
    ([simulation.md](simulation.md#run-controls-and-user-input)): each
    character is on `D` after the next step and the one after, `D` is 0
    for the two after that, so a character takes four steps while paused. It
    is **strict**, unlike a paste: printable ASCII, `\n`, `\t`, `\b`, `\x1b`
    and `\x7f` only, CRLF and CR reading as one `\n`, at most
    `KEYBOARD_TEXT_LIMIT` (10 000) characters. Any other character is an
    error naming it, its code point and its UTF-16 index in the text, and
    nothing is queued (`textToCodesStrict`, beside the paste's `textToCodes`
    in `ascii.ts`). It resolves once queued, not once typed.
  - `setKey(id, key)` presses the key for one such character — a no-op when
    that code is already on `D` — and `null` lets go — a no-op when no key
    holds it. A press is never merged, so `setKey('A')` then `setKey(null)`
    while paused shows `A` after the first and second steps, with `STB` high
    after the first, and `0` from the third.
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
component, the `kind`, the title as the window reads it (for a view opened
from a watch, that watch's levels lead it), the window `bounds` in viewport CSS
px (`null` in the compact sheet) and, for a watch, the breadcrumb `trail`. Then `list()`,
`close(id)`, `closeAll()`, and `setBounds(id, box)`, clamped to the board it
floats over and returning the box actually taken.

A **watch** is a second board: each breadcrumb level is a fresh copy of the
inner circuit, so its elements carry the copy's ids, not the placed instance's.
Its seven calls below all refuse a data inspection.

- `getElements(id, query?)` — the visible level's circuit.
- `activate(id, componentId)` — the watch's tap: drives an inner lever or
  pulse button, drills into a nested custom, or opens an inner component's own
  inspection. A user input a tap cannot operate is refused with an error
  naming `setInput`: a single-slot `hold` input, which a tap cannot hold, and
  a multi-slot input without an inspection, whose body cannot address a slot.
- `setInput(id, componentId, value, input?)` — `sim.setInput` for an inner user
  input of the visible level, with the same absolute semantics, values and slot
  address: a button is held by `true` until a `false` releases it, and a held
  one is also released when its level closes (breadcrumb navigation, the watch
  closing). Anything but a user input of that level is refused, a keyboard
  with an error naming `type` and `setKey`.
- `type(id, componentId, text)` / `setKey(id, componentId, key)` — `sim.type`
  and `sim.setKey` for an inner keyboard of the visible level, its frames
  reaching the copy's own unit. A key held here is let go of when its level
  closes, whoever pressed it.
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
