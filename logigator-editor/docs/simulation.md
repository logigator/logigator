# Simulation

The simulation subsystem turns the placed circuit into a runnable board, runs
it on a WebAssembly engine inside a Web Worker, and lights up the powered wires
and ports on the canvas. It owns its own work mode (`SIMULATION`) in which the
circuit is locked for editing.

The engine itself is the external [`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)
npm package (a separate repo, Rust → WASM via wasm-bindgen). This package only
_drives_ it.

## Directory Layout

```
src/app/simulation/
├── simulation.service.ts          # Facade: lifecycle, run controls, user input
├── compiler/
│   ├── net-extractor.ts           # Geometry → electrical nets (union-find)
│   ├── board-compiler.service.ts  # Circuit → BoardDescriptor + link→render mapping
│   ├── compiled-board.model.ts    # CompiledBoard / BoardDescriptor / LinkRenderTargets
│   ├── watch-index.ts             # Retained inner-circuit tables for watches
│   └── compile-error.ts           # CompileDiagnostic (blocking failures)
├── state/
│   └── link-state-applier.ts      # Link states → wire/port "powered" visuals
└── worker/
    ├── protocol.ts                # Typed main↔worker message contract + snapshot packing
    ├── simulation-worker.service.ts # Main-thread bridge: worker, request map, frame pull loop
    └── simulation.worker.ts       # Worker: owns the WASM engine, paces runs, emits snapshots
```

Every piece is rebuilt per session and discarded on exit — see
[Session lifecycle](#session-lifecycle).

---

## Pipeline Overview

```
Project (components + wires)
   │  BoardCompilerService.compile()
   ▼
CompiledBoard ── descriptor ─────────────► worker → WASM Simulation
   │            (links + units)                       │
   │                                                  │ snapshot (per frame, pulled)
   ├── mapping (link id → wires + ports) ──┐          ▼
   │                                       │   SimulationWorkerService
   └── userInputs (button/switch → index)   │          │ applyDelta / applyFull
                                           ▼          ▼
                                    LinkStateApplier → wire.setPowered / component.setPortPowered
```

Two products come out of compilation: the **descriptor** the engine simulates,
and the **mapping** that says which canvas wires/ports each link drives. The
engine never knows about canvas objects; the applier never knows about the
engine. They meet only through dense **link ids**.

---

## Compilation

`BoardCompilerService.compile(project)` is synchronous and registry-backed —
no store loading. It runs once per session (the circuit is locked while
simulating, so the live object references it captures stay valid).

### Net extraction

`net-extractor.ts` derives the **electrical nets** from geometry. The
wire-integration invariants guarantee connections only occur where terminations
coincide at a half-grid point, so extraction is a union-find over termination
points keyed `"x,y"` (the same keying as `ConnectionPointManager`):

1. Each wire unions its two endpoint keys — a wire is one node.
2. Each component port attaches to whatever class its point lands in; a
   component never unions its own ports.

Each resulting class is a `Net` carrying the `Wire`s and `NetPortRef`s on it.
The same extraction serves both the top-level `Project` and instantiated custom
snapshot bodies (`CircuitElements` is the minimal structural view both satisfy).

### Units and links

The compiler walks components sorted **by id** (quad-tree iteration order is not
stable; sorting makes the submission order — and with it `triggerInput` indices
and the engine's output layout — reproducible). For each component:

- **Unit types** (the gates, `DELAY`, `CLOCK`, the adders and flip-flops,
  `RNG`, `RAM`, decoder/encoder, mux/demux, `BUTTON`, `SWITCH`, `ROM` — the
  `UNIT_TYPES` set) are emitted as one `EmittedUnit` with its pins recorded as
  union-find node ids. Three types carry an `ops` blob: `ROM` (contents
  bit-packed by `rom-data.codec.ts` — `encodeRomOps`, over the generic
  `utils/packed-buffer.ts` — to the exact byte table the engine reads,
  LSB-first; bit `address × wordSize + k`), `CLOCK` (its period in ticks) and
  `MUX` (its select-line count). `ops` rides through node remapping and
  template flattening alongside the negation fields (`copyNegation`).
- **`LED_MATRIX`** emits a unit whose outputs (the LED cells) exist on no net:
  fresh nodes are synthesized per cell, and the top-level pass maps their
  links back onto the component as pseudo-ports past the input range
  (row-major), so the standard applier lights the cells. An inner matrix
  simulates but does not light up in a watch.
- **Custom components** (`type >= CUSTOM_TYPE_ID_BASE`) are flattened — see
  [Custom-component flattening](#custom-component-flattening).
- **`TUNNEL`** emits no unit: before emission, the nets of all tunnels sharing
  a label are unioned (`_unionTunnelNets`), scoped per compilation pass so a
  label never crosses a custom-component boundary.
- `TEXT` has no ports; top-level `INPUT`/`OUTPUT` plugs are inert decoration
  (no unit) but their nets are still mapped so their stubs light up. `LED` and
  `SEGMENT_DISPLAY` are displays: no unit either — they render the powered
  state of their input nets through the same mapping.
- Anything else produces a blocking `unsupported` diagnostic.

After all expansion, classes referenced by ≥1 unit pin get **dense link ids**
assigned in emission order. Wire-only or plug-only classes get no link — they
stay permanently unpowered. The descriptor's `links` count and per-unit
`inputs`/`outputs` (link ids) go to the engine; `LinkRenderTargets[]` (wires +
ports per link) becomes the render mapping.

### The watch index

Compilation always retains a `WatchIndex` (`CompiledBoard.watch`) so a live
view of any custom instance's inner circuit can open mid-simulation without a
recompile (a recompile would restart the engine). It is **integer tables
only** — render targets need live objects, and a watch creates those itself at
open time from a fresh `instantiateBody` run:

- **Per template** (cached with the compiled template, keyed by snapshot type
  id), all keyed by **element position in the body arrays** (deterministic
  across `instantiateBody` runs — the order contract is pinned by
  `persistence/circuit-builder.spec.ts`; live ids are session-assigned and are
  not): `wireNets` (wire index → template-local net id), `portNets` (component
  index → per-port local net id), `userInputs` (direct switch/button index →
  template-local unit index), and `children` (nested-custom index →
  `WatchChildBridge { typeId, netMap, unitBase }`). To make every wire
  addressable, template compression assigns local ids to **all** net classes —
  unit pins and plug bindings first (their ids feed emission and stay
  deterministic), then wire-only and child-internal classes.
- **Per top-level instance** (keyed by the placed component's id):
  `linkOfLocalNet` (local net id → global link id, `-1` = wire-only, never
  powered) and `unitBase` (offset of the instance's units in the descriptor).

`infoFor(path)` resolves a watch path — `"<componentId>"` descending by
`"/<bodyIndex>"` per nested level — by folding child bridges into the
top-level record (`linkOfLocalNet_child[n] = linkOfLocalNet_parent[netMap[n]]`,
unit bases add). Pure integer composition, memoized, safe to hold for the
session. `unitIndexFor(bodyIndex)` yields the global engine unit index of an
inner switch/button — what `triggerUnitInput` sends.

### Custom-component flattening

A custom instance is expanded by **template instantiation**:

- `_buildTemplate` compiles a definition's inlined snapshot circuit **once**,
  caching by snapshot type id (snapshots are frozen, so a cached template never
  invalidates for the session). It instantiates the body into live elements to
  get real port geometry (rotation included), net-extracts, then destroys them —
  the body is never added to a `Project`. The result records units with
  template-local net ids plus the plug bindings tying local nets to outer pins.
- `_instantiateTemplate` materializes a placed instance: a fresh global
  union-find node per local net, each plug-bound net unioned with the outer net
  at the matching instance pin. A plug wired straight to another plug thereby
  merges the two outer nets through the instance.

Nesting flattens recursively into one flat unit list. A definition that
(transitively) places itself is caught by `_templatesInProgress` and produces a
`recursive-definition` diagnostic.

### Diagnostics

`CompileDiagnostic`s are **blocking**: any diagnostic refuses entry into
simulation (a board with silently-dropped components would be semantically
wrong). Kinds: `unsupported`, `missing-circuit`, `recursive-definition`,
`plug-mismatch`. `SimulationService.enter()` joins their messages into a single
toast and stays in the previous mode.

---

## The Worker Bridge

`SimulationWorkerService` is the main-thread half; `simulation.worker.ts` is the
worker half. They speak the discriminated-union protocol in `protocol.ts`.

### Pull model with worker-side run loop

The engine runs **inside the worker** and the main thread **samples** it:

- **`continuous`** — the worker calls the engine's `runAsync()` and lets it run
  freely.
- **`target`** (fixed Hz) — the worker paces itself with a `setTimeout`
  `paceLoop`, running the ticks the wall clock says are due each interval.
  Each batch is bounded by **wall-clock time** (`PACE_BATCH_MS`), not tick
  count: a tick-count cap proportional to the target rate would let a high
  target block the worker for hundreds of ms in one synchronous `run`,
  starving the per-frame snapshot pull so the canvas froze. The `ms` bound
  returns control to the message pump after a few ms regardless of how many
  ticks ran, so inputs and snapshot requests interleave. When a batch is cut
  short by the budget (an unreachable target), the next runs back-to-back
  instead of idling. The pure decision lives in `pacing.ts`.
- **`sync`** — not a worker run mode at all: the engine idles and the bridge
  posts one `step` per rendered frame, capping the tick rate at the frame rate.

Independently, the bridge pulls **one snapshot per `requestAnimationFrame`**,
with at most one snapshot request in flight (`snapshotInFlight`). A slow worker
answers late rather than piling up a queue. Simulation rate and render rate are
fully decoupled.

`requestSnapshot()` additionally pulls one **forced-full** snapshot outside the
frame loop (the protocol's `full` flag makes the worker bypass the delta
threshold) — the seeding mechanism for a freshly-registered watch applier,
which would otherwise only accumulate future deltas over darkness. If a
snapshot is already in flight the full request carries over to the next one
instead of being dropped.

> The `SIMULATION_WORKER_FACTORY` and `FRAME_SCHEDULER` injection tokens exist
> so specs can substitute a message-level fake worker and drive frames
> deterministically (`src/testing/fake-simulation-worker.ts`).

### Request correlation

Every main→worker message carries a `reqId`. `_request()` returns a promise that
resolves on the worker's `ok` and rejects on a correlated `error`; the initial
WASM boot resolves on `ready` (reqId `0`). `_post()` sends fire-and-forget
messages (snapshot/status pulls, `triggerInput`, `returnBuffer`). An uncorrelated
`error` or a `worker.onerror` is fatal: `_fail()` rejects everything pending and
calls the session's `onError` hook so the owner tears down.

Fire-and-forget messages are **dropped until the session is ready** — the window
between spawning the worker and its `init` ack, during which the worker holds no
`Simulation`. The window is reachable from the UI: `enter()` switches to
SIMULATION mode, and with it the switch/button tap path, while the engine is
still booting. An input arriving then has no promise to fail, so the worker's
error would come back uncorrelated and take the session down — hence the gate on
this side, a matching drop in the worker for the three advisory message kinds,
and an `isReady()` guard in `_activate` so a dropped tap doesn't leave the
switch's visuals showing a state the engine never received. Inputs from that
window are dropped rather than queued: they have no tick to apply at. A
`requestSnapshot` is the exception — `wantFullSnapshot` survives the drop and is
reissued once `init` acks, so a watch registered during startup still gets
seeded.

Every fault the worker reports (a correlated rejection, an uncorrelated `_fail`,
a crashed worker, an engine that would not load) is also sent to error tracking
as a real `$exception` via `AnalyticsService.captureError`. These are all
internal invariant breaks, yet all of them are caught here and surfaced as a
toast, so none would otherwise reach `GlobalErrorHandler` — the only other
`$exception` source. `endSession()`'s rejections are deliberately excluded:
cancelling in-flight requests is how teardown works.

### Snapshots: delta encoding + buffer pooling

`sendSnapshot` asks the engine for a snapshot with a delta threshold
(`DELTA_THRESHOLD = 0.2`): below it, only changed link ids + their values are
sent; above it, a full packed bitset. The snapshot bytes **must** be copied out
of WASM linear memory immediately — a `SnapshotView` is valid only until the
next tick and memory growth detaches JS views (hence a fresh `Uint8Array` over
`memory.buffer` per snapshot).

The copy target is a **pooled** `ArrayBuffer` (`packSnapshot`), transferred to
the main thread and handed back via `returnBuffer` after applying
(`BUFFER_POOL_LIMIT = 4`) — no per-frame allocation churn.

### Reset semantics

The engine has no native reset. `stop` is implemented as destroy + rebuild from
the descriptor kept at `init`, restarting at tick 0.

---

## Applying State to the Canvas

`LinkStateApplier` is the hot path — **no Observables**. Built per session from
the top-level `LinkRenderTargets[]`, it tracks current per-link power so it only
touches links that actually changed:

- `applyDelta(ids, packedValues)` — bit `i` of `packedValues` is the new state
  of `ids[i]`.
- `applyFull(packedBits)` — link `l` is byte `l >> 3`, bit `l & 7`.
- `setLink` fans a change out to `wire.setPowered()` and
  `component.setPortPowered()` for every render target on that link.
- `reset()` drives everything unpowered.
- `isPowered(link)` / `consumeChanged()` — read-backs for watches: the switch
  pose sync and the per-frame "did anything I target change" dirty flag that
  drives on-demand watch re-renders.

Everything downstream of `setLink` renders powered state as **transform, tint
or alpha only** (wire/stub cross-axis scale, LED tint, bubble alpha) — PixiJS
patches those into the existing batches in place. Swapping a `GraphicsContext`,
toggling `visible`/`renderable` or redrawing children here instead would churn
the shared context's listener list (a linear scan per swap — quadratic across a
blinking board) _and_ flag the render group for a full instruction rebuild
every frame; that combination once dropped a circuit from 120 fps to 1 fps.
See the _Constant-Width Stroke_ section of `wires.md`.

The worker bridge only sees the `SnapshotApplier` interface
(`applyDelta`/`applyFull`). `SimulationService` hands it a **fan-out** wrapper:
the board applier first, then every watch applier registered via
`registerApplier()` (each a second `LinkStateApplier` over a sparse target
array sized to the full link count — only the watched circuit's links carry
targets). Registrations don't survive the session; `exit()` clears them.

The bridge applies snapshots directly and owns no frame scheduling: while
running, the `Project` ticker is already `'on'`; after a snapshot applied while
idle (a step, or the settle pull after pause), it calls the session's
`repaint()` hook, which pokes a single ticker frame.

After every applied snapshot the bridge also invokes the session's optional
`onFrame()` hook. `SimulationService` surfaces it as `frame$`, the pull signal
live inspections refresh on — see `docs/inspection.md`.

---

## `SimulationService` — the Facade

The single entry point the UI talks to (the tool bar injects it for the run
controls). All state is exposed as signals.

### Session lifecycle

```
inactive ──enter()──► starting ──worker ready──► ready ⇄ running
   ▲                                              │
   └──────────────────── exit() ──────────────────┘
```

- **`enter()`** — compiles the active project; on diagnostics, toasts and bails.
  Otherwise builds the `LinkStateApplier`, subscribes to `project.userInput$`,
  flips work mode to `SIMULATION` (locks editing), and boots the worker session.
  On worker failure it toasts and exits.
- **`exit()`** — ends the worker session, resets the applier, clears every
  component's sim visuals (`clearSimState`), stops the ticker, drops the
  compiled artifacts, and returns to `PAN`. Also bound to the `CANCEL`
  shortcut. The visual reset walks the live objects the mapping captured at
  compile time, so it runs inside a `try`/`finally`: one freed under the session
  throws there, and dropping the artifacts and the mode regardless keeps that a
  single failure instead of a mode stuck at `SIMULATION` with no worker behind
  it, which every retry re-enters and fails on again.

A session is additionally forced to exit when another project takes the main
slot (File → Open/New, a share clone, a logout reset): `PersistenceService`
destroys the outgoing project, which the compiled mapping addresses by live
object reference. `ProjectService.mainProjectReplaced$` fires synchronously
_before_ the swap so `exit()` still reaches the outgoing project's visuals and
ticker. The notification inverts the dependency: `SimulationService` cannot be
injected into `PersistenceService`, which it already reaches through
`ShortcutService` → `SaveCoordinatorService`.

A board-wide wire repair exits for the same reason — it destroys the `Wire`
instances the mapping holds — and reaches `exit()` through the `Injector`, that
same chain being what stops it from injecting the service (`wires.md` §
Board-wide repair).

Compiled artifacts (`_board`, `_applier`) live for exactly one session; editing
being locked in between is what keeps the mapping's live object references valid.

### Run controls

- `play()` / `pause()` — start/interrupt the run in the selected mode; pause
  keeps engine state for step/play.
- `step()` — one engine tick while paused.
- `stop()` — reset to tick 0 and clear all powered visuals.
- `toggleSyncMode()` / `toggleTargetMode()` / `setTargetHz()` — change the run
  mode or target rate; an active run is re-paced via `_restartIfRunning()`.

Run modes are `'sync' | 'continuous' | 'target'` (see
[the worker bridge](#pull-model-with-worker-side-run-loop)). Exposed signals:
`state`, `isReady`, `isRunning`, `mode`, `targetHz`, `measuredHz` (computed
main-thread from status-poll tick deltas), `tick`.

### User input

In `SIMULATION` mode the `SimulationTool` starts a `PanSession` (the
same one-finger / left-drag pan as `WorkMode.PAN`), but editing stays locked:
the session's tap callback — fired only when the press never crosses the pan
threshold — hit-tests for a button/switch under the cursor and emits it on
`Project.userInput$`. A drag pans instead of activating anything.
`SimulationService._onUserInput` reacts:

- **Switch** — toggles its visual state and forwards `INPUT_EVENT_CONT` (set and
  hold) with the new on/off value.
- **Button** — sets pressed, forwards `INPUT_EVENT_PULSE` (one-tick), and clears
  the pressed visual after `BUTTON_FLASH_MS`.

The board index sent to the engine comes from `CompiledBoard.userInputs`
(`Component.id` → board submission index).

Inner switches/buttons clicked in a **watch** go through
`triggerUnitInput(unitIndex, component, repaint)` instead: the unit index is
already resolved through the watch index (`infoFor(path).unitIndexFor(i)`),
`component` is the watch's fresh copy (its visuals toggle/flash), and
`repaint` re-blits the watch canvas. Both paths share `_activate`.

---

## Interactions With Other Systems

- **`work-mode/`** — `SIMULATION` is fenced: `setMode` throws if asked for it
  directly and is a no-op while active. `SimulationService` is the only doorway,
  via `WorkModeService.setSimulationMode()`. See `work-mode.md`.
- **`project/`** — ticker control (`triggerTicker`) and the `userInput$`
  channel. See `project.md`.
- **`components/` & `wires/`** — `setPortPowered` / `setPowered` /
  `clearSimState` are the rendering hooks the applier drives.
- **`components/custom/`** — `CustomComponentRegistry` supplies the snapshot
  circuits the compiler flattens. See `custom-components.md`.

---

## Adding Simulator Support for a Component Type

1. Implement the type in the `@logigator/sim` engine and bump the dependency.
2. Add its `BuiltInComponentType` id to `UNIT_TYPES` in
   `board-compiler.service.ts`.
3. If it is a user input, handle it in `SimulationService._onUserInput` and emit
   it on `Project.userInput$` from the `SimulationTool`'s tap handler
   branch.
4. Otherwise it emits as a plain unit; its pins map by `connectionPoints` order.
5. If the type takes engine `ops` (per-type parameters), encode them in
   `_opsFor`. `ROM` is the worked example: its `data` option holds a base64
   blob that `rom-data.codec.ts` turns into the engine's byte table.
