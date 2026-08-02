# Automation API

A programmatic interface for driving the editor from a script or an AI agent:
query the circuit, edit it, run the simulation, arm a tool, move the camera,
select regions for the watching user, open live inspections, switch documents,
and round-trip files — all through a semantic, JSON-based command surface
instead of pixel-level canvas interaction.

It models **editor state**, not chrome interaction: the menus, dialogs and drag
gestures stay a driver's own business (a DOM automation library's job), while
anything the editor itself owns — which tool is armed, which document is open,
which inspection is up — is a call here.

The facade is installed as `window.__logigator` and driven externally through
Playwright/CDP `evaluate`. It is **transport-agnostic**: an MCP server or a
WebSocket bridge can be added later without changing anything below.

## Directory Layout

```
src/app/automation/
├── automation-api.model.ts    # The JSON contract (types) + LogigatorAutomationApi
├── automation-api.service.ts  # The facade: install(), reads, camera, sim, docs, settings
├── catalog.ts                 # Registry-derived catalog + option-model reflection
├── edit-ops.ts                # Edit-op schema, validation, integrate → commit
└── port-index.ts              # component → link-id reverse index for port reads
```

## Gating

The `AUTOMATION_API` esbuild define — `true` in the `development` configuration,
`false` in production (the same pattern as `DEBUG_MENU`; see `src/define.d.ts`).
When false, the guard in `AppComponent` folds away at build time and this whole
module tree is **absent from the bundle**, not merely inert in it — the gate has
to be a define rather than an `environment` flag for that, and the guarded
`injector.get(AutomationApiService)` has to stay inlined inside the branch.

`AppComponent` calls `install()` immediately after `setStaticDIInjector`, because
the facade builds model objects (`Project`, `Component`) that resolve their
dependencies through the static injector.

## Contract rules

- **JSON in, JSON out.** Every argument and result is structured-cloneable, so
  `evaluate` transports them directly. No live editor object crosses the
  boundary; elements are addressed by their numeric project ids.
- **Grid units everywhere.** All coordinates are grid units. The camera
  namespace converts to screen px internally.
- **Element bodies reuse the persistence body.** `SerializedComponentBody` /
  `SerializedWireBody` with the element's `id` attached — the shape an agent
  reads back is the shape it writes.
- **The active project is the target**, resolved per call (`ProjectService`).
  It works the same whether a project or a custom component is open for edit,
  and the facade never caches a `Project` (an import replaces and destroys it).
- **The catalog is generated**, never hand-written: it walks
  `ComponentProviderService.allComponents()`, so a custom component loaded at
  runtime appears on the next call.

## Driving the editor from an agent

```js
// Playwright: browser_evaluate
const api = window.__logigator;

// 1. What can be placed?
const and = api.describeCatalog().find((entry) => entry.symbol === '&');

// 2. Build something — one batch, one undo step.
const result = api.applyEdit([
  {
    op: 'addComponent',
    type: and.type,
    pos: [4, 4],
    options: { numInputs: 2 }
  },
  { op: 'addWire', pos: [0, 4], direction: 0, length: 4 }
]);
if (!result.ok) throw new Error(JSON.stringify(result.errors));

// 3. Show the user what changed — a real selection, as if they had drawn it.
const id = result.createdIds[0].componentId;
api.select({ elementIds: [id] });
api.camera.focus({ elementIds: [id] });

// 4. Close the loop: simulate and read back.
await api.sim.enter();
api.sim.pause();
await api.sim.setInput(leverId, true);
await api.sim.step();
const [readout] = await api.sim.readPorts([id]);
```

## Surface

### Discovery

| call                | returns                                                    |
| ------------------- | ---------------------------------------------------------- |
| `version()`         | API contract version + editor version/commit               |
| `describeCatalog()` | every registered type: ports, category, option descriptors |

