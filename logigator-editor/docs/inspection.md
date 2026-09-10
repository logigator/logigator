# Live Component Inspection

Tapping an inspectable component in `SIMULATION` mode opens a live view of it:
a floating window over the board on desktop; on compact, the shared non-modal
bottom sheet, or a fullscreen takeover for canvas-hosting views. Two content
kinds exist — the ROM's data inspector and the custom component's
[watch](#the-custom-component-watch).

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

## Orchestration: `InspectionService`

Root-provided and instantiated by `AppComponent`, since nothing renders it and
it must live from startup. It subscribes to the active project's
`inspectRequest$` while the mode is `SIMULATION` (leaving it closes everything),
opens at most one inspection per component instance — a second tap focuses the
existing view — and fans `SimulationService.frame$` out to every open
inspection's `onFrame()`. A factory that **throws** (a watch can legitimately
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
  custom pushes a level, a switch/button triggers its engine unit
  (`SimulationService.triggerUnitInput`, unit index from the watch index), any
  other inspectable opens its data inspector **on the watch copy** — tracked per
  level and closed with it.
- **`WatchSession`** (`watch-session.ts`) — one per level: a fresh headless
  `Project` from `instantiateBody` over the level's circuit body, plus a
  `LinkStateApplier` whose targets are **sparse over the full link-id space**
  (only this circuit's links carry targets), resolved through the compiled
  board's watch index (`board.watch.infoFor(path)`, see `simulation.md`). Index
  tables are keyed by body-array position, so a shape mismatch means the
  definition changed under the session: construction **throws** rather than
  mis-lighting wires. The session registers with the snapshot fan-out and
  requests a full seed snapshot, which also poses copied switches from their
  output-link power.
- Watch canvases lease the **app-wide shared renderer**
  (`rendering/renderer.service.ts`), the board's own, so the page runs one
  rendering context however many watches are open. Each render force-unculls the
  watch project (`uncullTree`; no cull pass runs on watch renders) and scales
  the CSS-pixel viewport transform up to the canvas's DPR-sized backing store.
- **`SubCircuitWatchComponent`** — the canvas; the breadcrumb trail renders in
  the hosting header via `titleParts`. Input runs through the board's own
  `PointerController` (shared right-drag/wheel/pinch navigation) with a
  `PanSession` as its tool, whose tap action routes back to the model. A level
  is fit-and-centred when it first shows; re-blits ride `render$` (engine
  changes), the project's `ticker$` (zoom, theme) and host resizes —
  `Project.pan` emits nothing, so panning renders explicitly.
