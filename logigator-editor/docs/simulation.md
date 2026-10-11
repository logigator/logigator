# Simulation

Turns the placed circuit into a runnable board, runs it on the external
[`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim) WebAssembly
engine inside a Web Worker, and lights up the powered wires and ports. Owns the
`SIMULATION` work mode, in which the circuit is locked for editing.

```
Project ──compile()──► CompiledBoard ─descriptor─► worker → WASM engine
                          │                                    │ snapshot (pulled per frame)
                          ├─ mapping (link id → wires + ports) ─┴─► SimulationWorkerService
                          └─ userInputs (input → first unit)           │ applyDelta / applyFull
                                                                       ▼
                                                                LinkStateApplier
```

Compilation yields the **descriptor** the engine simulates and the **mapping**
saying which canvas wires and ports each link drives. The engine never sees
canvas objects and the applier never sees the engine; they meet only through
dense **link ids**. Everything is rebuilt per session and discarded on exit —
see [Session lifecycle](#session-lifecycle).

---

## Compilation

`BoardCompilerService.compile(project)` is synchronous and registry-backed (no
store loading). It runs once per session: editing is locked while simulating, so
the live object references it captures stay valid.

### Net extraction

The wire invariants guarantee connections occur only where terminations coincide
at a half-grid point, so `extractNets` is a union-find over termination points
keyed `"x,y"`: each wire unions its two endpoints, each port joins whatever
class its point lands in, and no component unions its own ports.
`CircuitElements` is the minimal structural view, so one extraction serves both
the live `Project` and instantiated snapshot bodies.

### Units and links

Components are walked **sorted by id**: quad-tree order is not stable, and the
submission order defines the engine's `triggerInput` indices and output layout.

- **`UNIT_TYPES`** (gates, `DELAY`, `CLOCK`, adders, flip-flops, `RNG`, `RAM`,
  coder/decoder, mux/demux, `ROM`) — one `EmittedUnit`, pins as union-find node
  ids.
- **User inputs** — any component implementing `UserInput`
  (`components/user-input.ts`; `BUTTON`, `PULSE_BUTTON`, `SWITCH`), recognised
  by the `isUserInput` guard rather than by type id — one
  `ENGINE_USER_INPUT_TYPE` (200) unit **per slot**, one output each,
  contiguously in slot order (`_emitUserInput`). Slot `i` is output port `i` —
  a type whose `inputSlots` differs from its output count is refused with an
  error — and `userInputs` records the first unit, so slot `i` is that index
  plus `i`. A bubble on port `i` becomes `negOutputs: [0]` on unit `i`. Every
  built-in user input has one slot, so one unit.
- **`LED_MATRIX`** — a unit whose cell outputs sit on no net: fresh nodes per
  cell, mapped back onto the component as pseudo-ports past the input range
  (row-major). An inner matrix simulates but stays dark in a watch.
- **Custom** (`type >= CUSTOM_TYPE_ID_BASE`) — flattened by template
  instantiation.
- **`TUNNEL`** — no unit; tunnels sharing a label are net-unioned before
  emission, once per pass, so a label never leaves its circuit.
- **`TEXT`, `INPUT`/`OUTPUT` plugs, `LED`, `SEGMENT_DISPLAY`** — no unit, but
  their nets are mapped, so stubs and displays show power. A bubble on a
  display's input never reaches the engine, so `LedComponent` and
  `SegmentDisplayComponent` invert it themselves, reading their inputs through
  `Component.isInputHigh`. That only inverts inside a session
  (`Component.setSimulating`, entered and left for every component in
  `SimulationService`): the engine reports a link that never changes, and at
  rest the board shows nothing powered. The stub keeps showing the net's own
  state, as a gate's negated input does. Plugs and tunnels take no bubble at
  all: `acceptsPortNegation` (`components/port-negation.ts`) is the one rule
  the wire tool and the automation API both refuse by, an existing bubble
  staying removable through either.
- Anything else — a blocking `unsupported` diagnostic.

Four types carry an engine `ops` blob (`_opsFor`): `ROM` (contents bit-packed by
`rom-data.codec.ts` to the byte table the engine reads, LSB-first, bit
`address × wordSize + k`), `CLOCK` (period in ticks), `MUX` (select lines) and
`LED_MATRIX` (data-bus width). `ops` and the negation index arrays survive node
remapping and flattening unchanged (`copyNegation`): remapping changes pin
_values_, never pin _order_.

Afterwards, classes referenced by ≥1 unit pin get **dense link ids** in emission
order; wire-only and plug-only classes get none and stay permanently unpowered.

Every `CompileDiagnostic` is **blocking** (`unsupported`, `missing-circuit`,
`recursive-definition`, `plug-mismatch`): a board with silently dropped
components would be semantically wrong.

### Custom-component flattening

`_buildTemplate` compiles a definition's inlined snapshot circuit **once**,
cached by snapshot type id (snapshots are frozen, so a cached template never
invalidates). It instantiates the body into live elements for real port geometry
including rotation, net-extracts, then destroys them — the body never enters a
`Project`. `_instantiateTemplate` then materializes a placed instance: a fresh
global node per template-local net, each plug-bound net unioned with the outer
net at the matching pin, so a plug wired straight to another plug merges two
outer nets through the instance. Nesting flattens recursively into one flat unit
list, and `_templatesInProgress` catches a definition that transitively places
itself.

### The watch index

Compilation always retains a `WatchIndex` so a live view of an inner circuit can
open mid-session; recompiling would restart the engine. It holds **integer
tables only** — render targets need live objects, and a watch builds its own at
open time from a fresh `instantiateBody` run.

Per-template tables (`wireNets`, `portNets`, `userInputs`, `children`) are keyed
by **element position in the body arrays**, `userInputs` holding each input's
first unit as the top-level map does, deterministic across
`instantiateBody` runs where live ids are session-assigned. Template compression
gives **every** net class a local id so every wire is addressable: unit pins and
plug bindings first, since their ids feed emission and must stay deterministic,
then the wire-only and child-internal classes. Each top-level instance adds
`linkOfLocalNet` (`-1` = wire-only, never powered) and `unitBase`.
`infoFor(path)` resolves `"<componentId>[/<bodyIndex>]…"` by folding child
bridges into that record (`linkOfLocalNet_child[n] =
linkOfLocalNet_parent[netMap[n]]`, unit bases add) — pure integer composition,
memoized, safe to hold for the session.

---

## The worker bridge

`SimulationWorkerService` (main thread) and `simulation.worker.ts` speak the
discriminated-union protocol in `protocol.ts`. `SIMULATION_WORKER_FACTORY` and
`FRAME_SCHEDULER` are injectable so specs can substitute a message-level fake
worker and drive frames deterministically.

### Pull model with worker-side run loop

The engine runs inside the worker; the main thread **samples** it.

- **`continuous`** — the worker calls `runAsync()` and lets the engine run free.
- **`target`** (fixed Hz) — a `setTimeout` loop runs the ticks the wall clock
  says are due. Batches are bounded by **wall-clock time** (`PACE_BATCH_MS`),
  not tick count: a tick-count cap proportional to the target would block the
  worker for hundreds of ms in one synchronous `run`, starving the snapshot pull
  and freezing the canvas. A batch cut short by the budget means an unreachable
  target, so the next runs back-to-back instead of idling. The pure decisions
  live in `pacing.ts`.
- **`sync`** — not a worker mode: the engine idles and the bridge posts one
  `step` per rendered frame, capping the tick rate at the frame rate.

Independently the bridge pulls **one snapshot per `requestAnimationFrame`**, at
most one in flight, so a slow worker answers late rather than piling up a queue.
Simulation rate and render rate are fully decoupled.
`SimulationService.requestSnapshot()` pulls one **forced-full** snapshot outside
the frame loop, seeding a freshly registered watch applier that would otherwise
accumulate future deltas over darkness.

### Request correlation

Every main→worker message carries a `reqId`: `_request()` resolves on the
worker's `ok` and rejects on the correlated `error`, while `_post()` is
fire-and-forget. An uncorrelated `error`, an unreadable message or a
`worker.onerror` is fatal — `_fail()` rejects everything pending and calls the
session's `onError` hook.

Fire-and-forget messages are **dropped until the session is ready** — the window
between spawning the worker and its `init` ack, in which the worker holds no
`Simulation`. The window is reachable from the UI, since `enter()` switches to
SIMULATION mode (and with it the tap path) while the engine is still booting. An
input arriving then has no promise to fail, so the worker's error would come
back uncorrelated and kill a session that was about to work. Hence the gate
here, a matching drop in the worker for the three advisory kinds, and the
`isReady()` guard in `_setLevel` and `_pulse` so a dropped input cannot leave a
slot showing a state the engine never received. Such inputs are dropped rather than queued:
they have no tick to apply at. `requestSnapshot` is the exception —
`wantFullSnapshot` survives the drop and is reissued once `init` acks.

Worker faults also reach error tracking as real `$exception`s: they are internal
invariant breaks, but all of them are caught here and shown as toasts, so none
would otherwise reach `GlobalErrorHandler`. `endSession()`'s rejections are
excluded — cancelling in-flight requests is how teardown works.

### Snapshots

The engine is asked for a snapshot with a delta threshold
(`DELTA_THRESHOLD = 0.2`): below it, changed link ids plus their values; above
it, a full packed bitset. The bytes **must** be copied out of WASM memory
immediately — a `SnapshotView` is valid only until the next tick, and memory
growth detaches JS views, hence a fresh `Uint8Array` over `memory.buffer` per
snapshot. The copy target is a pooled `ArrayBuffer` (`packSnapshot`, ids first so
the `u32` view stays aligned), transferred to the main thread and handed back
via `returnBuffer` after applying.

An **empty delta** means nothing changed and is skipped; falling through to
`applyFull` would read an empty buffer and clear every link. The engine has no
reset, so `stop` is destroy + rebuild from the descriptor kept at `init`.

---

## Applying state to the canvas

`LinkStateApplier` is the hot path — **no Observables**. Built per session from
the top-level `LinkRenderTargets[]`, it tracks per-link power so it only touches
links that changed, fanning each change out to `wire.setPowered()` and
`component.setPortPowered()`. `isPowered(link)` and `consumeChanged()` are the
watch read-backs: switch pose sync and the per-frame dirty flag driving
on-demand watch re-renders.

Everything downstream of `setLink` renders powered state as **transform, tint or
alpha only** (wire and stub cross-axis scale, LED tint, bubble alpha), which
PixiJS patches into existing batches. A context swap, a `visible` toggle or a
child redraw here would churn the shared context's listener list (a linear scan
per swap, quadratic across a blinking board) _and_ force a full instruction
rebuild every frame; that combination once dropped a circuit from 120 fps to
1 fps. See `wires.md` § _Constant-Width Stroke_.

The bridge only sees the `SnapshotApplier` interface. `SimulationService` hands
it a **fan-out** wrapper: the board applier first, then every watch applier
registered via `registerApplier()` — each a second `LinkStateApplier` over a
sparse target array sized to the full link count, so only the watched circuit's
links carry targets. Registrations do not survive the session.

The bridge owns no frame scheduling: while running the `Project` ticker is
already `'on'`, and a snapshot applied while idle (a step, or the settle pull
after pause) calls `repaint()` for one ticker frame. Each applied snapshot also
invokes `onFrame()`, surfaced as `frame$` — the pull signal live inspections
refresh on.

---

## `SimulationService` — the facade

The entry point the UI talks to, with all state exposed as signals.

### Session lifecycle

```
inactive ──enter()──► starting ──worker ready──► ready ⇄ running
   ▲                                              │
   └──────────────────── exit() ──────────────────┘
```

`enter()` switches to the main project (simulation never runs a
custom-component tab), compiles it, then builds the applier, subscribes to
`project.userInput$`, flips the work mode to `SIMULATION` and boots the worker
session. It resolves with the diagnostics that blocked entry — empty on success,
toasted by `enter()` itself, read by the automation API. A worker that fails to
boot toasts and exits. `exit()` ends the session, resets the applier and every
component's sim visuals, stops the ticker, drops the compiled artifacts and
returns to `PAN`; the `CANCEL` shortcut runs it too. The visual reset walks the
live objects the mapping captured at compile time, so it runs inside a
`try`/`finally`: one freed under the session throws there, and dropping the
artifacts and the mode regardless keeps that a single failure instead of a mode
stuck at `SIMULATION` with no worker behind it, which every retry re-enters and
fails on again.

A session is also forced to exit when another project takes the main slot: the
compiled mapping addresses the outgoing project by live object reference, and
`PersistenceService` destroys it. `ProjectService.mainProjectReplaced$` fires
synchronously _before_ the swap, so `exit()` still reaches that project's
visuals and ticker. The notification inverts a dependency `SimulationService`
cannot have, since `PersistenceService` already reaches it through
`ShortcutService` → `SaveCoordinatorService`.

A board-wide wire repair exits for the same reason — it destroys the `Wire`
instances the mapping holds — and reaches `exit()` through the `Injector`, that
same chain being what stops it from injecting the service (`wires.md` §
Board-wide repair).

Compiled artifacts (`_board`, `_applier`) live for exactly one session; editing
being locked in between is what keeps the mapping's live object references valid.

### Run controls and user input

`play()` / `pause()` / `step()` / `stop()`, plus `setMode` and `setTargetHz`.
Setting a rate also selects `target` mode — entering a speed is asking for it —
and the floor is `MIN_TARGET_HZ` (0.1 Hz, in `pacing.ts`, which the worker
clamps to as well). A mode or rate change re-paces an active run, and resets the
measured rate, since a sample taken under the old pacing says nothing about the
new one. `clockHalfPeriods` lists the distinct clock half-periods of the
session's flattened board, which is what lets the speed popover
(`ui/simulation-controls/`) turn a tick rate into the frequency each clock runs
at; the popover's slider stops, speed parsing and formatting are the pure
`sim-speed.ts` beside it.

Every user input is a **`UserInput`** (`components/user-input.ts`, see
[component-system.md](component-system.md)), and the service knows it by that
interface alone, never by class. It has **slots**, one per output port and
engine unit (see [Units and links](#units-and-links)); the button, switch and
pulse button have the one slot `0`, the gamepad one per control. Two independent properties describe it:

- **`drive`** — what the engine receives, and the service's only two
  operations. `level` (button, switch): `_setLevel` sends `INPUT_EVENT_CONT`
  with the slot's new state, which latches until the next one; it is
  idempotent per slot — a slot already there sends nothing. `pulse` (pulse
  button): `_pulse` sends `INPUT_EVENT_PULSE` (one tick) and flashes the slot
  active for `PULSE_BUTTON_FLASH_MS`. Setting a level high and pulsing obey
  the readiness rule; setting a level low always clears the visual and
  reaches the engine whenever one is up.
- **`gesture`** — how a pointer operates it, mapped onto a value in one
  place, `_operate`: `hold` (button) is high on `press` and low on `release`,
  `toggle` (switch) flips on a `tap`, `tap` (pulse button) is `true` on a
  `tap`. Any other phase is ignored.

Only three pairs exist, and only they type-check: `UserInput` is the union of
`LevelUserInput` (`level` with `hold` or `toggle`) and `PulseUserInput`
(`pulse` with `tap`), and `isUserInput` refuses any other pair at run time.

On the board, `SimulationTool` picks the gesture's session. Only an input
**operated on the canvas** is pressed or tapped there (`isCanvasOperatedInput`
in `body-hit.ts`): one with a single slot that declares no inspection. A press
on a body can only address one slot, so a multi-slot input (the gamepad) is
operated through its inspection, and a press or tap on its body on the board
operates nothing. A pointerdown on a `hold` input operated on the canvas
(`holdInputAt`) starts a `HoldSession` instead of a `PanSession` — the press
never pans, however far the pointer moves — which presses its slot `0` at once
and releases it when the gesture ends by any route: pointer up, pointer cancel,
lost pointer capture, window blur or a hidden document, Escape, a second touch
finger, a mode or project switch. Anything else gets a `PanSession`, so a drag
pans and only a tap hit-tests the component under the cursor, emitting an
inspect request for one that declares an inspection and a `tap` on slot `0` for
any other user input operated on the canvas. An input that declares an
inspection is played in it, its presses arriving through the inspection's
`InputRoute` ([inspection.md](inspection.md)). `Project.userInput$` carries
each operation as `{ component, phase, slot }`. A slot outside `inputSlots` is
ignored.

The service keeps every high `level` slot — toggled and held alike, per
input, the board's and a watch's copies — so nothing outlives the session
holding it high. `stop()` sets each low against the rebuilt engine once the
reset lands, which also catches a press or toggle that reached the engine
while the reset was in flight; `exit()` clears them visually, the engine being
gone. A hold still open afterwards releases nothing further. A watch copy
whose `toggle` slot is posed high from its link on open is entered through
`adoptHighLevel`, which tracks it without an engine event — the engine already
holds it — so it is reset like any other.

Callers pass an input's **first** unit and a slot, and the service is the one
place that adds them (`unitOfSlot`). Top-level first units come from
`CompiledBoard.userInputs` (`Component.id` → submission index); inner inputs
operated in a watch arrive through `triggerUnitInput` with the first unit
already resolved by the watch index and the phase read through the same
gesture mapping. The automation API's `setUserInput` (and `setUnitInput`, its
watch counterpart) drives one slot to an **absolute** state, which follows
from the drive alone: a `level` slot is set to `value`, one already there
being left alone, and a `pulse` slot pulses on `true` and ignores `false`,
holding no state to clear. Both report `false` for a slot the input does not
have.

---

## Adding simulator support for a component type

1. Implement the type in `@logigator/sim` and bump the dependency.
2. Add its `BuiltInComponentType` id to `UNIT_TYPES`; it then emits as a plain
   unit with pins in `connectionPoints` order.
3. Encode any per-type engine `ops` in `_opsFor` (`ROM` is the worked example).
4. A user input instead implements `UserInput`, with one slot per output port,
   choosing a `drive` (what the engine receives: `level` or `pulse`) and a
   `gesture` (how a pointer operates it: `hold`, `toggle` or `tap`). It needs
   no type id in any set and no branch anywhere: the compiler emits it as one
   `ENGINE_USER_INPUT_TYPE` (200) unit per slot — the engine rejects any other
   id, and pulse-vs-continuous is decided at `triggerInput` time from the
   drive, not the descriptor — the service drives each slot through its own
   unit, and the canvas, the watch and the automation API operate and address
   it by slot. With an `inspection` declared, a tap opens that instead and the
   inspection plays it through its `InputRoute`.
