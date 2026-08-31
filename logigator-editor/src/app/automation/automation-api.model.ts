/**
 * The `window.__logigator` contract. Everything here is structured-cloneable
 * and no live editor object crosses the boundary: elements are addressed by
 * their numeric project ids, coordinates are grid units unless named `screen`.
 * Circuit bodies reuse the native persistence bodies, so the shape an agent
 * reads is the shape it writes back.
 */

import { SerializedComponentBody, SerializedWireBody } from '@logigator/core';

/** Contract version, independent of the editor's release version. */
export const AUTOMATION_API_VERSION = 1;

export interface ApiInfo {
  apiVersion: number;
  editorVersion: string;
  /** Git short SHA the bundle was built from; empty in a dev build. */
  buildCommit: string;
}

/** A point in grid units. */
export interface GridPoint {
  x: number;
  y: number;
}

/** An axis-aligned rectangle in grid units. */
export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A point in viewport CSS px; the contract's only non-grid coordinate. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** An axis-aligned rectangle in viewport CSS px. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// -- Catalog ---------------------------------------------------------------

/** One option of a component type; `kind` carries its value constraints. */
export type OptionDescriptor = {
  key: string;
  label: string;
  hidden: boolean;
} & (
  | { kind: 'number'; default: number; min: number; max: number }
  | { kind: 'select'; default: unknown; values: unknown[] }
  | {
      kind: 'text';
      default: string;
      maxLength?: number;
      /** Source of the character class stripped from every write, if any. */
      forbiddenChars?: string;
    }
  | { kind: 'textarea'; default: string; maxLength: number }
  /** Word-addressed memory contents as a base64 bit-packed blob. */
  | { kind: 'memory'; default: string }
  | { kind: 'unknown'; default: unknown }
);

/** One placeable component type, as registered right now. */
export interface CatalogEntry {
  /** Type id — what a `addComponent` op's `type` field takes. */
  type: number;
  category: string;
  symbol: string;
  name: string;
  description: string;
  /** Custom components only: which library the master lives in. */
  source?: 'server' | 'browser';
  /** Port counts of a default instance; an option drives adjustable ones. */
  ports: { inputs: number; outputs: number };
  options: OptionDescriptor[];
}

// -- Reads -----------------------------------------------------------------

/** A placed component: its native body plus the project id addressing it. */
export type ApiComponent = SerializedComponentBody & { id: number };

/** A wire: its native body plus the project id addressing it. */
export type ApiWire = SerializedWireBody & { id: number };

export interface ElementList {
  components: ApiComponent[];
  wires: ApiWire[];
}

/**
 * Filters for an {@link ElementList} read; they AND, and omitting all of them
 * returns the whole circuit. Naming ids of one kind restricts the read to that
 * kind — `{ componentIds }` alone returns no wires.
 */
export interface ElementQuery {
  componentIds?: number[];
  wireIds?: number[];
  bounds?: GridRect;
  types?: number[];
}

/** The document currently open for edit. */
export interface ProjectState {
  /** Document name (from project metadata), `''` when untracked. */
  name: string;
  /** Storage id — empty for a never-saved draft. */
  id: string;
  /** Whether a project or a custom component is open. */
  documentType: 'project' | 'comp' | 'unknown';
  /** Where it is stored: cloud, browser, or a read-only share. */
  source: 'server' | 'browser' | 'share' | 'unknown';
  /** Unsaved changes pending. */
  dirty: boolean;
  /** Tight bounds over all content, `null` when empty. */
  bounds: GridRect | null;
  /** Whether an edit would be refused right now — see {@link BusyReason}. */
  busy: BusyReason | null;
  undoAvailable: boolean;
  redoAvailable: boolean;
  elements: ElementList;
}

/** Why the editor refuses a mutation. */
export type BusyReason = 'session-active' | 'simulation' | 'no-project';

// -- Edits -----------------------------------------------------------------

/** Adds a component from its native body (`pos` in grid units). */
export interface AddComponentOp extends SerializedComponentBody {
  op: 'addComponent';
}

