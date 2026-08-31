import { ApplicationRef, inject, Injectable } from '@angular/core';
import { Point, Rectangle } from 'pixi.js';

import { environment } from '../../environments/environment';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { SubCircuitWatch } from '../components/custom/sub-circuit-watch';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { OpenInspection } from '../inspection/inspection-presenter';
import { InspectionService } from '../inspection/inspection.service';
import { WindowInspectionPresenter } from '../inspection/window-inspection.presenter';
import { LoggingService } from '../logging/logging.service';
import { BoardSurfaceService } from '../rendering/board-surface.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import {
  serializeComponentBody,
  serializeWireBody
} from '../persistence/snapshots';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { BoardCompilerService } from '../simulation/compiler/board-compiler.service';
import { CompiledBoard } from '../simulation/compiler/compiled-board.model';
import { CompileDiagnostic } from '../simulation/compiler/compile-error';
import {
  SimulationService,
  TargetSpeedUnit
} from '../simulation/simulation.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { ThemeType } from '../theming/theme-type.enum';
import { ThemingService } from '../theming/theming.service';
import { TranslationService } from '../translation/translation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { Wire } from '../wires/wire';
import {
  ApiInfo,
  AUTOMATION_API_VERSION,
  BusyReason,
  CatalogEntry,
  CompileDiagnosticReport,
  EditOp,
  EditResult,
  ElementList,
  ElementQuery,
  FocusOptions,
  FocusTarget,
  GridPoint,
  GridRect,
  InspectionInfo,
  LibraryEntry,
  LogigatorAutomationApi,
  PerOpError,
  PortReadout,
  ProjectState,
  ScreenPoint,
  ScreenRect,
  SelectionState,
  SelectOptions,
  SelectRegion,
  SettingDescriptor,
  SettingsState,
  SimStatus,
  TabInfo,
  ViewportInfo,
  WorkModeName,
  WorkModeState
} from './automation-api.model';
import { describeCatalog } from './catalog';
import { applyEditOps } from './edit-ops';
import { buildPortLinkIndex, PortLinkIndex } from './port-index';

/** How long a snapshot-dependent call waits for a frame before giving up. */
const FRAME_WAIT_MS = 2000;

/** Clearance `focus()` keeps around its target, in grid units. */
const DEFAULT_FOCUS_PADDING = 2;

/** Zoom cap `focus()` respects, so framing one gate does not fill the screen. */
const DEFAULT_FOCUS_MAX_ZOOM = 1;

/** Contract name → mode. Simulation is absent; `sim.enter()` enters it. */
const WORK_MODES = new Map<WorkModeName, WorkMode>([
  ['pan', WorkMode.PAN],
  ['wireTool', WorkMode.WIRE_TOOL],
  ['sel', WorkMode.SELECT],
  ['selExact', WorkMode.SELECT_EXACT],
  ['erase', WorkMode.ERASE],
  ['placeComp', WorkMode.COMPONENT_PLACEMENT]
]);

/** Contract name of a mode; what {@link WORK_MODES} omits is simulation. */
function workModeName(mode: WorkMode): WorkModeName {
  for (const [name, value] of WORK_MODES) {
    if (value === mode) return name;
  }
  return 'simulation';
}

/**
 * The transport-agnostic automation facade, published as `window.__logigator`
 * by {@link install}.
 *
 * The gate is the `AUTOMATION_API` define at the single call site in
 * `AppComponent`, not a check in here: that keeps this module out of a
 * production bundle rather than merely inert inside it.
 *
 * Every call resolves the active project afresh — an import or a new-project
 * call replaces and destroys it, so no `Project` reference is ever cached.
 */
