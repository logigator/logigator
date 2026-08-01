import { inject, Injectable } from '@angular/core';
import { Point, Rectangle } from 'pixi.js';

import { environment } from '../../environments/environment';
import { ComponentProviderService } from '../components/component-provider.service';
import { LoggingService } from '../logging/logging.service';
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
  HighlightRegion,
  LogigatorAutomationApi,
  PerOpError,
  PortReadout,
  ProjectState,
  SettingDescriptor,
  SettingsState,
  SimStatus,
  ViewportInfo
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

/**
 * The transport-agnostic automation facade: a semantic, JSON-in/JSON-out view
 * of the editor for scripts and agents. {@link install} publishes it as
 * `window.__logigator`, gated by `environment.debug.automationApi` — nothing is
 * installed in production.
 *
 * Everything here targets the **active** project, resolved per call: an import
 * or a new-project call replaces the main slot (and destroys the old project),
 * so the facade never caches a `Project` reference.
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
  private readonly translation = inject(TranslationService);
  private readonly theming = inject(ThemingService);
  private readonly settings = inject(EditorSettingsService);
  private readonly logging = inject(LoggingService);

  public readonly enabled = environment.debug.automationApi;

  // Port → link lookup for the current compiled board, rebuilt whenever the
  // board identity changes (one per simulation session).
  private _portIndex: PortLinkIndex | null = null;
  private _portIndexBoard: CompiledBoard | null = null;

  /**
   * Publishes the facade on `window` when enabled. Called once at startup,
   * after the static DI injector is set — the facade builds model objects
   * (`Project`, `Component`), which resolve their dependencies through it.
   */
  public install(): void {
    if (!this.enabled) return;
    window.__logigator = this.buildApi();
    this.logging.info(
      `automation API installed as window.__logigator (v${AUTOMATION_API_VERSION})`,
      'AutomationApiService'
    );
  }

  /**
   * The frozen facade object. Methods are arrow properties so a driver may
   * destructure them (`const { getProject } = window.__logigator`) without
   * losing `this`.
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
        step: (): Promise<SimStatus> => this.simStep(),
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
          this.cameraFocus(target, opts)
      }),
      highlight: (regions: HighlightRegion[]): void => this.highlight(regions),
      clearHighlights: (): void => this.clearHighlights(),
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
      translate: (key) => this.translation.translate(key),
      warn: (message) => this.logging.warn(message, 'AutomationApiService')
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

  public getElements(query: ElementQuery = {}): ElementList {
    const project = this.activeProject;
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
    // a candidate. Id/type filters then narrow whichever set that produced.
    const components = bounds
      ? project.queryComponentsInRange(bounds)
      : project.components;
    const wires = bounds ? project.queryWiresInRange(bounds) : project.wires;

    const result: ElementList = { components: [], wires: [] };
    // An explicit id list on the *other* kind means "only those elements" —
    // asking for wire ids alone must not also return every component.
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

  /**
   * Applies a batch of edits as exactly one undo step. Refused (nothing
   * touched) while the editor is busy — see {@link BusyReason}.
   */
  public applyEdit(ops: EditOp[]): EditResult {
    const refusal = this.refuseWhenBusy('applyEdit');
    if (refusal) return refusal;
    if (!Array.isArray(ops)) {
      return {
        ok: false,
        errors: [
          { index: -1, op: 'applyEdit', message: 'ops must be an array' }
        ]
      };
    }
    return applyEditOps(ops, {
      project: this.activeProject!,
      provider: this.componentProvider,
      debug: (message) => this.logging.debug(message, 'AutomationApiService')
    });
  }

  /** Reverts the newest history entry; `false` when there is none (or busy). */
  public undo(): boolean {
    const project = this.busyReason() === null ? this.activeProject : null;
    if (!project?.actionManager.undoAvailable) return false;
    project.actionManager.undo();
    // See the frame request in `applyEditOps`: a visuals-only action does not
    // request one itself.
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
   * Compiles the active circuit and reports the blocking diagnostics, so an
   * agent can validate a design without entering simulation. Read-only: the
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
   * Replaces the open document with one loaded from native file JSON (a `.lgix`
   * payload's inner JSON, or a legacy `logigator-editor` export). Like the file
   * import in the UI, the result is persisted as a browser draft and the URL
   * moves to `/local/:id`.
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
   * Compiles the main project and starts a session, resolving once the engine
   * is up. A blocked compile comes back as `state: 'inactive'` plus the
   * diagnostics that blocked it — the same list {@link check} reports.
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
   * One engine tick while paused, resolved after the resulting snapshot has
   * been applied — so a `readPorts` right after it sees the new state.
   */
  public async simStep(): Promise<SimStatus> {
    this.simulation.step();
    await this.nextFrame();
    return this.simStatus();
  }

  /**
   * Drives a lever/button to an absolute state (see
   * {@link SimulationService.setUserInput}). Resolves after one snapshot
   * round-trip; the engine applies the input at its next tick, so the
   * deterministic recipe is `pause()` → `setInput()` → `step()` → `readPorts()`.
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
   * Per-port powered state, resolved against a freshly pulled snapshot. Without
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
   * Resolves once the next engine snapshot has been applied. A full snapshot is
   * requested explicitly, so this settles whether the simulation is running or
   * paused; it resolves without a frame when no session is up, and gives up
   * after {@link FRAME_WAIT_MS} rather than hanging a driver forever.
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
  // View operations are visual only: never a history entry, never part of a
  // snapshot, and allowed during simulation. Agents speak grid units; the
  // `ViewportController` speaks screen px, so every call converts through the
  // current zoom here.

  public getViewport(): ViewportInfo {
    const project = this.requireProject();
    const state = project.viewport.viewportState;
    return {
      view: toGridRect(project.viewport.gridView(new Rectangle())),
      zoom: state.scale,
      screen: { width: state.viewportSize.x, height: state.viewportSize.y }
    };
  }

  /** Moves the camera by a grid-space delta: +x scrolls the view right. */
  public cameraPan(delta: GridPoint): void {
    const project = this.requireProject();
    const factor = project.viewport.viewportState.scale * environment.gridSize;
    project.viewport.pan(new Point(-delta.x * factor, -delta.y * factor));
    project.triggerTicker('single');
  }

  /** Centres the viewport on a grid point. */
  public cameraSetCenter(pos: GridPoint): void {
    const project = this.requireProject();
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
   * Sets an absolute zoom factor (1 = 100%), clamped to the editor's zoom
   * ladder, anchored on a grid point (the viewport centre by default).
   */
  public cameraSetZoom(factor: number, center?: GridPoint): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error('logigator: zoom factor must be a positive number');
    }
    const project = this.requireProject();
    const current = project.viewport.viewportState.scale;
    project.viewport.zoomBy(
      factor / current,
      center ? this.gridToScreen(center) : undefined
    );
  }

  /**
   * Frames a target: a grid rectangle, the union of some elements' bounds, or
   * all content. Returns the resulting viewport so a caller can confirm what is
   * on screen.
   */
  public cameraFocus(
    target: FocusTarget,
    options: FocusOptions = {}
  ): ViewportInfo {
    const project = this.requireProject();
    const rect = this.resolveFocusTarget(target);
    if (rect) {
      project.viewport.fitBounds(
        rect,
        options.paddingGrid ?? DEFAULT_FOCUS_PADDING,
        options.maxZoom ?? DEFAULT_FOCUS_MAX_ZOOM
      );
    }
    return this.getViewport();
  }

  // -- Highlights ----------------------------------------------------------

  /**
   * Replaces the marked regions — the "look here" idiom an agent pairs with
   * `camera.focus` after an edit, so the watching user sees what changed.
   * Element ids resolve to bounds at call time: a highlight does not follow an
   * element that later moves.
   */
  public highlight(regions: HighlightRegion[]): void {
    const project = this.requireProject();
    const rects: Rectangle[] = [];
    for (const region of regions) {
      if ('bounds' in region) {
        rects.push(
          new Rectangle(
            region.bounds.x,
            region.bounds.y,
            region.bounds.width,
            region.bounds.height
          )
        );
      } else {
        const rect = this.elementBounds(region.elementIds);
        if (rect) rects.push(rect);
      }
    }
    project.floatingLayer.showHighlights(rects);
    project.triggerTicker('single');
  }

  public clearHighlights(): void {
    // Tolerates a replaced or destroyed project: a new document brings a fresh
    // floating layer, so there is nothing left to clear.
    const project = this.activeProject;
    if (!project) return;
    project.floatingLayer.clearHighlights();
    project.triggerTicker('single');
  }

  /** Grid point → screen px within the canvas, at the current camera. */
  private gridToScreen(pos: GridPoint): Point {
    const state = this.requireProject().viewport.viewportState;
    const factor = state.scale * environment.gridSize;
    return new Point(
      (pos.x - state.gridOrigin.x) * factor,
      (pos.y - state.gridOrigin.y) * factor
    );
  }

  /** The rectangle a {@link FocusTarget} designates, `null` when it is empty. */
  private resolveFocusTarget(target: FocusTarget): Rectangle | null {
    const project = this.requireProject();
    if (target === 'content') return project.getContentBounds();
    if ('elementIds' in target) return this.elementBounds(target.elementIds);
    return new Rectangle(target.x, target.y, target.width, target.height);
  }

  /** Union of the grid bounds of the given components/wires (ids share a space). */
  private elementBounds(ids: readonly number[]): Rectangle | null {
    const project = this.requireProject();
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

  // -- Editor settings -----------------------------------------------------
  //
  // User preferences, not project edits: they persist exactly as if the user had
  // flipped the controls and are never history entries. The boolean half is
  // enumerated from `EditorSettingsService.settings`, so a preference added
  // later shows up here on its own.

  public settingsDescribe(): SettingDescriptor[] {
    return [
      { key: 'theme', kind: 'enum', values: [...this.theming.availableThemes] },
      { key: 'language', kind: 'enum', values: this.availableLangs() },
      ...this.settings.settings.map(
        (setting): SettingDescriptor => ({
          key: setting.key,
          kind: 'boolean',
          label: this.translation.translate(setting.labelKey)
        })
      )
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
   * Applies a patch of preferences. The whole patch is validated first — an
   * unknown key or an unaccepted value rejects it and applies nothing.
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
   * Why a mutation would be refused right now: no project, a running
   * simulation, or a live drag session (the router locks the action manager for
   * the whole session, including a paste/rotate group still floating before its
   * first grab).
   */
  private busyReason(): BusyReason | null {
    const project = this.activeProject;
    if (!project) return 'no-project';
    if (this.workMode.mode() === WorkMode.SIMULATION) return 'simulation';
    if (project.actionManager.locked) return 'session-active';
    return null;
  }

  /**
   * The active project, or a thrown error — for the calls whose result has no
   * room for a refusal (the driver sees the exception through `evaluate`).
   */
  private requireProject(): Project {
    const project = this.activeProject;
    if (!project) throw new Error('logigator: no project is open');
    return project;
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