/** Adds a wire. `pos` is its start, on the integer grid; `length` > 0. */
export interface AddWireOp {
  op: 'addWire';
  pos: [number, number];
  /** 0 = horizontal, 1 = vertical. */
  direction: number;
  length: number;
}

export interface RemoveOp {
  op: 'remove';
  componentIds?: number[];
  wireIds?: number[];
}

export interface MoveComponentOp {
  op: 'moveComponent';
  id: number;
  to: [number, number];
}

export interface MoveWireOp {
  op: 'moveWire';
  id: number;
  to: [number, number];
}

/** Turns a component to an absolute facing (quarter-turns clockwise, 0–3). */
export interface RotateComponentOp {
  op: 'rotateComponent';
  id: number;
  direction: number;
}

export interface SetOptionOp {
  op: 'setOption';
  id: number;
  key: string;
  value: unknown;
}

export interface SetPortNegationOp {
  op: 'setPortNegation';
  id: number;
  side: 'in' | 'out';
  index: number;
  negated: boolean;
}

export type EditOp =
  | AddComponentOp
  | AddWireOp
  | RemoveOp
  | MoveComponentOp
  | MoveWireOp
  | RotateComponentOp
  | SetOptionOp
  | SetPortNegationOp;

/** One rejected op, addressed by its index in the submitted batch. */
export interface PerOpError {
  index: number;
  op: string;
  message: string;
}

/** Outcome of an `applyEdit` batch; `ok: false` means nothing was touched. */
export type EditResult =
  | {
      ok: true;
      /** Ids assigned to added elements, per op index. */
      createdIds: { index: number; componentId?: number; wireId?: number }[];
      /** Wires the topology integrator split/merged to keep the invariants. */
      integratedWires: { added: number[]; removed: number[] };
    }
  | { ok: false; errors: PerOpError[] };

// -- Diagnostics -----------------------------------------------------------

export interface CompileDiagnosticReport {
  ok: boolean;
  diagnostics: {
    kind: string;
    message: string;
    instancePath: string;
    componentType: number;
    componentId?: number;
  }[];
}

// -- Simulation ------------------------------------------------------------

export interface SimStatus {
  state: 'inactive' | 'starting' | 'ready' | 'running';
  mode: 'sync' | 'continuous' | 'target';
  targetHz: number;
  measuredHz: number;
  tick: number;
  /** Populated by `enter()` when compilation blocked the session. */
  diagnostics?: CompileDiagnosticReport['diagnostics'];
}

/** Per-port powered state of one component, in `connectionPoints` order. */
export interface PortReadout {
  componentId: number;
  type: number;
  inputs: boolean[];
  outputs: boolean[];
}

// -- Camera ----------------------------------------------------------------

export interface ViewportInfo {
  /** The grid rectangle currently on screen. */
  view: GridRect;
  /** Zoom factor (1 = 100%). */
  zoom: number;
  /** Viewport size in screen px. */
  screen: { width: number; height: number };
}

/** What `focus()` frames: a rectangle, a set of elements, or all content. */
export type FocusTarget = GridRect | { elementIds: number[] } | 'content';

export interface FocusOptions {
  /** Clearance kept on every side, in grid units (default 2). */
  paddingGrid?: number;
  /** Cap on the resulting zoom so a small target isn't blown up (default 1). */
  maxZoom?: number;
}

// -- Work mode -------------------------------------------------------------

/**
 * Which tool the board is armed with — the {@link WorkMode} values verbatim.
 * `simulation` is read-only here: it is entered through `sim.enter()`.
 */
export type WorkModeName =
  | 'pan'
  | 'wireTool'
  | 'sel'
  | 'selExact'
  | 'erase'
  | 'placeComp'
  | 'simulation';

export interface WorkModeState {
  mode: WorkModeName;
  /** Type id armed for placement; `null` outside `placeComp`. */
  placementType: number | null;
}

// -- Selection -------------------------------------------------------------

/**
 * What to select: a marquee rectangle (what a user drags with the select tool)
 * or a set of elements addressed by id.
 */