@Injectable({ providedIn: 'root' })
export class AutomationApiService {
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly componentProvider = inject(ComponentProviderService);
  private readonly persistence = inject(PersistenceService);
  private readonly compiler = inject(BoardCompilerService);
  private readonly simulation = inject(SimulationService);
  private readonly workMode = inject(WorkModeService);
  private readonly appRef = inject(ApplicationRef);
  private readonly inspection = inject(InspectionService);
  private readonly windowPresenter = inject(WindowInspectionPresenter);
  private readonly boardSurface = inject(BoardSurfaceService);
  private readonly customComponents = inject(CustomComponentService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly translation = inject(TranslationService);
  private readonly theming = inject(ThemingService);
  private readonly settings = inject(EditorSettingsService);
  private readonly logging = inject(LoggingService);

  // Port → link lookup, rebuilt whenever the compiled board's identity changes.
  private _portIndex: PortLinkIndex | null = null;
  private _portIndexBoard: CompiledBoard | null = null;

  // Inspections are identified by object identity, which does not cross the
  // boundary. Ids are minted on first read and never reused, so a stale handle
  // reports "no open inspection" rather than addressing a newer one.
  private readonly _inspectionIds = new WeakMap<OpenInspection, number>();
  private _nextInspectionId = 1;

  /**
   * Publishes the facade on `window`, after the static DI injector is set: the
   * facade builds model objects that resolve their dependencies through it.
   */
  public install(): void {
    window.__logigator = this.buildApi();
    this.logging.info(
      `automation API installed as window.__logigator (v${AUTOMATION_API_VERSION})`,
      'AutomationApiService'
    );
  }

  /**
   * The frozen facade. Methods are arrow properties so a driver may destructure
   * them without losing `this`.
   */
  public buildApi(): LogigatorAutomationApi {
    return Object.freeze({
      version: (): ApiInfo => this.version(),
      describeCatalog: (): CatalogEntry[] => this.describeCatalog(),
      getProject: (): ProjectState => this.getProject(),
      getElements: (query?: ElementQuery): ElementList =>
        this.getElements(query),
      applyEdit: (ops: EditOp[]): EditResult => this.applyEdit(ops),
      undo: (): boolean => this.undo(),
      redo: (): boolean => this.redo(),
      check: (): CompileDiagnosticReport => this.check(),
      exportProject: (): string => this.exportProject(),
      importProject: (json: string): Promise<ProjectState> =>
        this.importProject(json),
      newProject: (): ProjectState => this.newProject(),
      sim: Object.freeze({
        enter: (): Promise<SimStatus> => this.simEnter(),
        exit: (): void => this.simulation.exit(),
        play: (): void => this.simulation.play(),
        pause: (): void => this.simulation.pause(),
        step: (count?: number): Promise<SimStatus> => this.simStep(count),
        stop: (): void => this.simulation.stop(),
        status: (): SimStatus => this.simStatus(),
        setTarget: (value: number, unit: TargetSpeedUnit): void => {
          this.simulation.setTargetValue(value);
          this.simulation.setTargetUnit(unit);
        },
        setInput: (componentId: number, value: boolean): Promise<void> =>
          this.simSetInput(componentId, value),
        readPorts: (componentIds?: number[]): Promise<PortReadout[]> =>
          this.simReadPorts(componentIds)
      }),
      camera: Object.freeze({
        getViewport: (): ViewportInfo => this.getViewport(),
        pan: (delta: GridPoint): void => this.cameraPan(delta),
        setCenter: (pos: GridPoint): void => this.cameraSetCenter(pos),
        setZoom: (factor: number, center?: GridPoint): void =>
          this.cameraSetZoom(factor, center),
        zoomIn: (): void => this.requireProject().viewport.zoomIn(),
        zoomOut: (): void => this.requireProject().viewport.zoomOut(),
        zoom100: (): void => this.requireProject().viewport.zoom100(),
        focus: (target: FocusTarget, opts?: FocusOptions): ViewportInfo =>
          this.cameraFocus(target, opts),
        boardRect: (): ScreenRect => this.boardRect(),
        toScreen: (point: GridPoint): ScreenPoint => this.toScreen(point),
        toScreenRect: (rect: GridRect): ScreenRect => this.toScreenRect(rect),
        toGrid: (point: ScreenPoint): GridPoint => this.toGrid(point),
        toGridRect: (rect: ScreenRect): GridRect => this.toGridRect(rect)
      }),
      getWorkMode: (): WorkModeState => this.getWorkMode(),
      setWorkMode: (
        mode: WorkModeName,
        opts?: { componentType?: number }
      ): WorkModeState => this.setWorkMode(mode, opts),
      inspect: Object.freeze({
        open: (componentId: number): InspectionInfo =>
          this.inspectOpen(componentId),
        list: (): InspectionInfo[] => this.inspectList(),
        close: (inspectionId: number): void => this.inspectClose(inspectionId),
        closeAll: (): void => this.inspection.closeAll(),
        setBounds: (
          inspectionId: number,
          bounds: Partial<ScreenRect>
        ): ScreenRect | null => this.inspectSetBounds(inspectionId, bounds),
        getElements: (
          inspectionId: number,
          query?: ElementQuery
        ): ElementList => this.inspectGetElements(inspectionId, query),
        activate: (inspectionId: number, componentId: number): InspectionInfo =>
          this.inspectActivate(inspectionId, componentId),
        navigateTo: (inspectionId: number, level: number): InspectionInfo =>
          this.inspectNavigateTo(inspectionId, level),
        camera: Object.freeze({
          getViewport: (inspectionId: number): ViewportInfo =>
            this.getViewport(this.watchProject(inspectionId)),
          pan: (inspectionId: number, delta: GridPoint): void =>
            this.cameraPan(delta, this.watchCameraProject(inspectionId)),
          setCenter: (inspectionId: number, pos: GridPoint): void =>
            this.cameraSetCenter(pos, this.watchCameraProject(inspectionId)),
          setZoom: (inspectionId: number, factor: number): void =>
            this.cameraSetZoom(
              factor,
              undefined,
              this.watchCameraProject(inspectionId)
            ),
          focus: (
            inspectionId: number,
            target: FocusTarget,
            opts?: FocusOptions
          ): ViewportInfo =>
            this.cameraFocus(
              target,
              opts,
              this.watchCameraProject(inspectionId)
            )
        })
      }),
      tabs: Object.freeze({
        list: (): TabInfo[] => this.tabList(),
        activate: (index: number): TabInfo => this.tabActivate(index),
        close: (index: number, opts?: { discardChanges?: boolean }): void =>
          this.tabClose(index, opts)
      }),
      library: Object.freeze({
        list: (): LibraryEntry[] => this.libraryList(),
        edit: (type: number): Promise<TabInfo> => this.libraryEdit(type)
      }),
      select: (region: SelectRegion, opts?: SelectOptions): SelectionState =>
        this.select(region, opts),
      clearSelection: (): void => this.clearSelection(),
      settings: Object.freeze({
        describe: (): SettingDescriptor[] => this.settingsDescribe(),
        get: (): SettingsState => this.settingsGet(),
        set: (patch: Partial<SettingsState>): SettingsState =>
          this.settingsSet(patch)
      })
    });
  }

  // -- Discovery -----------------------------------------------------------

  public version(): ApiInfo {
    return {
      apiVersion: AUTOMATION_API_VERSION,
      editorVersion: environment.version,
      buildCommit: environment.buildCommit
    };
  }

  public describeCatalog(): CatalogEntry[] {
    return describeCatalog(this.componentProvider.allComponents(), {
      translate: (key) => this.translation.translate(key)
    });
  }

  // -- Reads ---------------------------------------------------------------

  public getProject(): ProjectState {
    const project = this.activeProject;
    const metadata = project
      ? this.metadataStore.getMetadata(project)
      : undefined;
    const bounds = project?.getContentBounds() ?? null;
    return {
      name: metadata?.name ?? '',
      id: metadata?.id ?? '',
      documentType: metadata?.type ?? 'unknown',
      source: metadata?.source ?? 'unknown',
      dirty: project ? this.metadataStore.isDirty(project) : false,
      bounds: bounds ? toGridRect(bounds) : null,
      busy: this.busyReason(),
      undoAvailable: project?.actionManager.undoAvailable ?? false,
      redoAvailable: project?.actionManager.redoAvailable ?? false,
      elements: this.getElements()
    };
  }

  public getElements(
    query: ElementQuery = {},
    project: Project | null = this.activeProject
  ): ElementList {
    if (!project) return { components: [], wires: [] };

    const componentIds = query.componentIds
      ? new Set(query.componentIds)
      : null;
    const wireIds = query.wireIds ? new Set(query.wireIds) : null;
    const types = query.types ? new Set(query.types) : null;
    const bounds = query.bounds
      ? new Rectangle(
          query.bounds.x,
          query.bounds.y,
          query.bounds.width,
          query.bounds.height
        )
      : null;

    // A bounds filter goes through the quad trees; without one every element is
    // a candidate.
    const components = bounds
      ? project.queryComponentsInRange(bounds)
      : project.components;
    const wires = bounds ? project.queryWiresInRange(bounds) : project.wires;

    const result: ElementList = { components: [], wires: [] };
    // An id list on the *other* kind means "only those": asking for wire ids
    // alone must not also return every component.
    const wantComponents = !wireIds || !!componentIds;
    const wantWires = !componentIds || !!wireIds;

    if (wantComponents) {
      for (const component of components) {
        if (componentIds && !componentIds.has(component.id)) continue;
        if (types && !types.has(component.config.type)) continue;
        result.components.push({
          id: component.id,
          ...serializeComponentBody(component)
        });
      }
    }
    if (wantWires) {
      for (const wire of wires) {
        if (wireIds && !wireIds.has(wire.id)) continue;
        result.wires.push({ id: wire.id, ...serializeWireBody(wire) });
      }
    }
    return result;
  }

  // -- Writes --------------------------------------------------------------

  /** Applies a batch as one undo step; refused, untouched, while busy. */
  public applyEdit(ops: EditOp[]): EditResult {
    const refusal = this.refuseWhenBusy('applyEdit');
    if (refusal) return refusal;
    const project = this.activeProject;
    if (!project || !Array.isArray(ops)) {
      return {
        ok: false,
        errors: [
          {
            index: -1,
            op: 'applyEdit',
            message: project ? 'ops must be an array' : 'no project is open'
          }
        ]
      };
    }
    return applyEditOps(ops, {
      project,
      provider: this.componentProvider,
      debug: (message) => this.logging.debug(message, 'AutomationApiService')
    });
  }

  /** Reverts the newest history entry; `false` when there is none (or busy). */
  public undo(): boolean {
    const project = this.busyReason() === null ? this.activeProject : null;
    if (!project?.actionManager.undoAvailable) return false;
    project.actionManager.undo();
    // A visuals-only action does not request a frame itself.
    project.triggerTicker('single');
    return true;
  }

  public redo(): boolean {
    const project = this.busyReason() === null ? this.activeProject : null;
    if (!project?.actionManager.redoAvailable) return false;
    project.actionManager.redo();
    project.triggerTicker('single');
    return true;
  }

  // -- Validation ----------------------------------------------------------

  /**
   * Compiles the active circuit and reports the blocking diagnostics; the
   * compiled board is discarded.
   */
  public check(): CompileDiagnosticReport {
    const project = this.activeProject;
    if (!project) {
      return {
        ok: false,
        diagnostics: [
          {
            kind: 'no-project',
            message: 'no project is open',
            instancePath: '',
            componentType: 0
          }
        ]
      };
    }
    return toDiagnosticReport(this.compiler.compile(project).diagnostics);
  }

  // -- Persistence ---------------------------------------------------------

  /** The active project as a current-version native file JSON string. */
  public exportProject(): string {
    return this.persistence.exportProjectToJson(this.requireProject());
  }

  /**
   * Replaces the open document with one loaded from native file JSON. The
   * result is persisted as a browser draft and the URL moves to `/local/:id`.
   */
  public async importProject(json: string): Promise<ProjectState> {
    this.assertNotBusy('importProject');
    await this.persistence.importProjectFromJson(json);
    return this.getProject();
  }

  /** Replaces the open document with an empty, unsaved draft. */
  public newProject(): ProjectState {
    this.assertNotBusy('newProject');
    this.persistence.createAndSetEmptyProject();
    return this.getProject();
  }

  // -- Simulation ----------------------------------------------------------

  /**
   * Compiles the main project and starts a session. A blocked compile comes
   * back as `state: 'inactive'` plus the diagnostics that blocked it.
   */
  public async simEnter(): Promise<SimStatus> {
    const diagnostics = await this.simulation.enter();
    const status = this.simStatus();
    return diagnostics.length > 0
      ? { ...status, diagnostics: toDiagnosticReport(diagnostics).diagnostics }
      : status;
  }

  public simStatus(): SimStatus {
    return {
      state: this.simulation.state(),
      mode: this.simulation.mode(),
      targetHz: this.simulation.targetHz(),
      measuredHz: this.simulation.measuredHz(),
      tick: this.simulation.tick()
    };
  }

  /**
   * `count` engine ticks while paused, resolved after the resulting snapshot
   * has been applied. The ticks are posted back to back and only the state
   * after the last is pulled, so settling a circuit costs one round trip.
   */
  public async simStep(count = 1): Promise<SimStatus> {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('logigator: step count must be a positive integer');
    }
    for (let tick = 0; tick < count; tick++) {
      this.simulation.step();
    }
    await this.nextFrame();
    return this.simStatus();
  }