An `OptionDescriptor` carries the constraints a write must respect, keyed by
`kind`: `number` (`min`/`max`), `select` (`values`), `text` (`maxLength`,
`forbiddenChars` as a regex source string), `textarea`, `memory` (a base64
bit-packed blob), `unknown`. `hidden` marks options the inspector does not show
(system-managed, e.g. a plug's index).

Port counts come from probing a default instance — they are a constructor
argument of each component subclass, not config data. Adjustable types drive
them from an option, whose `number` descriptor carries the allowed span.

### Reads

`getProject()` returns the document's name/id/type/source, dirty flag, content
bounds, undo/redo availability, the current `busy` reason, and all elements.
`getElements(query)` is the filtered read: `componentIds` / `wireIds` /
`bounds` (a quad-tree range query) / `types`. Naming ids of one kind restricts
the read to that kind.

### Edits

`applyEdit(ops)` commits the whole batch as **one** `ActionContainer` — Ctrl+Z
reverts agent work exactly like user work.

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
`{ ok: false, errors }`. Semantics worth knowing:

- **All-or-nothing.** Malformed ops come back as a complete per-op error list
  with nothing applied. Ops that only fail against live state (a collision, an
  unknown id) fail at that op, and everything already applied in the batch is
  rolled back — no history entry is recorded either way.
- **Wire positions are integers.** A wire body stores its start on the integer
  grid; the editor's half-grid lattice offset is added internally. `moveWire`'s
  `to` follows the same convention, so a body read back round-trips.
- **Wire integration runs per op.** Adding a component whose port lands on a
  wire's interior splits that wire; two collinear wires drawn as one span merge.
  The resulting adds/removes are part of the same undo step and are reported in
  `integratedWires`.
- **Rotation moves the position.** A component's `direction` setter re-anchors
  it, and `rotateComponent` turns the component around its own footprint's pivot
  (like a single-element selection rotate). Read the position back rather than
  assuming it is unchanged.
- **Removals do not merge.** Deleting an element leaves the surrounding wires
  as they are — the same behavior as the eraser and the Delete key.
- **Option values are rejected, not clamped.** The option model would silently
  clamp an out-of-range number and strip forbidden characters; a `setOption` (or
  an `addComponent`'s `options`) outside the declared constraints is refused
  instead, so a reported success always means the value was stored verbatim.

`undo()` / `redo()` return whether they had anything to do.

### Busy refusal

Mutations are refused while the editor holds project state mid-change:

| reason           | when                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `session-active` | a drag session is live (`actionManager.locked`), including a paste or rotate group still floating before its first grab |
| `simulation`     | the circuit is running — editing is locked                                                                              |
| `no-project`     | no document is open                                                                                                     |

`applyEdit` reports this as a per-op error; `undo`/`redo` return `false`;
`importProject` / `newProject` throw. Reads (`getProject`, `getElements`,
`check`, `exportProject`) and camera operations are always allowed —
`getProject().busy` is how a caller sees the state. `select` is refused too: it
is an editing affordance, and a scissor cut mutates outright.

A placement is also refused when it would close a custom-component dependency
cycle (placing a master into the editor for a master it feeds), the same guard
the palette applies by hiding those masters.

### Validation

`check()` compiles the active circuit and returns the `CompileDiagnostic`s that
would block simulation, without entering it.

### Persistence

`exportProject()` returns the current native file JSON (the inner payload of a
`.lgix` export). `importProject(json)` replaces the open document and persists
it as a browser draft, exactly like the file import in the UI.
`newProject()` opens an empty draft.

### Simulation

`sim.enter()` compiles and boots the engine, resolving once it is ready — or
with `state: 'inactive'` plus the `diagnostics` that blocked entry, so an agent
sees _why_. It resolves `'running'` rather than `'ready'` when the user's
auto-start-simulation preference is on (the default), so read the returned
`state` instead of assuming a paused session. Then `play` / `pause` / `step` /
`stop` / `status` / `setTarget(value, unit)`.

`sim.setInput(componentId, value)` is **absolute**: a lever already at `value`
sends no further engine event, a button pulses on `true` and ignores `false`.
Agents never have to read-then-toggle.

`sim.readPorts(ids?)` returns per-port powered booleans, split into `inputs` and
`outputs`. It builds a component → link-id reverse index once per compiled board
(`port-index.ts`) over the compiler's `LinkMapping`.

`sim.step(count?)` runs `count` ticks (default 1) and resolves once the state
after the **last** one has been applied — the ticks are posted back to back and
only one snapshot is pulled, so running a circuit to a settled state costs one
round trip rather than one per tick.

**Read-after-write:** engine state reaches the canvas one snapshot at a time, so
`setInput`, `step` and `readPorts` are async — each pulls a fresh full snapshot
and resolves after it has been applied. The engine applies an input at its next
tick, so the deterministic recipe is:

```js
api.sim.pause();
await api.sim.setInput(leverId, true);
await api.sim.step();
const readouts = await api.sim.readPorts();
```

### Camera

Pointing the camera at what changed is part of the contract, not a convenience:
agents work _with_ a watching user.

- `camera.getViewport()` — visible grid rect, zoom factor, screen size.
- `camera.pan(delta)` — grid units; `+x` scrolls the view right.
- `camera.setCenter(pos)`, `camera.setZoom(factor, center?)` (clamped to the
  editor's zoom ladder), `zoomIn` / `zoomOut` / `zoom100`.
- `camera.focus(target, opts?)` — frames a `Rect`, `{ elementIds }`, or
  `'content'`; `paddingGrid` defaults to 2 and `maxZoom` to 1 so framing one gate
  does not fill the screen. Returns the resulting viewport.

No camera operation is ever a history entry, and all of them work during
simulation.

#### Grid ↔ screen

The one place the contract leaves grid units. A driver that wants to point at
the board — a synthetic click, a screenshot clip — needs the camera's mapping
_and_ the canvas's page offset; both live here so nobody reimplements the
transform outside the editor.

- `camera.boardRect()` — the board canvas's box in **viewport CSS px**. Throws
  when no board is mounted.
- `camera.toScreen(point)` / `camera.toScreenRect(rect)` — grid → viewport CSS px.
- `camera.toGrid(point)` / `camera.toGridRect(rect)` — the inverse.

### Work mode

`getWorkMode()` / `setWorkMode(mode, opts?)` arm the board's tool — the tool bar's
buttons, without matching a localized label. Which tool is active decides what a
pointer gesture does and what floating chrome (the scissor pill, the placement
ghost) is on screen.

The modes are the `WorkMode` values verbatim: `pan`, `wireTool`, `sel`,
`selExact`, `erase`, `placeComp`. `placeComp` needs `{ componentType }` (a
catalog type id) and every other mode refuses one. `simulation` is read-only —
`getWorkMode` reports it, `setWorkMode` refuses it (that is `sim.enter()`), and
so is any switch while a simulation runs.

Switching tools **clears the live selection** (the board's own behaviour), and
the board picks the mode up in an effect. So `setWorkMode` — and the switch
`select()` makes on its way in — flushes the pending view update before
returning: a driver has no tick of its own to wait for, and a selection made
before that effect ran would be wiped by it a frame later.

### Selecting a region

`select(region, opts?)` **is** the select tool: it does exactly what a user
picking select and dragging a marquee over the region does. The caught elements
carry the selection tint, the drawn rectangle persists as the grab rect, and the
selection is then movable, rotatable and deletable like any other — the work mode
switches to SELECT so it is grabbable. Pair it with `camera.focus` to show the
user what changed.

- `{ bounds }` is the marquee. A zero-area rectangle behaves like a **click**:
  the single element under the point, and no persistent rect.
- `{ elementIds }` selects those elements directly (unknown ids are skipped),
  rect-ing their padded bounds the way a committed paste does.
- `{ cut: true }` scissors the marquee, the held-scissor-key gesture: wires
  crossing the rectangle's edge are cut there and only the inside pieces join the
  selection. It registers a **provisional history entry** — one Ctrl+Z reverts
  it, the following move or delete folds it into itself, and
  `clearSelection()` retracts it so a cut nothing acted on leaves no trace.
  `cut` needs an edge, so it is refused for an `{ elementIds }` region.

The returned `SelectionState` is `{ componentIds, wireIds, rect, cut }`. Read
`wireIds` after a cut: the inside pieces are **new** wires with fresh ids.

`clearSelection()` clears the selection, like clicking empty canvas.

`{ rect: false }` selects without a persistent grab rect, the way a single click
does — for a selection that must not draw a marquee over what it is pointing at.
Grabbing then falls back to the elements' own bounds.

Selecting is refused while the editor is busy — it is an editing affordance, and
the select tool does not exist during simulation.

### Inspection

The live views a tap on a component opens while the simulation runs — the ROM
data inspector and the custom-component **watch**. `inspect.open(componentId)`
opens (or focuses) one and returns an `InspectionInfo`: a session `id` (the
handle every other call takes), the inspected component, the `kind`, the title,
the window `bounds` in viewport CSS px (`null` in the compact sheet), and — for a
watch — the breadcrumb `trail`. `list()`, `close(id)` and `closeAll()` round it
out; `setBounds(id, box)` places the hosting window, clamped to the board it
floats over, and returns the box actually taken.

Opening is refused outside simulation, and for a component whose config declares
no inspection.

A **watch** is a second board: each breadcrumb level is a fresh copy of the inner
circuit, so its elements carry the copy's ids, not the placed instance's.

- `inspect.getElements(id, query?)` — the visible level's circuit.
- `inspect.activate(id, componentId)` — the watch's one gesture: drives an inner
  lever/button, drills into a nested custom (pushing a level), or opens an inner
  component's own inspection.
- `inspect.navigateTo(id, level)` — pops every level deeper than `level`.
- `inspect.camera.*` — `getViewport` / `pan` / `setCenter` / `setZoom` / `focus`,
  the board's camera operations against the visible level. A level fits its
  circuit once, when it first shows; a write here takes that turn instead of
  being overwritten by it on the next frame.

All five of the watch-only calls refuse a data inspection.

### Documents

`tabs.list()` is the tab strip: the pinned main project at index 0, then the open
component editors. `tabs.activate(index)` switches what every other call targets;
`tabs.close(index)` closes a component editor — a dirty one needs
`{ discardChanges: true }`, since the UI asks the user at this point and a driver
has nobody to ask. Both are refused while a simulation runs (it binds to the
active project), and the main project's tab cannot be closed.

`library.list()` is the custom-component library the palette places from: the
**masters**, not the frozen snapshots placed from them. `library.edit(type)`
opens a master's circuit in its own tab, taking either a master's type id or a
placed instance's — an instance whose master is gone (its circuit only embedded)
is restored into the browser library first, which is exactly what the settings
card's Edit / Restore & edit button does.

### Editor settings

`settings.describe()` / `get()` / `set(patch)` cover the theme, the language,
and every boolean preference. The boolean half is enumerated from
`EditorSettingsService.settings`, so a preference added later appears on its
own. Writes go through `ThemingService` / `TranslationService` /
`EditorSetting`, so persistence and reactivity behave exactly as if the user had
flipped the controls — these are user-preference mutations, never history
entries. `set` validates the whole patch first: an unknown key or an unaccepted
value throws and applies nothing.

## Deferred

- **Screenshots** — `BoardSnapshotService.renderProjectToCanvas` → PNG data URL.
- **MCP server + WebSocket bridge** — the same facade as typed MCP tools; the
  contract is designed so this is purely additive transport.
- **Preview-before-commit mode** — routing a batch into a proposal-preview
  session for untrusted callers, instead of committing directly.
