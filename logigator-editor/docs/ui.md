# UI Layer

`src/app/ui/` holds the Angular chrome around the PixiJS canvas: the bars,
panels, sheets and dialogs. None of it contains circuit logic — components read
signal services and delegate every mutation back to them. Most files carry a
class-level doc comment; this page is the map, not a per-component reference.

## App shell

`AppComponent` composes the whole viewport and branches on
`LayoutService.isCompact()`. One `<app-board>` canvas serves every breakpoint;
only the chrome around it swaps.

| Region       | Regular (`!isCompact`)                                         | Compact                                                               |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Top          | `app-title-bar` + `app-tool-bar`                               | `app-mobile-top-bar`                                                  |
| Left         | `app-side-bar` in a scrollable `aside` (hidden in SIMULATION)  | palette/ports reached as sheets                                       |
| Board column | `app-tab-bar`, board, `app-status-bar`                         | `app-tab-bar`, board, sim controls when running                       |
| Over canvas  | scissor toggle, component settings + toast, bug badge, minimap | mobile status pill, tool HUD, selection bar, zoom FAB, badge, minimap |
| Inspection   | `lg-window-outlet` in the board area                           | non-modal `app-inspection-sheet` + a fullscreen `lg-window-outlet`    |

Exactly one window outlet is alive at a time, so a watch re-homes on a
breakpoint flip. `LayoutService` keeps `isCompact` (layout) and `isTouch`
(input capability) deliberately separate — a touch laptop is one, a narrow
desktop window the other; there is no `isMobile`. The compact sheets are
`lg-drawer`s (palette, component settings, ports, account, project menu) driven
by `MobileUiService.activeSheet()`, which allows one open at a time; overlay
stacking uses the named z-bands from `@logigator/ui`'s `layers.css`.

`AppComponent` calls `setStaticDIInjector(injector)` before anything else in its
constructor: the services it goes on to touch construct model objects
(`Project`, `Component`) that resolve dependencies through the static injector.

## Cross-cutting patterns

- **Standalone + signals** throughout; the app is zoneless. Every widget comes
  from `@logigator/ui`.
- **Tailwind first.** Write custom CSS only for what a utility cannot express,
  and prefer the semantic colour aliases (`bg-content`, `text-muted`,
  `border-border`) — fixed `surface-N` steps are not theme-adaptive.
- **Typed translations.** User-facing strings go through
  `*appTranslate="let t"` / `t('key')` (`TranslateDirective`), whose `t` accepts
  only declared keys with exactly that key's params, so a typo or a missing
  param fails the build. Imperative call sites inject `TranslationService`;
  nothing outside `translation/` touches `TranslocoService`, and an ESLint rule
  keeps transloco's own untyped directive and pipe out of the app.
- **Phosphor icons** as `ph ph-<name>` classes.
- **Dialog telemetry.** Every `DialogService.open` passes a `telemetryId` from
  the `DialogId` registry (`analytics/analytics.mapping.ts`); `@logigator/ui`
  reports open and close through `LG_DIALOG_TELEMETRY`, bound to
  `AnalyticsService` by `provideDialogAnalytics()`, so an abandoned dialog is
  still measured. A dialog with no id is silently unreported, and
  `dialog_closed.resolved` says only that a result came back — completion stays
  with the specific events. Drawer sheets and inspection windows are
  deliberately uninstrumented.
- **Legacy-editor hand-off.** `LegacyEditorService.open(source)` is the only
  place that names `/legacy-editor`; it reports `legacy_editor_opened` first.
  Surfaces render a control, never an `<a href>`: a link's context menu leaves
  the app without passing any handler, and measuring users who give up here is
  the point of the event.

### Shared language and theme

Both live in the origin-wide `preferences` cookie, not in editor storage: the
editor is served under `/editor` beside the backend's pages, which write the
same cookie. A switch on either side moves both, and `preferences.lang` also
drives the backend's redirect targets and transactional-email language.
`PreferencesService` (`storage/preferences.service.ts`) is the sole reader and
writer — it owns express' `j:`+JSON encoding and patches single fields, so
neither side clears a field it does not own. Language reaches it through
`provideTranslocoPersistLang`'s storage
(`translation/preferences-lang.storage.ts`, `storageKey: 'lang'`), theme through
`ThemingService`.

