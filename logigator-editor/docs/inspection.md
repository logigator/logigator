# Live Component Inspection

Tapping an inspectable component in `SIMULATION` mode opens a live view of it:
a floating window over the board on desktop; on compact, the shared non-modal
bottom sheet, or a fullscreen takeover for canvas-hosting views. Three content
kinds exist — the ROM's data inspector, the custom component's
[watch](#the-custom-component-watch) and the [gamepad](#the-gamepad)'s
controller.

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
(`press(slot)` / `release(slot)`) is where a user input played inside the
inspection sends its presses, so the inspection never resolves an engine unit
itself. Where the component was opened decides the route: on the board it
emits on the main project's `userInput$` (`emitUserInput(component, phase,
slot)`), exactly as a press on the canvas does; in a watch it holds the copy's
slot through that level (`SubCircuitWatch.holdFor`). The gamepad plays its
slots through it; the ROM and the watch ignore it.

## Orchestration: `InspectionService`

Root-provided and instantiated by `AppComponent`, since nothing renders it and
it must live from startup. It subscribes to the active project's
`inspectRequest$` while the mode is `SIMULATION` (leaving it closes everything),
opens at most one inspection per component instance — a second tap focuses the
existing view — and fans `SimulationService.frame$` out to every open
inspection's `onFrame()`. `openFor(component, { input })` takes the route the
factory receives, defaulting to the top-level one. A factory that **throws** (a watch can legitimately
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
  row when several are open; closing the sheet dismisses all of them.
- **Compact fullscreen** — the _same_ window presenter through a second,
  `fullscreen` `lg-window-outlet`. The app template swaps the two outlets under
  `@if (layout.isCompact())`; exactly one may be alive at a time, since two
  would instantiate every window's content twice. That outlet renders each
  window as an outlet-filling takeover (no drag/resize, back button instead of
  ✕), opaque and stacked by z-index, so back reveals the one beneath.

## The ROM Inspection

`components/component-types/rom/rom-inspection.ts`. Contents are static and
already on the main thread (the `data` option's packed blob); only the address
is live. The engine addresses `Σ inᵢ << i`, so input port `i` (label `A(i+1)`)
is address bit `i`, and `onFrame` folds `isPortPowered(0..addressSize-1)` into
an `address` signal. The renderer is the hex editor (`ui/hex-editor/`) in
`readOnly` viewer mode; `highlightIndex` makes the addressed word the active
cell, so the status box reads out the live address and value.

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
  it **on the watch copy**, with an `InputRoute` bound to the level — checked
  before anything would trigger it as a user input, so an input played in its
  own inspection is opened rather than pressed — tracked per level and closed
  with it; any other user input operated on the canvas — one slot, no
  inspection, the board's rule (`isCanvasOperatedInput`) — gets a `tap` on
  its slot `0` (`SimulationService.triggerUnitInput`, unit index from the
  watch index), which its gesture reads as a toggle or a pulse. A multi-slot
  input without an inspection is neither tapped nor held there. A `hold` input is held
  rather than tapped: `holdFor(component, slot)` hands out the slot's
  `press` / `release`, both `triggerUnitInput` with that phase and
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
  copies low, held or toggled, which would otherwise leave their engine units
  high with no copy left to reset them. The session registers with the
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
`null`). Outputs: `controlDown` / `controlUp` (`{ control, pointerId }`,
transitions only), `controlSelect` and `save`. One SVG behind draws the fixed silhouette and the
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
**holders**, `key:<code>` and `ptr:<pointerId>`, and is pressed while the set
is non-empty; only an empty ↔ non-empty transition goes out, as
`route.press(slot)` / `route.release(slot)`, the slot read from
`component.slotIds` at the call. Holding a key and clicking the same control,
then letting go of either, keeps it held. `releaseKeys()` drops only `key:`
holders, so pointer holds survive the window losing focus. What the window
draws as pressed is not the holders but the component's own slot state,
re-read into `pressed` on every frame and after every route call, so a press
from automation or a second view shows, and one the simulation dropped does
not. `destroy()` lets go of every holder, so closing the window (leaving
simulation closes it) leaves nothing held. `setAssigning(true)` lets go of
every holder through the same path and refuses new ones until
`setAssigning(false)`, so the window plays nothing while it assigns keys; the
flag lives on the inspection, so a view rebuilt by a breakpoint flip resumes
it, and closing the window ends it. The title is the `label` option, or
the type's name.

**`GamepadInspectionComponent`** is the window body: the pad in `play` over a
footer reading _Keyboard active_ while focus is inside the frame, and _Click
here to use the keyboard_ otherwise, and _Assign keys_; the footer keeps a
marked place for the controller select. The frame is the nearest
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
mode is reached from that footer, so only where it shows.

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
