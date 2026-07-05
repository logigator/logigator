# Live Component Inspection

Inspecting a component while the simulation runs: tapping an inspectable
component in `SIMULATION` mode opens a live view of it — a floating, draggable
window over the board on desktop; on compact, the shared non-modal bottom
sheet or (for canvas-hosting views) a fullscreen takeover. Two content kinds
exist: the ROM's **data inspector** (read-only hex editor, addressed word
highlighted) and the custom component's **watch** (a live canvas view of its
inner circuit — see [The Custom-Component Watch](#the-custom-component-watch)).

```
tap on canvas (FloatingLayer, SIMULATION mode)
  └► Project.inspectRequest$ ── InspectionService.openFor(component)
       config.inspection(component) ──► ComponentInspection (model)
       └► presenter (by breakpoint + compactPresentation)
            WindowInspectionPresenter ► WindowService (lg-window-outlet;
              desktop: floating windows — compact: the fullscreen outlet
              renders watches as takeovers)
            compact: SheetInspectionPresenter ► InspectionSheetComponent (lg-drawer, modal=false)
SimulationWorkerService onFrame ─► SimulationService.frame$ ─► inspection.onFrame()
```

---

## The Model: `ComponentInspection`

`components/component-inspection.ts` — the inspection analog of
`ComponentOption` / `ComponentAction`. A component type opts in by declaring a
factory on its config:

```ts
inspection: (component) => new RomInspection(component as RomComponent);
```

One instance is created per opened component and lives until the view closes.
The contract:

- `renderer: Type<unknown>` — the Angular component presenting the view. Every
  presenter passes the inspection itself as the renderer's `inspection` input
  (windows via `setInput`, the sheet via `*ngComponentOutlet` inputs).
- `title: Signal<string>` — live window / sheet-tab title.
- `titleParts?` — structured title segments (breadcrumbs); the window title
  bar renders them instead of the plain `title`, with `navigate`-carrying
  segments clickable. `title` stays the flat fallback (sheet tabs, aria
  labels).
- `sizing?` — desktop window size hints (initial/min/max).
- `compactPresentation?` — how the inspection presents on compact: the shared
  bottom sheet (default) or a fullscreen window (`'fullscreen'`, used by the
  watch — a canvas view needs the space).
- `onFrame?()` — refresh hook, called after every applied snapshot (and after
  `stop()`'s visual reset). Inspections re-read main-thread state here and
  update their own signals; OnPush renderers pick the changes up.
- `destroy?()` — teardown when the inspection closes.

Live data is deliberately **pull-based**: no per-link subscriptions. What an
inspection can read today is what the main thread already has — the
component's options and its per-port link power (`Component.isPortPowered`,
maintained by `LinkStateApplier`). Anything richer (RAM cells, registers)
needs a read API in `@logigator/sim` plus a worker message pair; that work
slots into `onFrame` when it exists.

## Orchestration: `InspectionService`

`inspection/inspection.service.ts`, instantiated by `AppComponent` (nothing
renders it; it must live from startup). Responsibilities:

- **Open**: `openFor(component)` — at most one inspection per component
  instance; a second tap focuses the existing view. Components whose config
  declares no `inspection` are ignored (the `FloatingLayer` already filters,
  this is defense in depth). A factory that **throws** (a watch can
  legitimately fail to open when the definition no longer matches the compiled
  board) surfaces as an error toast instead of crashing the tap.
- **Session binding**: while `WorkModeService.mode()` is `SIMULATION` it
  subscribes to the active project's `inspectRequest$`; leaving simulation
  mode closes every inspection.
- **Frame fan-out**: subscribes `SimulationService.frame$` once and calls
  every open inspection's `onFrame()`.
- **Presenter routing**: per entry — desktop always uses windows; compact uses
  the sheet, except `compactPresentation: 'fullscreen'` entries (watches),
  which stay windows on every breakpoint. A breakpoint flip mid-session
  _re-homes_ only entries whose presenter changes (window ⇄ sheet for data
  inspectors); watches keep their window entry and just get re-rendered by
  the other outlet.

## Presenters

`inspection/inspection-presenter.ts` defines the strategy interface: `show`
(with a `dismissed` callback for user-driven closes from the presenter's own
chrome), `focus`, `close` (view teardown without touching the inspection).

- **Desktop** — `WindowInspectionPresenter`: one `WindowService` window per
  inspection. The window system itself (`LgWindowOutlet`, `WindowService`,
  `WindowRef`) lives in `@logigator/ui`; the outlet sits in the board area's
  `relative` container (`z-[1000]`, under the toast stack) and doubles as the
  drag/resize bounds. Windows are non-modal — no backdrop, no focus trap —
  stack without a count limit, raise on press, close on Escape, and report
  resizes through `WindowRef.resized` (the watch canvas observes its host size
  directly instead, which covers every presenter).
- **Compact** — `SheetInspectionPresenter` (state) +
  `InspectionSheetComponent` (view): every inspection shares one bottom
  `lg-drawer` with `[modal]="false"` — no scrim and no focus trap, so the
  running circuit above stays visible and interactive. One active view at a
  time, a tab row when several are open; closing the sheet dismisses all of
  them.
- **Compact fullscreen** — the _same_ window presenter through a second,
  `fullscreen` `lg-window-outlet`: the app template swaps the outlets under
  `@if (layout.isCompact())` (exactly one is alive at a time — two live
  outlets would instantiate every window's content twice), the compact one
  wrapped `fixed inset-0 z-1050` — above the sheet overlays (z 1000), below
  the toast stack (z 1100). A fullscreen outlet renders each window as an
  outlet-filling takeover: no drag/resize/positioning, back button instead of
  ✕. Opaque takeovers stack by z-index, so with several open only the topmost
  is visible and back reveals the one beneath — or the board.

## The ROM Inspection

`components/component-types/rom/rom-inspection.ts` + renderer. The contents
are static and already on the main thread — the `data` option's packed blob,
decoded once. The only live part is the address: the engine addresses
`Σ inᵢ << i`, so input port `i` (label `A(i+1)`) is address bit `i`, and
`onFrame` folds `isPortPowered(0..addressSize-1)` into an `address` signal.

The renderer is just the hex editor (`ui/hex-editor/`) in viewer mode:

- `readOnly` — text cells (focusable, feeding the status box), no editing
  chrome (Clear, Save/Cancel).
- `highlightIndex` — the addressed word: highlighted, mapped to the byte cells
  it touches in byte view, and made the **active cell**, so the editor's own
  status box reads out the live address and value (a click can activate
  another cell until the address next changes). A **Follow** toggle keeps it
  scrolled into view.
- `scrollHeight` — `100%` fills the flexed window/sheet body (the `28rem`
  default keeps the settings-dialog layout).

## Adding an Inspection to a Component Type

1. Subclass `ComponentInspection`; read your state in `onFrame()` into
   signals.
2. Write the renderer component taking `inspection = input.required<...>()`;
   host class `h-full` so it fills window and sheet alike.
3. Declare `inspection: (c) => new MyInspection(c as MyComponent)` in the
   type's config.

Nothing else — the tap affordance, presenters, lifecycle, and frame fan-out
all key off the config declaration.

## The Custom-Component Watch

Tapping a placed custom component opens a **live canvas view of its inner
circuit** (`plans/custom-component-inspection.md`). Split between the
component layer and `inspection/watch/`:

- **`SubCircuitWatch`** (`components/custom/sub-circuit-watch.ts`) — the
  `ComponentInspection`, declared by every custom config. It owns a
  **breadcrumb stack** of `WatchLevel`s; the last level is visible. The title
  is the joined level names (`Nest › Blink`). `activate(component)` routes a
  click on the visible copy: a nested custom pushes a level, a lever/button
  triggers its engine unit (`SimulationService.triggerUnitInput`, with the
  unit index resolved through the watch index), and any other inspectable
  opens its regular data inspector **on the watch copy** — tracked per level
  and closed when its level (or the watch) goes away.
- **`WatchSession`** (`inspection/watch/watch-session.ts`) — one per level: a
  fresh headless `Project` from `instantiateBody` over the level's circuit
  body, plus a sparse `LinkStateApplier` whose targets resolve through the
  compiled board's watch index (`board.watch.infoFor(path)` — see
  `simulation.md`). It registers with the simulation's snapshot fan-out and
  requests a full seed snapshot; the first full snapshot also poses copied
  levers from their output-link power. Construction **fails loudly** if the
  body shape disagrees with the index tables.
- **`WatchRendererService`** — the single renderer shared by every watch
  canvas (page total stays at two rendering contexts). Created lazily on the
  first lease with the board's backend ladder (`webgpu` preference; the WebGL
  branch adds `multiView: true`, an off-DOM master canvas blitted per target;
  the canvas backend needs nothing), destroyed when the last lease releases.
  `render(project, canvas)` force-unculls (no `CullerPlugin` runs on manual
  renders) and scales the CSS-pixel viewport transform up to the canvas's
  DPR-sized backing store.
- **`SubCircuitWatchComponent`** — the canvas; the breadcrumb trail renders in
  the hosting header (window title bar / takeover header) via the inspection's
  `titleParts` — ancestor segments are clickable and navigate back. Pointer
  handling is **plain DOM** (the watch renderer has no event system): a press
  within the click threshold is a click (resolved against the watch project's
  quad tree), past it a pan; wheel steps the zoom; touch adds two-finger pan +
  pinch via `MultiTouchGesture`. Content is fit-and-centered when a level
  first shows; re-blits ride on the model's `render$` (engine changes), the
  project's `ticker$` (pan/zoom/theme), and host resizes.

## Future Work (see `plans/inspection.md`)

- **RAM / registers**: blocked on a `@logigator/sim` component-state read API.
