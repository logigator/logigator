/**
 * The `window.__logigator` contract: every argument and every result here is
 * structured-cloneable, so a driver (Playwright/CDP `evaluate`, a future MCP
 * bridge) can transport them verbatim. No live editor object ever crosses the
 * boundary — elements are addressed by their numeric project ids, coordinates
 * are always **grid units**.
 *
 * Circuit bodies deliberately reuse `SerializedComponentBody` /
 * `SerializedWireBody` (the native persistence body) with the element's id
 * attached, so the shape an agent reads is the shape it writes back.
 */

import {
  SerializedComponentBody,
  SerializedWireBody
} from '../persistence/serialized-circuit';

/**
 * Contract version, bumped on any breaking change to the shapes in this file.
 * Independent of the editor's release version.
 */
export const AUTOMATION_API_VERSION = 1;

export interface ApiInfo {
  /** Version of this contract — see {@link AUTOMATION_API_VERSION}. */
  apiVersion: number;
  /** Editor release version (package.json). */
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

/**
 * A point in **viewport CSS px** — the browser's own coordinate space, what a
 * driver hands to `page.mouse` or a screenshot clip. The only place the
 * contract leaves grid units, and always named `screen`.
 */
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

/**
 * One option of a component type. `kind` discriminates on the option class, so
 * the constraints an agent must respect (a number's range, a select's allowed
 * values, a text field's cap) are always in the payload.
 */
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
  /**
   * Port counts of a default instance. Adjustable types drive these from an
   * option (a `number` descriptor whose range is the allowed span); absent when
   * the type could not be instantiated for probing.
   */
  ports?: { inputs: number; outputs: number };
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
 * Filters for {@link ElementList} reads; omitting everything returns the whole
 * circuit. Filters combine (AND): `bounds` keeps only elements intersecting the
 * rectangle, `types` keeps only components of those type ids. Naming ids of one
 * kind restricts the read to that kind — `{ componentIds }` alone returns no
 * wires rather than every wire.
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

/**
 * Why the editor refuses a mutation: a drag session holds project state
 * mid-mutation, the circuit is running, or no project is open at all.
 */
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

/**
 * Outcome of an `applyEdit` batch — all-or-nothing: `ok: false` means the
 * project was not touched at all.
 */
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
   * Scissor the selection: wires crossing the rectangle's edge are cut there
   * and only the inside pieces join the selection — the held-scissor-key
   * marquee. Rectangle regions only; a cut registers a provisional history
   * entry that the following move or delete folds into itself.
   */
  cut?: boolean;
  /**
   * Whether the selection keeps a persistent grab rect (default `true`).
   * `false` selects without drawing one, like a single click — grabbing then
   * falls back to the elements' own bounds.
   */
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
    /** Present only when `environment.debug.automationApi` is on. */
    __logigator?: LogigatorAutomationApi;
  }
}