export type SelectRegion = { bounds: GridRect } | { elementIds: number[] };

export interface SelectOptions {
  /**
   * Scissor the marquee: wires crossing its edge are cut and only the inside
   * pieces join the selection. Rectangle regions only. The cut registers a
   * provisional history entry the following move or delete folds into itself.
   */
  cut?: boolean;
  /** Keep a persistent grab rect (default `true`), else select like a click. */
  rect?: boolean;
}

/** What ended up selected. */
export interface SelectionState {
  componentIds: number[];
  /** Wire ids — **fresh** ids for the inside pieces of a scissor cut. */
  wireIds: number[];
  /** The persistent grab rect, `null` for a single-click selection. */
  rect: GridRect | null;
  /** Whether this selection registered a scissor cut. */
  cut: boolean;
}

// -- Inspection ------------------------------------------------------------

/** One open live inspection — what tapping a component while running opens. */
export interface InspectionInfo {
  /** Handle for the calls below; unique for the session, never reused. */
  id: number;
  /** The inspected component, in the project it is placed in. */
  componentId: number;
  componentType: number;
  /** Inspection kind — `rom` for the data inspector, `watch` for a sub-circuit. */
  kind: string;
  /** Flat title (the watch's breadcrumb trail joined). */
  title: string;
  /** Watches: one label per open level, the visible one last. */
  trail?: string[];
  /** Window box in viewport CSS px; `null` when hosted in the compact sheet. */
  bounds: ScreenRect | null;
}

// -- Documents -------------------------------------------------------------

/** One tab of the editor's tab strip: the main project, then open components. */
export interface TabInfo {
  /** Position in the strip — the main project is pinned at 0. */
  index: number;
  name: string;
  documentType: 'project' | 'comp' | 'unknown';
  /** Storage id — empty for a never-saved draft. */
  id: string;
  active: boolean;
  dirty: boolean;
}

/** One custom-component master in the session's library. */
export interface LibraryEntry {
  /** Session type id — what `addComponent` places and the catalog lists. */
  type: number;
  /** Persistent master id (browser store or cloud). */
  id: string;
  name: string;
  symbol: string;
  source: 'server' | 'browser';
  /** Whether an editor tab for this master is currently open. */
  open: boolean;
}

// -- Settings --------------------------------------------------------------

export type SettingDescriptor =
  | { key: 'theme'; kind: 'enum'; values: string[] }
  | { key: 'language'; kind: 'enum'; values: string[] }
  | { key: string; kind: 'boolean'; label: string };

/** Current editor preferences: the two enums plus every boolean setting. */
export interface SettingsState {
  theme: string;
  language: string;
  [key: string]: string | boolean;
}

// -- The facade ------------------------------------------------------------

/** The object installed as `window.__logigator`. */
export interface LogigatorAutomationApi {
  // discovery
  version(): ApiInfo;
  describeCatalog(): CatalogEntry[];

  // read
  getProject(): ProjectState;
  getElements(query?: ElementQuery): ElementList;

  // write — one batch is one undo step
  applyEdit(ops: EditOp[]): EditResult;
  undo(): boolean;
  redo(): boolean;

  // validate
  check(): CompileDiagnosticReport;

  // persistence
  exportProject(): string;
  importProject(json: string): Promise<ProjectState>;
  newProject(): ProjectState;

  // simulation
  sim: {
    /** Compiles and boots; resolves when the engine is up or entry was blocked. */
    enter(): Promise<SimStatus>;
    exit(): void;
    play(): void;
    pause(): void;
    /**
     * `count` ticks while paused (default 1), resolved after the snapshot is
     * applied — one round trip however many ticks were asked for.
     */
    step(count?: number): Promise<SimStatus>;
    stop(): void;
    status(): SimStatus;
    setTarget(value: number, unit: 'Hz' | 'kHz' | 'MHz'): void;
    /** Lever: absolute set. Button: pulse on `true`, ignored on `false`. */
    setInput(componentId: number, value: boolean): Promise<void>;
    readPorts(componentIds?: number[]): Promise<PortReadout[]>;
  };