  /**
   * Drives a lever/button to an absolute state. The engine applies the input at
   * its next tick, so the deterministic recipe is
   * `pause()` → `setInput()` → `step()` → `readPorts()`.
   */
  public async simSetInput(componentId: number, value: boolean): Promise<void> {
    if (!this.simulation.setUserInput(componentId, value)) {
      throw new Error(
        `logigator: component ${componentId} is not a user input of the running simulation`
      );
    }
    await this.nextFrame();
  }

  /**
   * Per-port powered state against a freshly pulled snapshot. Without
   * `componentIds`, every component carrying at least one mapped port.
   */
  public async simReadPorts(componentIds?: number[]): Promise<PortReadout[]> {
    const applier = this.simulation.applier;
    const board = this.simulation.board;
    if (!applier || !board) {
      throw new Error('logigator: no simulation is running');
    }
    await this.nextFrame();

    if (this._portIndexBoard !== board) {
      this._portIndex = buildPortLinkIndex(board);
      this._portIndexBoard = board;
    }
    const index = this._portIndex!;

    const ids = componentIds ?? [...index.keys()];
    const readouts: PortReadout[] = [];
    for (const id of ids) {
      const entry = index.get(id);
      if (!entry) continue;
      const { component, links } = entry;
      const powered = (portIndex: number): boolean => {
        const linkId = links[portIndex];
        return linkId !== undefined && applier.isPowered(linkId);
      };
      readouts.push({
        componentId: id,
        type: component.config.type,
        inputs: Array.from({ length: component.numInputs }, (_, i) =>
          powered(i)
        ),
        outputs: Array.from({ length: component.numOutputs }, (_, i) =>
          powered(component.numInputs + i)
        )
      });
    }
    return readouts;
  }

