# UI Layer

The `ui/` directory contains Angular component wrappers that frame the PixiJS canvas and provide the editor's interactive panels. These components do not contain circuit logic — they read from shared signal services and delegate circuit state mutations to those services.

## Directory Layout

```
src/app/ui/
├── board/
│   ├── board.component.ts       # PixiJS Application host — the canvas bridge
│   └── board.component.html
├── component-settings/
│   ├── component-settings.component.ts   # Dynamic option form for a selected component type
│   └── component-settings.component.html
├── side-bar/
│   ├── side-bar.component.ts    # Left panel with search and component palette
│   ├── side-bar.component.html
│   └── component-list/
│       ├── component-list.component.ts   # One category grid within the palette
│       └── component-list.component.html
├── status-bar/
│   ├── status-bar.component.ts  # Bottom bar: mode, position, save state, selection count
│   └── status-bar.component.html
├── title-bar/
│   ├── title-bar.component.ts   # Top application bar with logo and menu bar
│   └── title-bar.component.html
└── tool-bar/
    ├── tool-bar.component.ts    # Icon buttons that switch the active work mode
    └── tool-bar.component.html
```

---

## App Shell Composition

`AppComponent` (`app.component.ts`) assembles all six UI components into a single full-viewport layout:

```
┌──────────────────────────────────────────────┐
│  app-title-bar  (h-12, bg-primary)           │
├──────────────────────────────────────────────┤
│  app-tool-bar   (flex-wrap row of buttons)   │
├────────────────┬─────────────────────────────┤
│                │  app-board  (grow, relative) │
│  app-side-bar  │  ┌── floating p-card ──────┐│
│  (w-80)        │  │  app-component-settings ││
│                │  └─────────────────────────┘│
│                ├─────────────────────────────┤
│                │  app-status-bar             │
└────────────────┴─────────────────────────────┘
```

The root host uses `display: flex; flex-direction: column; width: 100vw; height: 100vh`.

`AppComponent` owns two pieces of shared state:

- `boardPosition: signal<Point>` — receives the `(positionChange)` output from `BoardComponent` and passes it down to `StatusBarComponent` via input binding.
- `componentSettings: computed<ComponentConfig | null>` — mirrors `WorkModeService.selectedComponentConfig()`. When non-null, a `p-card` is absolutely positioned in the bottom-right corner of the board and hosts `ComponentSettingsComponent`.

`AppComponent` also calls `setStaticDIInjector(injector)` during construction to bootstrap the static DI escape hatch used by model classes that are instantiated with plain `new` (see CLAUDE.md).

---

## Cross-cutting Patterns

All UI components share these conventions:

- **Standalone + OnPush** — every component declares `standalone: true` (implicit in Angular 21) and uses `ChangeDetectionStrategy.OnPush`. Reactivity flows entirely through Angular signals.
- **Signal API** — inputs use `input<T>()`, outputs use `output<T>()`, derived values use `computed()`, local mutable state uses `signal()`.
- **PrimeNG** — all interactive widgets come from PrimeNG v19 (`p-button`, `p-menubar`, `p-card`, `p-select`, `p-inputNumber`, `p-selectButton`, `p-tooltip`, `p-divider`, `p-iconfield`, `p-inputicon`, `p-inputText`).
- **Tailwind** — layout, spacing, borders, and opacity utilities via Tailwind 4. Prefer Tailwind utility classes over custom CSS at all times. Write custom CSS only when a style genuinely cannot be expressed as a utility class (e.g., complex pseudo-element rules or `:host` block-display overrides).
- **Transloco** — all user-facing strings go through `*transloco="let t"` / `t('key')`. Components inject `TranslocoService` only when they need to read translations imperatively (e.g., building `MenuItem` arrays for PrimeNG menus).
- **Phosphor icons** — icon classes follow the `ph ph-<name>` pattern from the Phosphor icon font.
- **Shared signal stores** — `WorkModeService` and `ProjectService` are the two root-provided signal stores that connect the UI components without prop-drilling through `AppComponent`.

---

## Components

### `BoardComponent`

**File:** `board/board.component.ts`

The PixiJS bridge. Hosts a single `<canvas>` element and owns the `Application` instance. All other UI components are Angular; this one straddles the Angular/PixiJS boundary.

**Inputs / Outputs**

| Name             | Direction | Type              | Purpose                                                                                    |
| ---------------- | --------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `project`        | input     | `Project \| null` | The active project to display. Swapped into `app.stage` on change.                         |
| `positionChange` | output    | `Point`           | Emits the current grid position whenever the viewport pans. Throttled to 33 ms (≈ 30 fps). |

**Initialization (`ngOnInit`)**

