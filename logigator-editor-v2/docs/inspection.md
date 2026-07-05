# Live Component Inspection

Inspecting a component's data while the simulation runs: tapping an
inspectable component in `SIMULATION` mode opens a live view of it — a
floating, draggable window over the board on desktop, a shared non-modal
bottom sheet on compact. The first (and currently only) inspectable type is
the ROM, whose view is the read-only hex editor with the currently addressed
word highlighted.

```
tap on canvas (FloatingLayer, SIMULATION mode)
  └► Project.inspectRequest$ ── InspectionService.openFor(component)
       config.inspection(component) ──► ComponentInspection (model)
       └► presenter (by breakpoint)
            desktop: WindowInspectionPresenter ─► WindowService (lg-window-outlet)
            compact: SheetInspectionPresenter ──► InspectionSheetComponent (lg-drawer, modal=false)
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
- `sizing?` — desktop window size hints (initial/min/max).
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
  this is defense in depth).
- **Session binding**: while `WorkModeService.mode()` is `SIMULATION` it
  subscribes to the active project's `inspectRequest$`; leaving simulation
  mode closes every inspection.
- **Frame fan-out**: subscribes `SimulationService.frame$` once and calls
  every open inspection's `onFrame()`.
- **Presenter routing**: `LayoutService.isCompact()` picks the presenter, and
  a breakpoint flip mid-session _re-homes_ open inspections live — windows
  become sheet tabs and back.

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
  resizes through `WindowRef.resized` (the future canvas watch re-renders on
  it).
- **Compact** — `SheetInspectionPresenter` (state) +
  `InspectionSheetComponent` (view): every inspection shares one bottom
  `lg-drawer` with `[modal]="false"` — no scrim and no focus trap, so the
  running circuit above stays visible and interactive. One active view at a
  time, a tab row when several are open; closing the sheet dismisses all of
  them.

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

## Future Work (see `plans/inspection.md`)

- **Custom-component watch**: a live canvas view of a custom instance's inner
  circuit as a second content kind (desktop window / compact fullscreen). The
  compiler's per-instance-path `LinkMapping` entries are the missing piece;
  all watch canvases will share **one** WebGL context via a `multiView`
  renderer.
- **RAM / registers**: blocked on a `@logigator/sim` component-state read API.