Neither value can be trusted on read: the cookie is client-writable and the
server's language and theme sets need not match the editor's, so
`isAvailableLanguage` and the theme table gate every read. Those fallbacks are
load-bearing — the static bundle is served ahead of the middleware that writes
the cookie, so a visitor whose first request is `/editor/` arrives without one.
Their language is negotiated over the whole `Accept-Language` list
(`negotiateBrowserLanguage`, then `defaultLang`; theme falls back to dark),
matching what the server would pick, so the two agree once a page view
establishes the cookie. The editor writes only on a real switch, and only that
one field: establishing and repairing the cookie is the server's job.

## `BoardComponent`

`board/board.component.ts` — the only component that straddles the
Angular/PixiJS boundary. It hosts one `<canvas>` and draws the active project
through the app-wide shared renderer (`RendererService`, see
[`rendering.md`](rendering.md)), owning just what is per-canvas: the render
ticker, the cull pass, the viewport size and the input wiring. Its renderer
lease is held until teardown, which is what boots and later destroys the shared
renderer. All canvas input runs through the `PointerController` it creates;
PixiJS event features are off entirely.

An effect pushes `project` input changes into `projectChange$`: each new project
re-homes the `WorkModeRouter`, resizes the viewport, and gets a fresh
`TickerScheduler` over `project.ticker$` (`'single'` renders one frame, `'on'`
runs continuously, `'off'` renders once more and stops). Subscriptions are
scoped to `takeUntil(merge(destroy$, projectChange$))`.

## Desktop chrome