1. Calls `AssetsService.init()` to preload the Roboto font via `pixi.js Assets`.
2. Inside `NgZone.runOutsideAngular`, initializes the `Application` with:
   - `canvas` bound to `#canvas` (ViewChild, `static: true`)
   - `resizeTo` the host element, so it auto-resizes with the container
   - `preference: 'webgpu'` (falls back to WebGL automatically)
   - `antialias: true`, `autoStart: false`, `autoDensity: true`
   - `resolution: window.devicePixelRatio || 1`
   - `backgroundColor` from `ThemingService.currentTheme().background`
   - `powerPreference: 'high-performance'`
3. Sets `loaded` signal to `true`, making the canvas visible (it starts at `opacity-0` to avoid a flash before PixiJS is ready).
4. Attaches a `renderer.on('resize')` listener that forwards the new dimensions to `project.resizeViewport()`.

**Project swapping**

An Angular `effect` watches the `project` input and pushes changes into a `projectChange$` subject. On each new non-null project:

- Calls `project.resizeViewport(renderer.width, renderer.height)`.
- Assigns `app.stage = project` (the `Project` is a PixiJS `Container`).
- Calls `app.ticker.update()` to force a single frame.
- Emits the initial `positionChange`.
- Subscribes to `project.positionChange$` for subsequent pan events.
- Subscribes to `project.ticker$` to control the render loop:
  - `'single'` — run one frame with `ticker.update()`
  - `'on'` — start the continuous ticker
  - `'off'` — run one final frame and stop

A second `effect` synchronizes `WorkModeService.mode()` and `WorkModeService.selectedComponentConfig()` onto the project (`project.mode`, `project.componentToPlace`) whenever either changes.

All subscriptions are scoped to `takeUntil(merge(destroy$, projectChange$))` so they clean up when the project is replaced or the component is destroyed.

**Cleanup (`ngOnDestroy`)**

Completes `destroy$` and calls `app.destroy()` if the app was fully initialized.

---

### `TitleBarComponent`

**File:** `title-bar/title-bar.component.ts`

The horizontal application bar at the top. Contains the logo (links to `/`) and a PrimeNG `p-menubar` that spans the remaining width.

The menu model is a `Signal<MenuItem[]>` built by `generateMenuItems()` and re-derived reactively whenever `TranslocoService.events$` emits (i.e., on language change). Current menu structure:

- **File** — New Project, New Component, _(separator)_, Open, Save, Export File, _(separator)_, Generate Image
- **Edit** — Undo, Redo, _(separator)_, Cut, Copy, Paste, _(separator)_, Delete
- **View** — (no items yet)
- **Help** — (no items yet)

Most file menu items are stubs — only `newProject` has a handler (currently logs to `LoggingService`). Edit menu items (Cut, Copy, Paste, Delete, Undo, Redo) are wired to `ClipboardService` and `ActionManager`. The `p-menubar` uses `[autoDisplay]="false"` so submenus open only on click, not hover.

The logo `<img>` uses Angular's `NgOptimizedImage` directive (`[ngSrc]`) with the `hashed` pipe, which appends a content hash to the URL for cache-busting.

---

### `ToolBarComponent`

**File:** `tool-bar/tool-bar.component.ts`

A horizontal row of icon-only `p-button` elements (severity `secondary`, tooltips on bottom) that switch the active work mode via `WorkModeService.setMode()`.

Button groups (separated by `p-divider`):

1. **File actions** — Save, Open, New Component (Save delegates to `PersistenceService`; Open and New Component are stubs)
2. **Clipboard** — Copy, Cut, Paste, Delete (wired to `ClipboardService`)
3. **History** — Undo, Redo (wired to `ActionManager`)
4. **Zoom** — Zoom Out, Zoom In (stubs)
5. **Drawing tools** — Place Wires, Connect Wires, Select, Select Exact, Erase, Place Text

Each drawing-tool button has a `[styleClass]` bound to a `computed()` that returns `'bg-bluegray-300'` when its corresponding `WorkMode` is active, providing a visual active state.

Clicking any drawing-tool button calls `WorkModeService.setMode(mode)`. Because `setMode` clears `selectedComponentType` for any mode other than `COMPONENT_PLACEMENT`, activating a drawing tool also implicitly deselects any component chosen in the palette — which causes the floating `component-settings` card to disappear.

---

### `SideBarComponent`

**File:** `side-bar/side-bar.component.ts`

The left panel. Contains a search field and two `ComponentListComponent` instances — one for the `basic` category, one for `advanced`. Component lists are populated by `ComponentProviderService.basicComponents` and `ComponentProviderService.advancedComponents`.

