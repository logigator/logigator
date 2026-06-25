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
   └── userInputs (button/lever → index)   │          │ applyDelta / applyFull
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

- **Unit types** (`NOT`, `AND`, `BUTTON`, `LEVER`, `ROM`) are emitted as one
  `EmittedUnit` with its pins recorded as union-find node ids. `ROM` also
  carries an `ops` blob — its contents bit-packed by `rom-data.codec.ts`
  (`encodeRomOps`, over the generic `utils/packed-buffer.ts`) to the exact byte
  table the engine reads (LSB-first; bit `address × wordSize + k`).
  `ops` rides through node remapping and template flattening alongside the
  negation fields (`copyNegation`).
- **Custom components** (`type >= CUSTOM_TYPE_ID_BASE`) are flattened — see
  [Custom-component flattening](#custom-component-flattening).
- `TEXT` has no ports; top-level `INPUT`/`OUTPUT` plugs are inert decoration
  (no unit) but their nets are still mapped so their stubs light up.
- Anything else produces a blocking `unsupported` diagnostic.

After all expansion, classes referenced by ≥1 unit pin get **dense link ids**
assigned in emission order. Wire-only or plug-only classes get no link — they
stay permanently unpowered. The descriptor's `links` count and per-unit
`inputs`/`outputs` (link ids) go to the engine; `LinkRenderTargets[]` (wires +
ports per link) becomes the render mapping.

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

### Snapshots: delta encoding + buffer pooling

`sendSnapshot` asks the engine for a snapshot with a delta threshold
(`DELTA_THRESHOLD = 0.125`): below it, only changed link ids + their values are
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

The bridge applies snapshots directly and owns no frame scheduling: while
running, the `Project` ticker is already `'on'`; after a snapshot applied while
idle (a step, or the settle pull after pause), it calls the session's
`repaint()` hook, which pokes a single ticker frame.

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
  compiled artifacts, and returns to `SELECT`. Also bound to the `CANCEL`
  shortcut.

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

In `SIMULATION` mode `FloatingLayer` runs no drag sessions — its `pointerdown`
only hit-tests for button/lever components and emits them on `Project.userInput$`.
`SimulationService._onUserInput` reacts:

- **Lever** — toggles its visual state and forwards `INPUT_EVENT_CONT` (set and
  hold) with the new on/off value.
- **Button** — sets pressed, forwards `INPUT_EVENT_PULSE` (one-tick), and clears
  the pressed visual after `BUTTON_FLASH_MS`.

The board index sent to the engine comes from `CompiledBoard.userInputs`
(`Component.id` → board submission index).

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
   it on `Project.userInput$` from `FloatingLayer`'s simulation `pointerdown`
   branch.
4. Otherwise it emits as a plain unit; its pins map by `connectionPoints` order.
5. If the type takes engine `ops` (per-type parameters), encode them in
   `_opsFor`. `ROM` is the worked example: its `data` option holds a base64
   blob that `rom-data.codec.ts` turns into the engine's byte table.