| Component            | Role                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TitleBarComponent`  | Logo, the `lg-menubar` fed by `EditorMenuService.items`, inline rename (real projects only, not component editors or read-only shares), source indicator, account menu                                                |
| `ToolBarComponent`   | File/clipboard/history/rotate/zoom buttons plus the shared `createWorkModeTools` descriptors; swaps wholesale to `app-simulation-controls` in SIMULATION. `EditorCommandStateService` disables the no-op-able buttons |
| `SideBarComponent`   | The `aside` content: ports panel first while editing a component, then the palette                                                                                                                                    |
| `TabBarComponent`    | Pinned main project plus one tab per open component editor, over the generic `LgTabStrip`; inert during simulation                                                                                                    |
| `StatusBarComponent` | Work mode (with the live scissor key hint), cursor position, dirty state, selection count                                                                                                                             |

`EditorMenuService` builds both menu models from one set of per-item builders —
the File/Edit/View/Help tree for the menubar and the curated flat
`compactItems` for the mobile sheet — so every command is defined once. The
Debug menu is appended only while `DebugMenuToggleService.enabled()`; that
service holds no dependencies, so `DebugMenuService` and everything its commands
inject stay unconstructed until the `window.__logigatorDebug()` console command
switches the menu on.

## Compact chrome

`MobileTopBarComponent` (avatar, project title, undo/redo/save/run),
`ToolHudComponent` (every tool plus Parts and, in a component editor, Ports),
`SelectionActionBarComponent` (clipboard actions, staying up in a paste-only
form while the clipboard holds something), `MobileStatusComponent`,
`ZoomFabComponent`, and `MobileProjectMenuComponent` — the flat editor action
list, wrapped in `withSheetClose` so every command dismisses its sheet first and
a dialog lands on an uncovered board.

## Shared panels

- `ComponentListComponent` — the palette: search field over `LgAccordion`
  category panels with count badges, empty categories dropped while searching.
  Ports is present only in a component editor. Tiles render `comp.symbol`, or
  the mini-shape `ComponentSymbolComponent` paints from the config's SVG path
  data for built-ins whose canvas body is a shape rather than text.
- `ComponentSettingsComponent` — a fixed direction row (`lg-select-button` over
  first-class `direction`, not an option) plus one renderer per option via
  `*ngComponentOutlet`, so it owns no per-option chrome (see
  [`component-options.md`](component-options.md)). It shows the placement ghost
  while placing, otherwise the selected component, and the two commit
  differently: the ghost writes directly (the eventual `AddComponentsAction`
  captures the final values) and sets the sticky per-type placement direction,
  a placed component routes through `ChangeOptionAction` and
  `project.requestSelectionRotation`. Hidden during simulation.
- `PortsPanelComponent` — a live view of the open component editor's
  INPUT/OUTPUT plugs; drag to reorder (`ReorderPlugsAction`), edit a label
  inline (`ChangeOptionAction`), both undoable.
- `SourceIndicatorComponent` — provenance chip or tile badge for the five
  states (`server`, `browser`, `draft`, `share`, `embedded`).
- `HexEditorComponent` — generic packed-buffer editor, also the read-only live
  ROM viewer during inspection. `SimulationControlsComponent` is shared by the
  desktop tool bar and the mobile sim bar; `MinimapComponent` and
  `FpsCounterComponent` are board overlays.

## Dialogs

`dialogs/` holds the `DialogService` contents (About, Changelog, Close Tab,
Documentation, Edit Component Details, Export Image, Logout, New Component,
Open Project, Save Project, Share, Upload), each with its own doc comment. The
convention throughout: a dialog **collects input only** and closes with a typed
result or `undefined`, leaving the work to the caller, and dismissing is always
the safe default.

`DocumentationDialogComponent`, the in-editor documentation viewer, is opened
only through `DocumentationService.open(pageId?, anchor?)`. Desktop puts an
`lg-navigation` topic tree beside an `lg-markdown` pane; compact goes fullscreen
(`DialogConfig.fullscreen` bound to `LayoutService.isCompact`, live across
flips) and drills down instead. `lg-markdown` handles heading anchors and web
links itself; the dialog claims only `docs:<page-id>[#anchor]` hrefs
(`parseDocsLink`, in `@logigator/docs`). The pages, their screenshots and the
tree they hang in are that member's; `documentation/docs-pages.ts` is the
editor's own half — the hashed markdown URL per page and language, and the
title key each id is shown under.

The shell hosts two confirm targets: the keyless `<lg-confirm-dialog />` is the
generic modal confirm, `<lg-confirm-popup key="inline" />` the anchored one —
callers opt into the popup with `confirm({ key: 'inline', target })`.
`DiscardChangesService` gates anything that replaces the main project.

## `SaveCoordinatorService`

`save-coordinator.service.ts` — the single entry point for **Save**, shared by
the title bar, tool bar, mobile top bar and Ctrl+S. `requestSave(project)`
routes three ways:

- A **never-saved draft** (`type:'project'`, `source:'browser'`, empty id)
  prompts `SaveProjectDialogComponent` for a name and destination. Local goes to
  `PersistenceService.saveDraftAsLocal`; server goes to
  `UploadCoordinatorService` as a `draft-to-server` upload so embedded local
  components are promoted and linked.
- A **server document** holding a _promotable_ local custom component goes to
  `UploadCoordinatorService` as `save-server` — a cloud document may only
  contain cloud components. An orphan (no `masterTypeId`) cannot be promoted,
  rides along as an embedded copy, and does not force the dialog.
- Everything else already persisted goes straight to
  `PersistenceService.saveProject`.

Closing a dirty tab prompts Save / Discard / Cancel via
`CloseTabDialogComponent`, whose Save branch runs the same promote-then-save.

Errors are toasted centrally here (already-toasted guard rejections are
swallowed), so call sites just `void requestSave(project)`. The service lives in
`ui/` because it orchestrates a dialog; persistence stays UI-free. The promotion
mechanics behind the two upload detours are
[`dependencies-and-promotion.md`](dependencies-and-promotion.md).

## `UploadCoordinatorService`

`upload/upload-coordinator.service.ts` — the single entry point for moving
anything local to the cloud; projects and components share one pipeline. Analyze
the embedded local dependencies, prompt with `UploadDialogComponent` for
visibility, upload children before parents (so each later upload resolves its
already-promoted children through the serialize-time id rewrite), then the
target. `requestUpload(target)` takes a discriminated `UploadTarget` (`project`,
`stored-project`, `component`, `draft-to-server`, `save-server`), owns every
upload toast (the `PersistenceService` primitives are silent), and resolves
`true` once the target committed so list callers can refresh. A failure stops
the sequence and leaves everything not yet uploaded untouched, so a retry simply
re-analyzes.

Reached from the File menu, the Open dialog's per-row cloud button, the
component-actions Upload button, and `SaveCoordinatorService`. Ordering,
id-aliasing and the API contract are in
[`dependencies-and-promotion.md`](dependencies-and-promotion.md).