  /**
   * Resolves once the next engine snapshot has been applied. The snapshot is
   * requested explicitly, so this settles whether the simulation is running or
   * paused, and gives up after {@link FRAME_WAIT_MS} rather than hanging.
   */
  private nextFrame(): Promise<void> {
    if (!this.simulation.isReady()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        this.logging.warn(
          `no simulation frame within ${FRAME_WAIT_MS} ms; reading possibly stale state`,
          'AutomationApiService'
        );
        resolve();
      }, FRAME_WAIT_MS);
      const subscription = this.simulation.frame$.subscribe(() => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve();
      });
      this.simulation.requestSnapshot();
    });
  }

  // -- Camera --------------------------------------------------------------
  //
  // Visual only: never a history entry, and allowed during simulation. Agents
  // speak grid units, `ViewportController` speaks screen px, so every call
  // converts through the current zoom.

  public getViewport(project: Project = this.requireProject()): ViewportInfo {
    const state = project.viewport.viewportState;
    return {
      view: toGridRect(project.viewport.gridView(new Rectangle())),
      zoom: state.scale,
      screen: { width: state.viewportSize.x, height: state.viewportSize.y }
    };
  }

  /** Moves the camera by a grid-space delta: +x scrolls the view right. */
  public cameraPan(
    delta: GridPoint,
    project: Project = this.requireProject()
  ): void {
    const factor = project.viewport.viewportState.scale * environment.gridSize;
    project.viewport.pan(new Point(-delta.x * factor, -delta.y * factor));
    project.triggerTicker('single');
  }

  /** Centres the viewport on a grid point. */
  public cameraSetCenter(
    pos: GridPoint,
    project: Project = this.requireProject()
  ): void {
    const state = project.viewport.viewportState;
    const factor = state.scale * environment.gridSize;
    project.viewport.setPosition(
      new Point(
        state.viewportSize.x / 2 - pos.x * factor,
        state.viewportSize.y / 2 - pos.y * factor
      )
    );
    project.triggerTicker('single');
  }

  /**
   * Absolute zoom factor (1 = 100%), clamped to the editor's zoom ladder and
   * anchored on a grid point (the viewport centre by default).
   */
  public cameraSetZoom(
    factor: number,
    center?: GridPoint,
    project: Project = this.requireProject()
  ): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error('logigator: zoom factor must be a positive number');
    }
    const current = project.viewport.viewportState.scale;
    project.viewport.zoomBy(
      factor / current,
      center ? this.gridToScreen(center, project) : undefined
    );
  }

  /** Frames a target and returns the resulting viewport. */
  public cameraFocus(
    target: FocusTarget,
    options: FocusOptions = {},
    project: Project = this.requireProject()
  ): ViewportInfo {
    const rect = this.resolveFocusTarget(target, project);
    if (rect) {
      project.viewport.fitBounds(
        rect,
        options.paddingGrid ?? DEFAULT_FOCUS_PADDING,
        options.maxZoom ?? DEFAULT_FOCUS_MAX_ZOOM
      );
    }
    return this.getViewport(project);
  }

  // -- Grid ↔ screen -------------------------------------------------------
  //
  // The one place the contract leaves grid units. A driver pointing at the
  // board needs the camera's mapping *and* the canvas's page offset;
  // reproducing either outside the editor duplicates `ViewportController`.

  /** The board canvas's box in viewport CSS px. */
  public boardRect(): ScreenRect {
    const rect = this.boardSurface.rect();
    if (!rect) {
      throw new Error('logigator: no board is mounted');
    }
    return rect;
  }

  public toScreen(point: GridPoint): ScreenPoint {
    const board = this.boardRect();
    const local = this.gridToScreen(point, this.requireProject());
    return { x: board.x + local.x, y: board.y + local.y };
  }

  public toScreenRect(rect: GridRect): ScreenRect {
    const factor =
      this.requireProject().viewport.viewportState.scale * environment.gridSize;
    const origin = this.toScreen({ x: rect.x, y: rect.y });
    return {
      ...origin,
      width: rect.width * factor,
      height: rect.height * factor
    };
  }

  public toGrid(point: ScreenPoint): GridPoint {
    const board = this.boardRect();
    const state = this.requireProject().viewport.viewportState;
    const factor = state.scale * environment.gridSize;
    return {
      x: state.gridOrigin.x + (point.x - board.x) / factor,
      y: state.gridOrigin.y + (point.y - board.y) / factor
    };
  }

  public toGridRect(rect: ScreenRect): GridRect {
    const factor =
      this.requireProject().viewport.viewportState.scale * environment.gridSize;
    return {
      ...this.toGrid({ x: rect.x, y: rect.y }),
      width: rect.width / factor,
      height: rect.height / factor
    };
  }

  // -- Work mode -----------------------------------------------------------

  public getWorkMode(): WorkModeState {
    return {
      mode: workModeName(this.workMode.mode()),
      placementType: this.workMode.selectedComponentType()
    };
  }

  /** Arms a tool, exactly as the tool bar's buttons do. */
  public setWorkMode(
    mode: WorkModeName,
    options: { componentType?: number } = {}
  ): WorkModeState {
    if (mode === 'simulation') {
      throw new Error('logigator: simulation mode is entered via sim.enter()');
    }
    const target = WORK_MODES.get(mode);
    if (target === undefined) {
      throw new Error(
        `logigator: unknown work mode "${mode}" — one of ` +
          [...WORK_MODES.keys()].join(', ')
      );
    }
    if (this.workMode.mode() === WorkMode.SIMULATION) {
      throw new Error(
        'logigator: setWorkMode refused — editing is locked during simulation'
      );
    }
    const type = options.componentType;
    if (target === WorkMode.COMPONENT_PLACEMENT) {
      if (type === undefined) {
        throw new Error(
          'logigator: placeComp needs the componentType to place'
        );
      }
      if (!this.componentProvider.getComponent(type)) {
        throw new Error(`logigator: no component type ${type} in the catalog`);
      }
    } else if (type !== undefined) {
      throw new Error(
        `logigator: componentType applies to placeComp, not ${mode}`
      );
    }

    this.workMode.setMode(target);
    if (type !== undefined) {
      this.workMode.setSelectedComponentType(type);
    }
    this.flushModeSwitch();
    return this.getWorkMode();
  }

  /**
   * Runs the pending view update so the whole tool swap lands before the call
   * returns. The board picks the mode up in an effect whose `setMode` clears
   * the selection, so a caller that switched the tool and then selected
   * something would have that selection wiped a frame later — and a driver has
   * no tick of its own to wait for.
   */
  private flushModeSwitch(): void {
    this.appRef.tick();
  }

  // -- Selection -----------------------------------------------------------

  /**
   * Selects a region, exactly as picking the select tool and dragging a marquee
   * does. A zero-area `bounds` behaves like a click; `{ elementIds }` rects
   * their padded bounds like a committed paste. The work mode is switched to
   * SELECT so the selection is grabbable afterwards, and a `cut` mirrors the
   * held-scissor-key marquee, so it does not leave the tool in scissor mode.
   */
  public select(
    region: SelectRegion,
    options: SelectOptions = {}
  ): SelectionState {
    const refusal = this.busyReason();
    if (refusal) {
      throw new Error(`logigator: select refused — editor ${refusal}`);
    }
    const project = this.activeProject!;
    const selection = project.selectionManager;

    // Switching tools clears the live selection, so the swap has to be finished
    // before anything is selected.
    if (this.workMode.mode() !== WorkMode.SELECT) {
      this.workMode.setMode(WorkMode.SELECT);
      this.flushModeSwitch();
    }
    if ('bounds' in region) {
      selection.commit(
        new Rectangle(
          region.bounds.x,
          region.bounds.y,
          region.bounds.width,
          region.bounds.height
        ),
        options.cut ? WorkMode.SELECT_EXACT : WorkMode.SELECT
      );
    } else {
      if (options.cut) {
        throw new Error(
          'logigator: cut applies to a bounds region — there is no edge to cut at'
        );
      }
      const components = region.elementIds
        .map((id) => project.getComponentById(id))
        .filter((c): c is Component => !!c);
      const wires = region.elementIds
        .map((id) => project.getWireById(id))
        .filter((w): w is Wire => !!w);
      selection.select(components, wires);
    }
    if (options.rect === false) {
      selection.clearGrabRect();
    }

    project.triggerTicker('single');
    const rect = selection.grabRect();
    return {
      componentIds: [...selection.selectedComponents].map((c) => c.id),
      wireIds: [...selection.selectedWires].map((w) => w.id),
      rect: rect ? toGridRect(rect) : null,
      cut: selection.hasLiveCut
    };
  }

  /**
   * Clears the selection, like clicking empty canvas — which also retracts an
   * uncommitted scissor cut.
   */
  public clearSelection(): void {
    // A replaced document brings a fresh selection; nothing left to clear.
    const project = this.activeProject;
    if (!project) return;
    project.selectionManager.clear();
    project.triggerTicker('single');
  }

  /** Grid point → screen px within the canvas, at the current camera. */
  private gridToScreen(pos: GridPoint, project: Project): Point {
    const state = project.viewport.viewportState;
    const factor = state.scale * environment.gridSize;
    return new Point(
      (pos.x - state.gridOrigin.x) * factor,
      (pos.y - state.gridOrigin.y) * factor
    );
  }

  /** The rectangle a {@link FocusTarget} designates, `null` when it is empty. */
  private resolveFocusTarget(
    target: FocusTarget,
    project: Project
  ): Rectangle | null {
    if (target === 'content') return project.getContentBounds();
    if ('elementIds' in target) {
      return this.elementBounds(target.elementIds, project);
    }
    return new Rectangle(target.x, target.y, target.width, target.height);
  }

  /** Union of the grid bounds of the given components/wires (ids share a space). */
  private elementBounds(
    ids: readonly number[],
    project: Project
  ): Rectangle | null {
    let union: Rectangle | null = null;
    for (const id of ids) {
      const element =
        project.getComponentById(id) ?? project.getWireById(id) ?? null;
      if (!element) continue;
      const bounds = element.gridBounds;
      union = union ? unionRect(union, bounds) : bounds.clone();
    }
    return union;
  }

  // -- Inspection ----------------------------------------------------------
  //
  // A watch is a second board: its levels are fresh copies of the inner
  // circuit, so its elements carry the copy's ids and its camera is the copy
  // project's.

  /** Opens (or focuses) a component's inspection, as a tap on it would. */
  public inspectOpen(componentId: number): InspectionInfo {
    if (this.workMode.mode() !== WorkMode.SIMULATION) {
      throw new Error(
        'logigator: inspections open only while a simulation is running'
      );
    }
    const component = this.requireProject().getComponentById(componentId);
    if (!component) {
      throw new Error(
        `logigator: no component ${componentId} in this document`
      );
    }
    if (!component.config.inspection) {
      throw new Error(
        `logigator: component ${componentId} (${component.config.symbol}) is not inspectable`
      );
    }
    this.inspection.openFor(component);
    const entry = this.findInspection(component);
    if (!entry) {
      // openFor reports a failed factory through a toast and returns.
      throw new Error(
        `logigator: the inspection of component ${componentId} failed to open`
      );
    }
    return this.inspectionInfo(entry);
  }

  public inspectList(): InspectionInfo[] {
    return this.inspection.open().map((entry) => this.inspectionInfo(entry));
  }

  public inspectClose(inspectionId: number): void {
    this.inspection.close(this.requireInspection(inspectionId));
  }

  /**
   * Moves and/or resizes the hosting window, clamped to the board it floats
   * over; `null` when the inspection is in the compact sheet instead.
   */
  public inspectSetBounds(
    inspectionId: number,
    bounds: Partial<ScreenRect>
  ): ScreenRect | null {
    return this.windowPresenter.setBoundsOf(
      this.requireInspection(inspectionId),
      bounds
    );
  }

  /** The visible watch level's circuit copy. */
  public inspectGetElements(
    inspectionId: number,
    query?: ElementQuery
  ): ElementList {
    return this.getElements(query, this.watchProject(inspectionId));
  }

  /**
   * Taps a component of the visible watch level: drives an inner lever/button,
   * drills into a nested custom, or opens the component's own inspection.
   */
  public inspectActivate(
    inspectionId: number,
    componentId: number
  ): InspectionInfo {
    const watch = this.requireWatch(inspectionId);
    const component = watch
      .activeLevel()
      .session.project.getComponentById(componentId);
    if (!component) {
      throw new Error(
        `logigator: no component ${componentId} in the visible level of inspection ${inspectionId}`
      );
    }
    watch.activate(component);
    return this.inspectionInfo(this.requireInspection(inspectionId));
  }

  /** Breadcrumb navigation: pops every level deeper than `level`. */
  public inspectNavigateTo(
    inspectionId: number,
    level: number
  ): InspectionInfo {
    this.requireWatch(inspectionId).navigateTo(level);
    return this.inspectionInfo(this.requireInspection(inspectionId));
  }

  /** The project behind a watch's visible level — what its camera moves. */
  private watchProject(inspectionId: number): Project {
    return this.requireWatch(inspectionId).activeLevel().session.project;
  }

  /**
   * Same, for a camera write. A level that has not been on screen yet still
   * awaits the renderer's one-time fit, which would overwrite what is placed
   * here — so an explicit placement takes the fit's turn instead.
   */
  private watchCameraProject(inspectionId: number): Project {
    const level = this.requireWatch(inspectionId).activeLevel();
    level.needsFit = false;
    return level.session.project;
  }

  private requireWatch(inspectionId: number): SubCircuitWatch {
    const { inspection } = this.requireInspection(inspectionId);
    if (!(inspection instanceof SubCircuitWatch)) {
      throw new Error(
        `logigator: inspection ${inspectionId} is a "${inspection.kind}" view, not a sub-circuit watch`
      );
    }
    return inspection;
  }

  private requireInspection(inspectionId: number): OpenInspection {
    const entry = this.inspection
      .open()
      .find((candidate) => this._inspectionIds.get(candidate) === inspectionId);
    if (!entry) {
      throw new Error(`logigator: no open inspection ${inspectionId}`);
    }
    return entry;
  }

  private findInspection(component: Component): OpenInspection | undefined {
    return this.inspection
      .open()
      .find((entry) => entry.component === component);
  }

  private inspectionInfo(entry: OpenInspection): InspectionInfo {
    const { inspection } = entry;
    let id = this._inspectionIds.get(entry);
    if (id === undefined) {
      id = this._nextInspectionId++;
      this._inspectionIds.set(entry, id);
    }
    return {
      id,
      componentId: entry.component.id,
      componentType: entry.component.config.type,
      kind: inspection.kind,
      title: inspection.title(),
      ...(inspection instanceof SubCircuitWatch
        ? { trail: inspection.levels().map((level) => level.name) }
        : {}),
      bounds: this.windowPresenter.boundsOf(entry)
    };
  }

  // -- Documents -----------------------------------------------------------
  //
  // Switching, closing and opening a component for edit are document-level
  // state, not chrome: the same calls the tab strip and settings card make.

  public tabList(): TabInfo[] {
    const active = this.projectService.activeProject();
    return this.tabProjects().map((project, index) => {
      const metadata = this.metadataStore.getMetadata(project);
      return {
        index,
        name: metadata?.name ?? '',
        documentType: metadata?.type ?? 'unknown',
        id: metadata?.id ?? '',
        active: project === active,
        dirty: this.metadataStore.isDirty(project)
      };
    });
  }

  public tabActivate(index: number): TabInfo {
    const project = this.requireTab(index);
    this.assertNotSimulating('tabs.activate');
    this.projectService.setActiveProject(project);
    return this.tabList()[index];
  }

  /**
   * Closes a component editor. A dirty one needs `discardChanges`: the UI asks
   * the user here, and a driver has nobody to ask.
   */
  public tabClose(
    index: number,
    options: { discardChanges?: boolean } = {}
  ): void {
    const project = this.requireTab(index);
    this.assertNotSimulating('tabs.close');
    if (project === this.projectService.mainProject()) {
      throw new Error('logigator: the main project tab cannot be closed');
    }
    if (this.metadataStore.isDirty(project) && !options.discardChanges) {
      throw new Error(
        `logigator: tab ${index} has unsaved changes — pass { discardChanges: true } to close it anyway`
      );
    }
    this.customComponents.forceCloseComponent(project);
  }

  /** The strip's projects in tab order: the pinned main one, then components. */
  private tabProjects(): Project[] {
    const main = this.projectService.mainProject();
    return [...(main ? [main] : []), ...this.projectService.openComponents()];
  }

  private requireTab(index: number): Project {
    const project = this.tabProjects()[index];
    if (!project) {
      throw new Error(`logigator: no tab at index ${index}`);
    }
    return project;
  }

  /** The library masters — what the palette's User Components section lists. */
  public libraryList(): LibraryEntry[] {
    const openIds = new Set(
      this.projectService
        .openComponents()
        .map((project) => this.metadataStore.getMetadata(project)?.id)
    );
    const entries: LibraryEntry[] = [];
    for (const config of this.componentProvider.allComponents()) {
      if (config.type < CUSTOM_TYPE_ID_BASE) continue;
      const definition = this.registry.getDefinition(config.type);
      if (!definition || definition.kind !== 'master') continue;
      entries.push({
        type: definition.typeId,
        id: definition.id ?? '',
        name: definition.name,
        symbol: definition.symbol,
        source: definition.source,
        open: openIds.has(definition.id)
      });
    }
    return entries;
  }

  /**
   * Opens a custom component's circuit in its own tab, by master type id or
   * placed-instance type id. An instance whose master is gone is restored into
   * the browser library first.
   */
  public async libraryEdit(type: number): Promise<TabInfo> {
    this.assertNotBusy('library.edit');
    const definition = this.registry.getDefinition(type);
    if (!definition) {
      throw new Error(`logigator: no custom component type ${type}`);
    }
    const master = this.registry.resolveMaster(type)?.master;
    if (master?.id) {
      await this.customComponents.openComponentForEdit(master.id);
    } else {
      await this.customComponents.restoreOrphanAndEdit(type);
    }

    // Identified by the master's id rather than "some component tab is active":
    // a failed open from another component's tab would read as success. A
    // restore mints a new id, so it is resolved afterwards.
    const openedId = this.registry.resolveMaster(type)?.master.id;
    const tab = this.tabList().find(
      (candidate) => candidate.active && candidate.id === openedId
    );
    if (!tab) {
      // Both paths report their own failure through a toast and return.
      throw new Error(
        `logigator: "${definition.name}" could not be opened for editing`
      );
    }
    return tab;
  }

  // -- Editor settings -----------------------------------------------------
  //
  // Preferences, not project edits: never history entries. The boolean half is
  // enumerated from `EditorSettingsService.settings`, so a preference added
  // later shows up here on its own.

  public settingsDescribe(): SettingDescriptor[] {
    return [
      { key: 'theme', kind: 'enum', values: [...this.theming.availableThemes] },
      { key: 'language', kind: 'enum', values: this.availableLangs() },
      ...this.settings.settings.map((setting): SettingDescriptor => ({
        key: setting.key,
        kind: 'boolean',
        label: this.translation.translate(setting.labelKey)
      }))
    ];
  }

  public settingsGet(): SettingsState {
    const state: SettingsState = {
      theme: this.theming.currentThemeType(),
      language: this.translation.getActiveLang()
    };
    for (const setting of this.settings.settings) {
      state[setting.key] = setting.value();
    }
    return state;
  }

  /**
   * Applies a patch of preferences. Validated as a whole first: an unknown key
   * or an unaccepted value applies nothing.
   */
  public settingsSet(patch: Partial<SettingsState>): SettingsState {
    const booleans = new Map(
      this.settings.settings.map((setting) => [setting.key, setting])
    );
    const problems: string[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'theme') {
        if (!this.theming.availableThemes.includes(value as ThemeType)) {
          problems.push(
            `theme must be one of ${JSON.stringify(this.theming.availableThemes)}`
          );
        }
      } else if (key === 'language') {
        if (!this.availableLangs().includes(value as string)) {
          problems.push(
            `language must be one of ${JSON.stringify(this.availableLangs())}`
          );
        }
      } else if (!booleans.has(key)) {
        problems.push(`unknown setting "${key}"`);
      } else if (typeof value !== 'boolean') {
        problems.push(`setting "${key}" expects a boolean`);
      }
    }
    if (problems.length > 0) {
      throw new Error(
        `logigator: settings.set rejected — ${problems.join('; ')}`
      );
    }

    for (const [key, value] of Object.entries(patch)) {
      if (key === 'theme') {
        this.theming.setTheme(value as ThemeType);
      } else if (key === 'language') {
        this.translation.setActiveLang(value as string);
      } else {
        booleans.get(key)!.set(value as boolean);
      }
    }
    return this.settingsGet();
  }

  /** The language ids transloco accepts, normalized out of both list shapes. */
  private availableLangs(): string[] {
    return this.translation
      .getAvailableLangs()
      .map((lang) => (typeof lang === 'string' ? lang : lang.id));
  }

  // -- Shared internals ----------------------------------------------------

  /** The project every call operates on; never cached (see the class doc). */
  private get activeProject(): Project | null {
    const project = this.projectService.activeProject();
    return project && !project.destroyed ? project : null;
  }

  /**
   * Why a mutation would be refused: no project, a running simulation, or a
   * live drag session (the router locks the action manager for its whole
   * duration, including a paste/rotate group floating before its first grab).
   */
  private busyReason(): BusyReason | null {
    const project = this.activeProject;
    if (!project) return 'no-project';
    if (this.workMode.mode() === WorkMode.SIMULATION) return 'simulation';
    if (project.actionManager.locked) return 'session-active';
    return null;
  }

  /**
   * The active project, or a thrown error — for calls whose result has no room
   * for a refusal.
   */
  private requireProject(): Project {
    const project = this.activeProject;
    if (!project) throw new Error('logigator: no project is open');
    return project;
  }

  /** Throws while a simulation is up — it binds to the active project. */
  private assertNotSimulating(op: string): void {
    if (this.workMode.mode() === WorkMode.SIMULATION) {
      throw new Error(`logigator: ${op} refused — editor simulation`);
    }
  }

  /** Throws when a document-replacing call arrives while the editor is busy. */
  private assertNotBusy(op: string): void {
    const reason = this.busyReason();
    if (reason) throw new Error(`logigator: ${op} refused — editor ${reason}`);
  }

  /** The per-op error a mutating call returns while the editor is busy. */
  private refuseWhenBusy(
    op: string
  ): { ok: false; errors: PerOpError[] } | null {
    const reason = this.busyReason();
    return reason
      ? {
          ok: false,
          errors: [{ index: -1, op, message: `editor busy: ${reason}` }]
        }
      : null;
  }
}

/** Compile diagnostics → the JSON report the contract uses. */
export function toDiagnosticReport(
  diagnostics: readonly CompileDiagnostic[]
): CompileDiagnosticReport {
  return {
    ok: diagnostics.length === 0,
    diagnostics: diagnostics.map((d) => ({
      kind: d.kind,
      message: d.message,
      instancePath: d.instancePath,
      componentType: d.componentType,
      ...(d.componentId !== undefined ? { componentId: d.componentId } : {})
    }))
  };
}

/** The smallest rectangle covering both inputs. */
function unionRect(a: Rectangle, b: Rectangle): Rectangle {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return new Rectangle(
    x,
    y,
    Math.max(a.right, b.right) - x,
    Math.max(a.bottom, b.bottom) - y
  );
}

/** Pixi `Rectangle` → the JSON rect the contract uses. */
export function toGridRect(rect: Rectangle): GridRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}