The search field binds to a local `searchText: string` property (two-way via `ngModel`) and passes the value as an input to each `ComponentListComponent`. Filtering by search text is the responsibility of the child list component.

---

### `ComponentListComponent`

**File:** `side-bar/component-list/component-list.component.ts`

Renders a labeled grid of component tiles for one category. Used exclusively inside `SideBarComponent`.

**Inputs**

| Name         | Type                | Purpose                                                               |
| ------------ | ------------------- | --------------------------------------------------------------------- |
| `headline`   | `string`            | Category label shown in the section header                            |
| `components` | `ComponentConfig[]` | The component configs to display                                      |
| `searchText` | `string`            | Passed in from parent (filtering not yet implemented in the template) |

Each tile shows `comp.symbol` in a 64×64 bordered box and `t(comp.name)` below it. The tile with `selectedComponent() === comp.type` receives a `bg-white/20` highlight.

Clicking (or pressing Enter on) a tile calls `selectComponent(config)`, which:

1. Calls `workModeService.setMode(WorkMode.COMPONENT_PLACEMENT)`.
2. Calls `workModeService.setSelectedComponentType(config.type)`.

`selectedComponent` is a `computed` that reads `WorkModeService.selectedComponentType()` and checks whether it matches any tile in the current list — if the active type is not in this list the computed returns `null`, so only the correct list highlights its tile.

---

### `StatusBarComponent`

**File:** `status-bar/status-bar.component.ts`

A thin bar at the bottom of the board column. Displays four segments separated by border dividers:

| Segment         | Content                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work mode       | Translated work-mode string, e.g. `"Draw Wire"`. Includes selected component name for `COMPONENT_PLACEMENT`.                                          |
| Board position  | `−x, −y` in grid units (negated because the viewport pans opposite to the stage position). Updated via the `boardPosition` input from `AppComponent`. |
| Save state      | Static `t('statusBar.saved')` (save integration not yet implemented).                                                                                 |
| Selection count | Static `"Selected: 0"` (selection integration not yet implemented).                                                                                   |

**Inputs**

| Name            | Type    | Purpose                                                   |
| --------------- | ------- | --------------------------------------------------------- |
| `boardPosition` | `Point` | Current grid-space viewport origin; defaults to `(0, 0)`. |

`boardPositionFormatted` is a `computed` that formats the point as `"x, y"` with `Math.round`.

`workMode` is a `computed` that derives the translation key `statusBar.modes.<workModeValue>` from `WorkModeService.mode()`.

---

### `ComponentSettingsComponent`

**File:** `component-settings/component-settings.component.ts`

A thin loop rendered inside the floating `p-card` in `AppComponent` when a component type is selected for placement. It receives a flat array of `ComponentOption` instances and instantiates one renderer per option via `*ngComponentOutlet="option.renderer; inputs: { option }"` — each `ComponentOption` subclass declares its own renderer component, so this component owns no per-option chrome. See [`component-options.md`](component-options.md) for the option/renderer contract.

**Input**

| Name     | Type                | Purpose                                                |
| -------- | ------------------- | ------------------------------------------------------ |
| `config` | `ComponentOption[]` | Live option instances owned by the component-to-place. |

---

## Service Dependencies

| Service                    | Consumers                                                                                            | Role                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `WorkModeService`          | `BoardComponent`, `ToolBarComponent`, `ComponentListComponent`, `StatusBarComponent`, `AppComponent` | Single source of truth for the active `WorkMode` and the selected `ComponentType`.        |
| `ProjectService`           | `AppComponent`, `TitleBarComponent`, `ToolBarComponent`                                              | Holds the active `Project`; `AppComponent` passes it into `BoardComponent`.               |
| `ClipboardService`         | `TitleBarComponent`, `ToolBarComponent`                                                              | Copy/cut/paste/delete operations; serializes selected elements and drives paste sessions. |
| `ComponentProviderService` | `SideBarComponent`, `StatusBarComponent`                                                             | Registry lookup — provides component lists by category and config by type.                |
| `ThemingService`           | `BoardComponent`                                                                                     | Supplies the background color for the PixiJS renderer at init time.                       |
| `AssetsService`            | `BoardComponent`                                                                                     | Preloads PixiJS assets (Roboto font) before the application renders.                      |
| `TranslocoService`         | `TitleBarComponent`                                                                                  | Imperative translation needed to build `MenuItem[]` objects for `p-menubar`.              |

---

## Testing

All seven components have a smoke-test spec (e.g., `board.component.spec.ts`) that uses `TestBed` with `appConfig.providers` and asserts the component creates without error. There are no behavioral or interaction tests in the UI layer at this time.