  // camera — grid units in, grid units out; never a history entry
  camera: {
    getViewport(): ViewportInfo;
    pan(delta: GridPoint): void;
    setCenter(pos: GridPoint): void;
    setZoom(factor: number, center?: GridPoint): void;
    zoomIn(): void;
    zoomOut(): void;
    zoom100(): void;
    focus(target: FocusTarget, opts?: FocusOptions): ViewportInfo;
    /** The board canvas's box in viewport CSS px. */
    boardRect(): ScreenRect;
    /** Grid → viewport CSS px, through the camera's own mapping. */
    toScreen(point: GridPoint): ScreenPoint;
    toScreenRect(rect: GridRect): ScreenRect;
    /** Viewport CSS px → grid. */
    toGrid(point: ScreenPoint): GridPoint;
    toGridRect(rect: ScreenRect): GridRect;
  };

  // work mode — which tool the board is armed with; never a history entry
  getWorkMode(): WorkModeState;
  /**
   * Arms a tool. `placeComp` needs `componentType`; `simulation` is refused
   * (that is `sim.enter()`), as is any change while a simulation runs.
   */
  setWorkMode(
    mode: WorkModeName,
    opts?: { componentType?: number }
  ): WorkModeState;

  /**
   * Live inspections. `getElements`/`activate`/`navigateTo`/`camera` address a
   * **watch**, whose levels are fresh copies of the inner circuit — their
   * element ids are the copy's, not the placed instance's.
   */
  inspect: {
    open(componentId: number): InspectionInfo;
    list(): InspectionInfo[];
    close(inspectionId: number): void;
    closeAll(): void;
    /** Moves/resizes the hosting window; omitted fields stay put. */
    setBounds(
      inspectionId: number,
      bounds: Partial<ScreenRect>
    ): ScreenRect | null;
    /** The visible watch level's circuit copy. */
    getElements(inspectionId: number, query?: ElementQuery): ElementList;
    /**
     * Taps a component inside the visible watch level: drives an inner
     * lever/button, drills into a nested custom, or opens its own inspection.
     */
    activate(inspectionId: number, componentId: number): InspectionInfo;
    /** Breadcrumb navigation: pops every level deeper than `level`. */
    navigateTo(inspectionId: number, level: number): InspectionInfo;
    /**
     * The watch's camera. A level fits its circuit once when it first shows; a
     * write here takes that turn instead of being overwritten by it.
     */
    camera: {
      getViewport(inspectionId: number): ViewportInfo;
      pan(inspectionId: number, delta: GridPoint): void;
      setCenter(inspectionId: number, pos: GridPoint): void;
      setZoom(inspectionId: number, factor: number): void;
      focus(
        inspectionId: number,
        target: FocusTarget,
        opts?: FocusOptions
      ): ViewportInfo;
    };
  };

  /** The open documents — the tab strip above the board. */
  tabs: {
    list(): TabInfo[];
    activate(index: number): TabInfo;
    /** Closes a component tab; a dirty one needs `discardChanges`. */
    close(index: number, opts?: { discardChanges?: boolean }): void;
  };

  /** The custom-component library the palette places from. */
  library: {
    list(): LibraryEntry[];
    /**
     * Opens a custom component's circuit in its own tab, by master type id or
     * placed-instance type id. An instance whose master is gone is restored
     * into the browser library first.
     */
    edit(type: number): Promise<TabInfo>;
  };

  // selection — exactly what the select tool's marquee does
  select(region: SelectRegion, opts?: SelectOptions): SelectionState;
  clearSelection(): void;

  // editor settings — persisted user preferences, never history entries
  settings: {
    describe(): SettingDescriptor[];
    get(): SettingsState;
    /** Validates the whole patch first; an unknown key or value applies nothing. */
    set(patch: Partial<SettingsState>): SettingsState;
  };
}

declare global {
  interface Window {
    /** Present only in builds where the `AUTOMATION_API` define is true. */
    __logigator?: LogigatorAutomationApi;
  }
}
