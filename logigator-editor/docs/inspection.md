# Live Component Inspection

Tapping an inspectable component in `SIMULATION` mode opens a live view of it:
a floating window over the board on desktop; on compact, the shared non-modal
bottom sheet, or a fullscreen takeover for canvas-hosting views. Five content
kinds exist — the ROM's and the RAM's [memory views](#the-memory-inspections),
the custom component's [watch](#the-custom-component-watch), the
[gamepad](#the-gamepad)'s controller and the [keyboard](#the-keyboard)'s
typing window.

## The Model: `ComponentInspection`

`components/component-inspection.ts` — the inspection analog of
`ComponentOption` / `ComponentAction`. A type opts in with a factory on its
config (`inspection: (c) => new RomInspection(c as RomComponent)`); one instance
is created per opened component and lives until its view closes. Non-obvious
members: `titleParts?` (breadcrumb segments the window title bar renders instead
of `title`, `navigate`-carrying ones clickable; `title` stays the flat fallback
for sheet tabs and aria labels), `compactPresentation?` (`'sheet'` by default,
or `'fullscreen'`), and `onFrame?()`, called after every applied snapshot and
after `stop()`'s visual reset.

Live data is deliberately **pull-based**: no per-link subscriptions. An
inspection reads what the main thread already holds — the component's options
and its per-port link power (`Component.isPortPowered`, maintained by
`LinkStateApplier`) — and exposes it as signals its OnPush renderer picks up.

The factory also receives an `InspectionContext` whose **`InputRoute`**
(`operate(operations)`, each a `{ slot, phase }`) is where a user input played
inside the inspection sends its presses, so the inspection never resolves an
engine unit itself. One call is one frame: every slot it changes reaches the
circuit on the same tick. Where the component was opened decides the route: on
the board it is `SimulationService.operateInput`, the gesture mapping a press
on the canvas goes through; in a watch it operates the copy's slots through
that level (`operateUnitInput` with the copy's unit). Beside the presses, the
route hands [input frames](simulation.md#input-frames) to the component's own
engine input (`send(frames)`), replaces the ones it still has queued with an
optional reset (`cancel(reset?)`), and counts its event frames not yet applied
(`pending()`) — through `SimulationService.sendFrames` and its siblings on the
board, through `sendUnitFrames` with the copy's resolved unit in a watch. The gamepad
plays its slots through `operate`, the keyboard sends frames, and
the ROM, the RAM and the watch ignore the route.

Beside it, the context's **`StateRoute`** is where the inspection reads its
component's [engine state](simulation.md#component-state):
`watch(onRead)` starts a `StateWatch` over the component's unit — through
`SimulationService.watchState` on the board, `watchUnitState` with the unit
from the watch index's `stateUnitFor` for a copy in a watch — or answers
`null` for a component with no state the session reads. Only the RAM uses it.

## Orchestration: `InspectionService`

Root-provided and instantiated by `AppComponent`, since nothing renders it and
it must live from startup. It subscribes to the active project's
`inspectRequest$` while the mode is `SIMULATION` (leaving it closes everything),
opens at most one inspection per component instance — a second tap focuses the
existing view — and fans `SimulationService.frame$` out to every open
inspection's `onFrame()`. `openFor(component, { input, state, place })` takes
the routes the factory receives, each defaulting to the top-level one, and the
**place** of a watch's copy: the names of the watch levels down to the one
holding it. The entry keeps the place, and `entryTitle` / `entryTitleParts`
(`inspection-presenter.ts`) put it ahead of the inspection's own title, so a
view opened from a watch reads _Outer › Inner › ROM_ in its window's title
bar, the sheet's header and automation's `title`; a sheet tab keeps the short
title. A factory that **throws** (a watch can legitimately
fail to open when the definition no longer matches the compiled board) surfaces
as an error toast instead of crashing the tap.

Desktop always uses windows; compact uses the sheet, except
`compactPresentation: 'fullscreen'` entries (watches), which stay windows on
every breakpoint. A breakpoint flip re-homes only entries whose presenter
changes; watches keep their window entry, re-rendered by the other outlet.

## Presenters

`inspection-presenter.ts` is the strategy interface — `show` (with a
`dismissed` callback for closes driven from the presenter's own chrome),
`focus`, `close` (view teardown without touching the inspection):

- **Desktop** — `WindowInspectionPresenter`: one non-modal `@logigator/ui`
  window per inspection. Its outlet sits in the board area's `relative`
  container (the `window` band in `logigator-ui/styles/layers.css`, above the
  docked canvas overlays, below the cdk overlays and toasts) and doubles as the
  drag/resize bounds.
- **Compact** — `SheetInspectionPresenter` (state) + `InspectionSheetComponent`
  (view): all inspections share one bottom `lg-drawer` with `[modal]="false"`,
  so the running circuit stays visible and interactive. One active view, a tab
  row when several are open; closing the sheet dismisses all of them. The view
  is keyed by its entry, so a tab switch destroys the shown view and builds
  the next one, even between two inspections with the same renderer: a view
  is bound to the inspection it was built for, and `NgComponentOutlet` alone
  would hand it the other tab's inspection as a new input instead.
- **Compact fullscreen** — the _same_ window presenter through a second,
  `fullscreen` `lg-window-outlet`. The app template swaps the two outlets under
  `@if (layout.isCompact())`; exactly one may be alive at a time, since two
  would instantiate every window's content twice. That outlet renders each
  window as an outlet-filling takeover (no drag/resize, back button instead of
  ✕), opaque and stacked by z-index, so back reveals the one beneath.

## The Memory Inspections

The ROM and the RAM share one model and one renderer
(`inspection/memory/`): `MemoryInspection` holds the table's shape (frozen at
open time; editing is locked during simulation), `bytes` and `loaded` signals,
and the live address. Both address `Σ inᵢ << i`, so input port `i` (label
`A(i+1)`) is address bit `i`, and `onFrame` folds
`isPortPowered(0..addressSize-1)` into an `address` signal.
`MemoryInspectionComponent` is the hex editor (`ui/hex-editor/`) in `readOnly`
viewer mode; `highlightIndex` makes the addressed word the active cell, so
the status box reads out the live address and value.

**ROM** (`rom/rom-inspection.ts`) — the contents are static and already on
the main thread (the `data` option's packed blob): `bytes` is that blob sized
to the table, `loaded` is `null` (all of it), and only the address is live.

**RAM** (`ram/ram-inspection.ts`) — the memory is the engine's, read through
the context's `StateRoute` into a buffer the size of the table, and only where
the view shows it. The hex editor reports the bytes its rendered rows cover
(`shownBytes`, off `LgScroller`'s `renderedRangeChange`: the rows on screen
plus the CDK's buffer) and the renderer forwards them to `showBytes`, `null`
when the view is destroyed — a closed window, a sheet tab in the background —
which stops the watch. A memory of at most `RAM_WHOLE_READ_BYTES` (4 KiB) is
read whole whenever a view shows any of it: a screen of 64-bit words with its
margin is about that already, so a range would save nothing and cost a round
trip per scroll. A larger one (up to 512 KiB) is read over the rows shown plus
as many again on either side, and moved only once the view leaves that range.
The engine sends a range only when the RAM's version moved, so a paused RAM,
or one the circuit does not write, costs nothing per frame.

Every read is copied into the buffer and `bytes` is set to a fresh
`subarray(0)` of it — a new reference over the same bytes, which is what moves
a signal and an input binding without copying 512 KiB a frame; a viewer reads
a right-sized `data` in place, and a data change re-seeds the viewer without
resetting its view, base or active cell. `loaded` is the range last read,
current as of the last snapshot; the hex editor draws a cell with any byte
outside it as `·` digits in muted ink (Copy writes the same), and the status
box reads _Not loaded_ for its value. On a stop (`SimulationService.resets`)
the inspection zeroes the buffer and keeps `loaded`: the rebuilt engine's
memory is all zero, and the worker sends nothing until it is written again.

A new inspection is a `ComponentInspection` subclass, a renderer taking
`inspection = input.required<...>()` with host class `h-full` so it fills window
and sheet alike, and the factory on the config. Everything else keys off that
declaration.

## The Custom-Component Watch

Tapping a placed custom component opens a **live canvas view of its inner
circuit**, split between the component layer and `inspection/watch/`:

- **`SubCircuitWatch`** (`components/custom/sub-circuit-watch.ts`) — the
  `ComponentInspection` every custom config declares. It owns a **breadcrumb
  stack** of `WatchLevel`s (last one visible, title their joined names) and
  routes clicks on the visible copy through `activate(component)`: a nested
  custom pushes a level; any other component that declares an inspection opens
  it **on the watch copy**, with an `InputRoute` and a `StateRoute` bound to
  the level and the breadcrumb as its place — a RAM copy reads its unit's
  memory, resolved by `stateUnitFor` — checked
  before anything would trigger it as a user input, so an input played in its
  own inspection is opened rather than pressed — tracked per level and closed
  with it; any other user input operated on the canvas — one slot, no
  inspection, the board's rule (`isCanvasOperatedInput`) — gets a `tap` on
  its slot `0` (`SimulationService.operateUnitInput`, unit index from the
  watch index), which its gesture reads as a toggle or a pulse. A multi-slot
  input without an inspection is neither tapped nor held there. A `hold` input is held
  rather than tapped: `holdFor(component, slot)` hands out the slot's
  `press` / `release`, both `operateUnitInput` with that phase and
  bound to the level they were resolved on, so a release arriving after a
  level swap still reaches the unit it pressed. `setInput(component, value,
slot)` is the absolute path automation drives.
- **`WatchSession`** (`watch-session.ts`) — one per level: a fresh headless
  `Project` from `instantiateBody` over the level's circuit body, plus a
  `LinkStateApplier` whose targets are **sparse over the full link-id space**
  (only this circuit's links carry targets), resolved through the compiled
  board's watch index (`board.watch.infoFor(path)`, see `simulation.md`). Index
  tables are keyed by body-array position, so a shape mismatch means the
  definition changed under the session: construction **throws** rather than
  mis-lighting wires. Destroying one sets every high `level` slot of its
  copies low, held or toggled, and lets go of every key a keyboard copy holds
  down (`KeyboardComponent.releaseKeys`, queued behind what it still has to
  send),
  which would otherwise leave their engine inputs high with no copy left to
  reset them. The session registers with the
  snapshot fan-out and requests a full seed snapshot, which also poses the
  copies' `toggle` slots from their output-link power — a powered one adopted
  through `SimulationService.adoptHighLevel`, so a stop resets it too.
- Watch canvases lease the **app-wide shared renderer**
  (`rendering/renderer.service.ts`), the board's own, so the page runs one
  rendering context however many watches are open. Each render force-unculls the
  watch project (`Project.uncull()`; no cull pass runs on watch renders) and scales
  the CSS-pixel viewport transform up to the canvas's DPR-sized backing store.
- **`SubCircuitWatchComponent`** — the canvas; the breadcrumb trail renders in
  the hosting header via `titleParts`. Input runs through the board's own
  `PointerController` (shared middle/right-drag/wheel/pinch navigation) with a
  `PanSession` as its tool, whose tap action routes back to the model — or a
  `HoldSession` over `holdFor` (slot `0`) for a press on an inner `hold` input
  operated on the canvas (`holdInputAt`), cancelled like
  any session by a level swap or the component going away. A level
  is fit-and-centred when it first shows; re-blits ride `render$` (engine
  changes), the project's `ticker$` (zoom, theme) and host resizes —
  `Project.pan` emits nothing, so panning renders explicitly.

## The Gamepad

A gamepad has one slot per control and declares an inspection, so a tap on the
canvas opens its controller rather than pressing anything. Three pieces live in
`components/component-types/gamepad/`.

**`GamepadPadComponent`** (`pad/`) is the only drawing of the controller in the
DOM, and holds no simulation state. Inputs: `controls` (port order), `names`
(a `model`), `mode` (`play`, `assign`, `names`), and for `play` the `pressed`
set, `keyCaps`,
`keyboardActive` (chips dim, the body's accent outline drops),
`keyboardPresent` (chips show even on a touch-only device, where
`(hover: none)` hides them otherwise) and `enlarged` (hit regions grown past
the shapes); for `assign`, `capturing` and `flashed` (one control each, or
`null`). Outputs: `pointerHold` (`{ pointerId, pressed, released }`, what
one pointer event changed, so a D-pad diagonal is one event), `controlSelect`
and `save`. One SVG behind draws the fixed silhouette and the
control shapes; every control, glyph, caption and keycap chip is an HTML
element over it, placed in percent from **one layout table** in viewBox units
(`pad/gamepad-pad-layout.ts`, `padLayout(controls)`), which the SVG draws from
too, so the two cannot drift, and a caption can be an `<input>` without
`foreignObject`. The silhouette is fixed: absent controls are not drawn, and
only the face and menu groups rearrange by how many buttons they have. The host
keeps the viewBox's aspect ratio from its width and is an inline-size
container, so glyphs and text scale with it. A custom name is a caption beside
its control, clipped with an ellipsis, in full in `title`; the glyph stays on
the button, and the `aria-label` reads the custom name, the control's spoken
name (`components.def.GAMEPAD.controls.*`: Up, Select, … rather than the port
labels `UP`, `SL`) and the key; the names inputs are labelled by the spoken name
too, while their placeholders stay the port labels an empty name shows on the
board. In `play`
every control is a `<button>` held through pointer capture, one hold per
pointer id, so fingers hold controls independently; a pointer ends on
`pointerup`, `pointercancel` or `lostpointercapture`. In `names` the buttons
are `aria-disabled` and out of the tab order, each caption is an input, and the
inputs follow port order in the DOM, so Tab walks the D-pad, face, shoulder and
menu buttons in that order; a focused input widens over its neighbours to fit
a whole name. In `assign` the silhouette and glyphs dim, the chips give way to
each present control's key drawn large on its face (`—` when unbound), and the
buttons stay focusable but press nothing: a click, or Enter or Space on a
focused one, focuses it and emits `controlSelect`. The `capturing` control
pulses with _Press a key…_ and the `flashed` one is highlighted; both animate
only under `prefers-reduced-motion: no-preference`, the colours carrying the
state otherwise.

**The D-pad** is one hit region over its four arm buttons. The pointer's offset
from its centre picks one of **eight 45° sectors**, a diagonal holding both
neighbours, with a dead zone of 20 % of the radius that holds nothing
(`pad/dpad-sectors.ts`, pure). `pointermove` re-evaluates and only the
difference goes out (`heldChanges`), so a thumb rolls from ← over ↖ to ↑,
pressing ↑ once and releasing ← once.

**`GamepadInspection`** merges every source. Each control has a set of
**holders**, `key:<code>`, `ptr:<pointerId>` and `pad:<index>:<input>`, and is
pressed while the set is non-empty; only an empty ↔ non-empty transition goes out, as
a `press` or `release` of the control's slot, read from `component.slotIds` at
the call. What one source event changes goes out **batched**, as one
`route.operate` and so one engine frame (`batch(run)`, nested batches joining
the outer one): a key down or up, one pointer event (`pointerMove(pointerId,
pressed, released)`, from the pad's `pointerHold`), one controller poll, and
every holder a `releaseKeys()`, `releasePointers()`, `releasePad()`,
`setAssigning(true)` or `destroy()` lets go of. Controls pressed together
therefore reach the circuit on the same tick; two keys or two fingers are two
DOM events, so two frames, a tick apart when both arrive between two ticks. A frame
is the gamepad's slot write like any hold input's, events behind a bounded
backlog ([simulation.md](simulation.md#input-frames)), so mashing a control
faster than a paused or slow simulation steps keeps its last press and drops
older ones. Holding a key and clicking the same control,
then letting go of either, keeps it held. `releaseKeys()` drops only `key:`
holders, so pointer and controller holds survive the window losing focus;
`releasePad()` drops only `pad:` holders. A control the pad does not have takes
no holder, so a controller's shoulder buttons play nothing on a pad without
them. What the window
draws as pressed is not the holders but the component's own slot state,
re-read into `pressed` on every frame and after every route call, so a press
from automation or a second view shows, and one the simulation dropped does
not. `destroy()` lets go of every holder, so closing the window (leaving
simulation closes it) leaves nothing held. `setAssigning(true)` lets go of
every holder through the same path and refuses new ones until
`setAssigning(false)`, so the window plays nothing while it assigns keys; the
flag lives on the inspection, so a view rebuilt by a breakpoint flip resumes
it, and closing the window ends it. The title is the type's name. The inspection is also the pad's `GamepadHardwareService`
target from opening to closing (see Physical Controllers), whether a view of
it is on screen or not.

**`GamepadInspectionComponent`** is the window body: the pad in `play` over a
footer reading _Keyboard active_ while focus is inside the frame, and _Click
here to use the keyboard_ otherwise, the controller select (see Physical
Controllers) and _Assign keys_. The frame is the nearest
`[role="dialog"]` ancestor (the `lg-window` host on desktop, the drawer panel
in the sheet), and it is registered with `GamepadKeyboardService` as the
target's `host`, so a click on the title bar, which focuses the window, hands
the keyboard over too. The view **focuses itself once rendered**, so keys work
at once, and on any `pointerdown` it takes the focus when the frame lacks it,
since some browsers give a clicked button none. Unregistering releases its
keys; its own teardown also drops the inspection's pointer holders, since a
breakpoint flip re-renders the view while the inspection lives on. On compact
the pad fills the sheet's width with enlarged hit regions, and the footer and
chips show only once a keyboard is known to be at hand: an
`(any-pointer: fine)` device, or a key pressed since the view opened. Assign
mode is reached from that footer, so only where it shows. The footer also shows
on compact whenever a controller is connected, holding only the controller
select until a keyboard is at hand, since a phone or tablet can pair a
controller.

**In a watch.** A tap on a gamepad copy opens its window through
`SubCircuitWatch.activate`, with the level's route and the breadcrumb as its
place, so the title reads _Outer › Inner › Gamepad_. Its presses drive the inner
engine input's slots (`operateUnitInput`), light the copy and re-blit the level
through the level project's ticker. Keys and controllers reach it as they reach a
top-level pad; only the route differs. Popping its level, navigating the
breadcrumb above it or closing the watch closes the window first, and its
`destroy()` sets every held slot low through that route while the copy still
exists; the session's own teardown then finds nothing high, so each held slot
gets exactly one `CONT false`. A `stop()` sets the copy's slots low against
the rebuilt engine like any tracked level slot and leaves the window open:
its holders stay until they let go, which sends nothing more, and the next
press plays again.

**On compact** the window is a sheet tab (the default `compactPresentation`).
Each tab switch builds a fresh view, which registers the drawer panel as its
keyboard host and focuses itself, while the view going away unregisters and
releases its keys, so keys reach only the visible pad. A controller stays on
its pad behind another tab and keeps playing it, since the assignment belongs
to the inspection, not the view. A breakpoint flip re-homes the view the same
way: the old view lets go of its pointers and keys, and assign mode and the
controller, holds included, carry over. The pad's area is `touch-none`, so a
finger landing between controls is never a scroll of the sheet or a page zoom
that would cancel the other fingers' holds.

**Assign mode.** _Assign keys_ unregisters the view from
`GamepadKeyboardService`, which releases the keys the pad held, then calls
`setAssigning(true)`; the footer becomes _Click a control, then press a key_ ·
_Reset to defaults_ · _Done_, and _Done_ sets it back and registers again, so
play keys route at once. Unregistering for the whole mode is what lets a
capture see a key the service would otherwise consume in its capture-phase
listener. Picking a control starts its **capture**; picking another moves it,
and picking the same one cancels it. The next keydown is handled on the view's
own host, so it needs focus inside the content, which picking a control gives
it, and focus leaving the captured control ends the capture:

- `Tab` passes untouched and moves focus as ever.
- Anything else is consumed: `preventDefault` + `stopPropagation`, so it
  reaches neither the window's Escape-to-close on the frame nor
  `ShortcutService` on `window`. A repeat is consumed and does nothing, so the
  Enter that started a capture cannot end it by being held.
- `Escape` cancels the capture, leaving the window open.
- `Backspace` / `Delete` unbinds the control (`clear`).
- Any other bindable code is `assign`ed. A swap returns the control that took
  the old key, which is `flashed` for 600 ms.

Bindings are the service's signal, so every open gamepad redraws at once.
_Reset to defaults_ calls `reset()` without asking. Each step is spoken by a
polite `aria-live` region (_Press a key for Up_, _Up: X (swapped with B)_, the
unbind and the reset), naming controls by their spoken names.

## Gamepad Keys

A gamepad is played from the keyboard through two root services.

**`GamepadBindingsService`** (`shortcuts/gamepad-bindings.service.ts`) holds
one key per control, shared by every gamepad: `bindings` (control →
`KeyboardEvent.code` or `null`), `controlFor(code)`, `assign` / `clear` /
`reset`. Bindings are by **`code`**, the key's position, not by `key` as
`ShortcutService`'s are — a Shift pressed in between changes `key` between
keydown and keyup, which would leave a control stuck. No two controls share a
code: `assign` swaps with the control that held it and returns that control.
Escape and Tab are never bound; keys are assigned in the window's assign mode
(see The Gamepad). The map persists at
`localStorage['logigator.gamepad.keys']` as `{ v: 1, keys }`, resolved **per
control** on read, so one bad entry costs only that entry, and a `storage`
event re-reads it, so a rebind in one tab reaches the others. `keyLabel(code)`
names a key for its keycap: in the user's layout where Chromium's
`navigator.keyboard.getLayoutMap()` reports it (loaded once, into a signal),
otherwise from a fixed table (`gamepad-key-labels.ts`); `keyIcon(code)` is the
Phosphor class for the keys drawn as icons (the arrows, Enter), and `keyCaps`
is every control's label and icon at once.

**`GamepadKeyboardService`** (`inspection/gamepad/gamepad-keyboard.service.ts`)
routes keys by **DOM focus**: an open pad view registers a `GamepadKeyTarget`
(`host`, `keyDown`, `keyUp`, `releaseKeys`), and a key goes to the target
whose `host` contains `document.activeElement`, to nobody otherwise. Its
`keydown`/`keyup` listeners are on `window` in the **capture** phase, so they
run before `ShortcutService`'s bubble-phase ones. A keydown passes through
untouched when no host holds the focus, the simulation is not ready, the
target is a text field (`input`, `textarea`, `select`, contenteditable), Ctrl,
Meta or Alt is held (unless it is the key itself), or the code is unbound.
Anything else is consumed (`preventDefault` + `stopImmediatePropagation`), so
**a bound key shadows its shortcut while a pad has focus** — Enter presses
Start rather than toggling the simulation; a repeat is consumed without a
second press. Escape is never bound, so it always reaches the window or the
board. A view assigning keys is not registered at all, so its window gets
every key itself.

The service records which codes it pressed and on which target. A keyup for
one of them is consumed and released on that target, wherever focus has gone
since. A `focusout` leaving a host releases that target's keys
(`releaseKeys()`); a `window` blur, `visibilitychange` to hidden and
unregistering release theirs too. Listeners attach on the first registration
and are removed with the service.

## Physical Controllers

**`GamepadHardwareService`** (`inspection/gamepad/gamepad-hardware.service.ts`)
plays gamepads from physical controllers through the browser Gamepad API. A
controller does **not** follow focus as the keyboard does: it is **assigned**
to one target and plays it whichever window has focus, so two players with two
controllers play two pads at once, and clicking the board does not cut off the
controller in hand.

**Discovery.** `controllers` lists every connected controller by index, with
its `id`, a `label` (`1 · Xbox Wireless Controller`: the index from 1 and the
`id` without Chromium's parenthesised mapping and vendor/product suffix or
Firefox's `vendor-product-` prefix, `controllerLabel` in
`gamepad-hardware-mapping.ts`) and `supported`, which is `mapping ===
'standard'`. It is read from `navigator.getGamepads()` on the first
registration and again on every `gamepadconnected` / `gamepaddisconnected`.
Browsers expose a controller only after one of its buttons is pressed while the
page has focus, and only in a secure context; where `getGamepads` is missing,
`available` is `false` and the service does nothing.

**Assignment.** A `GamepadInspection` registers itself as a
`GamepadPadTarget` (`padDown(control, input)`, `padUp(control, input)`,
`releasePad()`, `batch(run)`) when it opens and unregisters when it closes, so a controller
plays a pad whether or not a view of it is on screen. Registrations are
counted: a target registered twice stays until both registrations have gone.
`assign(index, target)`, `unassign(target)` and `assignmentOf(target)` (a
signal of the index or `null`) are the window's select.

- A controller belongs to at most one target. Assigning one another target
  holds moves it, and that target releases what it held.
- An unsupported controller is never assigned; the select lists it disabled,
  with the tooltip _This controller's layout isn't supported_.
- A target registering takes the controller it last chose if that is free,
  otherwise the first free supported one, and none if its last choice was
  _None_. A controller connecting is offered the same way to every target
  without one, so pressing a button with a window open connects it there.
- Assignments last for the session, and nothing is persisted: controller
  indices are not stable across reconnects.

The select is hidden until a controller is reported. Before that, on desktop
and only where `available`, the footer's spacer carries a muted _Press a button
on your controller to connect it_, which truncates rather than wrapping the
footer.

**Polling.** The API has no input events: `getGamepads()` is a snapshot. One
`FRAME_SCHEDULER` callback reads it each frame while at least one assignment
exists, the simulation `isReady()` (paused included, as the board's buttons can
be held while paused) and the page is visible, and stops otherwise. Each frame
maps every assigned controller through `standardHolds` (pure, in
`gamepad-hardware-mapping.ts`) to the inputs holding a control right now, and
**diffs** that against the last frame, so a target hears only changes, as
`padDown` / `padUp` with `input` = `<index>:<input>`, all of one frame inside
one `batch`, so what a poll finds pressed together lands on one tick.

| Standard input                       | Control                  | Input id                |
| ------------------------------------ | ------------------------ | ----------------------- |
| buttons 12 / 13 / 14 / 15            | up / down / left / right | `button-12` …           |
| left stick, axes 1 and 0 beyond ±0.5 | up / down / left / right | `stick-up` …            |
| button 1 (right face)                | a                        | `button-1`              |
| button 0 (bottom face)               | b                        | `button-0`              |
| button 3 (top face)                  | x                        | `button-3`              |
| button 2 (left face)                 | y                        | `button-2`              |
| button 4 (LB) / 6 (LT)               | l                        | `button-4` / `button-6` |
| button 5 (RB) / 7 (RT)               | r                        | `button-5` / `button-7` |
| button 8 (back / share)              | select                   | `button-8`              |
| button 9 (start)                     | start                    | `button-9`              |

The face buttons take the SNES positions (A right, B bottom), so the layout is
the same on every standard controller whatever its labels say. A trigger holds
at `value > 0.5`; every other button by `pressed`. Each input is its own
holder, so the D-pad and the stick both holding _up_, or a bumper and its
trigger both holding _l_, release only when both let go. Controller remapping
does not exist; the keyboard is what is rebindable.

**Release.** Every controller hold of the targets concerned is released
(`releasePad()`) on a disconnect, an unassignment or a move to another target,
an unregistered target (the window closed), `visibilitychange` to hidden, and
the simulation stopping being ready, simulation exit included; the last three
stop polling, which releases everything held. Assign mode lets go of `pad:`
holders as of every other kind and takes no new one, so a controller plays
nothing while keys are assigned.

## The Keyboard

A keyboard declares an inspection, so a tap opens its typing window:
`KeyboardInspection` (`components/component-types/keyboard/keyboard-inspection.ts`)
rendered by `KeyboardInspectionComponent`, a 420 × 230 window (300 × 180 at
least) on desktop and a sheet tab on compact. The config's factory throws
without an `InspectionContext`: a keyboard without a route could send nothing.

**`KeyboardInspection`** turns what the view reports into the component's key
operations (`pressKey`, `releaseKey`, `releaseKeys`, `tapKeys`, `cancelKeys`,
see [component-system.md](component-system.md)) over its route.
`press(key, code)` is a physical key going down, remembered by its
`KeyboardEvent.code` among the keys down, whether or not another one is;
`release(key)` lets go of that key, matched by `code`, so a Shift let go of
first still releases the letter, and sends the release (`KD` low) only when
no other key is down; `releaseHeld()` is focus loss and lets go of every
physical key, leaving a key automation holds; `type(codes)` sends text that
had no keys as taps; `cancel()` replaces the route's queue with the cancel
frames, so `STB` is low after the next tick and `KD` after the one after, `D`
keeping its code. `press` and
`type` report whether what they sent fit behind the characters still queued:
the input holds at most `INPUT_QUEUE_LIMIT` event frames (21 845 characters,
see [simulation.md](simulation.md#input-frames)), and a key or a text that
does not fit is refused whole by the component — a text is never cut — sending
nothing, recording nothing and leaving `D` as it was. The inspection
keeps the last 64 codes sent (`KEYBOARD_HISTORY_LENGTH`) and which of them is
on `D` while a key is down (`heldEntry`, the window's own press that
`KeyboardComponent.heldKey` still names: under rollover the newest key, and
still that key's while an earlier one stays down after it went up), and
re-reads on every frame the code on `D`
(`KeyboardComponent.readCode`, ahead of any bubble) and the characters still
to go out, the route's `pending()` events in threes (`pendingCharacters`, see
[simulation.md](simulation.md#run-controls-and-user-input)), and `room()`, how
many more fit (`charactersThatFit`); both are re-read after every send too.
`pending()` is an upper bound that counts what was sent since the last
snapshot, so two pastes in one frame see each other. A stop, seen as
`SimulationService.resets()` moving, clears the history and the held entry.
`destroy()` lets go of every physical key down, so closing the window leaves
`KD` low unless automation holds a key. The title is the type's name.

**`KeyboardInspectionComponent`** is the window body. A hidden `<textarea>`
over the history strip is the capture field, and every event is handled on it:

- `keydown`: a key whose character is still being composed (`isComposing`,
  or `key` is `Process`, `Unidentified` or `Dead`) passes through, its text
  arriving as an input event. A repeat (`KeyboardEvent.repeat`) is consumed
  and sends nothing, which is what ignores OS auto-repeat: a held key strobes
  once, and with another key pressed over it, the newer key's repeats do not
  strobe either. Ctrl, Meta, or Alt without AltGraph passes
  through, so the browser's own shortcuts work, and so does Shift+Tab, so the
  focus can leave the field. A key `characterOfKey` (`ascii.ts`) knows is
  consumed: an ASCII one is pressed, any other reported as skipped. Escape also
  stops propagation, so it closes neither the window nor the sheet. Arrows and
  F-keys pass through.
- `keyup` hands its code to `release`.
- `paste`, `beforeinput` (`insertText`, `insertFromPaste`, `insertLineBreak`,
  and `deleteContentBackward` / `deleteContentForward` as BS / DEL) and
  `compositionend` carry text without a keydown of its own. `textToCodes`
  normalizes it — CRLF and CR to LF, non-ASCII skipped and counted, at most
  `KEYBOARD_TEXT_LIMIT` (10 000) characters — and it goes out through `type`.
- `focusout`, a `window` blur and `visibilitychange` to hidden let go of
  every key down.

After every input event the field holds a one-character sentinel with the
caret behind it, because a soft keyboard often sends nothing for Backspace in
an empty field. `ShortcutService` ignores a textarea target and
`GamepadKeyboardService` passes text fields through, so neither acts on the
field's keys; Escape, the one key the shortcuts take from a text field, is
stopped there.

The status line reads _Typing into the circuit · Shift+Tab to leave_ while the
field has the focus and _Click here to type_ otherwise; a skipped-characters
notice replaces it for 4 s, and so does _Nothing was sent: wait for the
characters still being sent_ for a key, a paste or a send refused for room.
_Sending N…_ and its cancel button show while
`pending()` is above zero. A `mousedown` anywhere in the view outside a
control focuses the field. _Type text…_ opens `TypeTextDialogComponent`, a
modal textarea capped at the limit that shows the skip count as it is edited
and closes with the codes to send as taps; the focus returns to the field
either way, and the dialog closes with the view. It is handed the
inspection's `room` signal, and while the text is longer it says to wait for
the characters still being sent and disables _Send_, which comes back on its
own as they go out.

The view focuses the field once rendered, except on a touch device in the
compact layout (`LayoutService.isCompact()` and `isTouch()`): an OS keyboard
opens only for a focus inside the tap that asks for it, so there the strip
reads _Tap to type_ until the field has the focus, and a tap on the strip
lands on the field itself. The sheet stays above the OS keyboard because
`lg-drawer` follows the visual viewport, and the inspection sheet sizes its
panel rather than the view, so the view shrinks with it. The view going away
while the inspection lives on — a tab switch, a breakpoint flip — lets go of
every key down, since no keyup can reach the view any more.

**In a watch.** A tap on a keyboard copy opens the window through
`SubCircuitWatch.activate` with the level's route and the breadcrumb as its
place (_Outer › Inner › Keyboard_). Its frames reach the copy's own units
through `sendUnitFrames`, the copy's readout follows its links like the rest
of the level, and the level's teardown lets go of every key the copy holds
down (see The Custom-Component Watch).
