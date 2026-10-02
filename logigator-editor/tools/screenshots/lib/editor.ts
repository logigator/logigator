import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Browser,
  BrowserContext,
  Locator,
  Page,
  ViewportSize
} from 'playwright';
import type {
  ApiComponent,
  ElementList,
  ElementQuery,
  FocusOptions,
  FocusTarget,
  GridPoint,
  GridRect,
  InspectionInfo,
  LogigatorAutomationApi,
  RenderImageOptions,
  ScreenPoint,
  ScreenRect,
  SelectOptions,
  SelectRegion,
  SelectionState,
  SettingsState,
  SimStatus,
  WorkModeName
} from '../../../src/app/automation/automation-api.model.ts';
import {
  BOARD_ZOOM,
  CIRCUITS_DIR,
  DEVICE_SCALE_FACTOR,
  GRID_SIZE,
  SEEDED_LOCAL_STORAGE
} from './config.ts';
import {
  loadTranslations,
  translate,
  type TranslationKey,
  type TranslationSchema
} from './i18n.ts';
import { installApiMocks } from './cloud-api.ts';
import { preferencesCookie, type LanguageId, type Theme } from './origin.ts';

declare global {
  /**
   * The facade, as the page functions below reach it. The editor declares
   * `window.__logigator` optional, it being absent from any build without the
   * automation API; `Editor.open` refuses such a build before a shot runs, so
   * past that point it is always there.
   */
  var __logigator: LogigatorAutomationApi;
}

/**
 * Where the pointer rests when a shot is not deliberately hovering something:
 * clear of every button so no tooltip opens, and clear of the canvas so the
 * coordinate readout and hover ghosts stay idle.
 */
const PARKED_POINTER = { x: 2, y: 2 };

export type { ApiComponent };

/** A rectangle in viewport CSS px — what a Playwright clip is. */
export type Clip = ScreenRect;

/** What one frame is captured from: a viewport clip or an element's box. */
export type SnapTarget = { clip: Clip } | { locator: Locator };

/** An element to measure: a CSS selector or a locator. */
export type Selector = string | Locator;

/** Per-side padding for {@link Editor.unionClip}, in CSS px. */
export type Padding =
  number | { left?: number; right?: number; top?: number; bottom?: number };

type ContextCookies = Parameters<BrowserContext['addCookies']>[0];

/** How a shot's editor is staged before it runs; every field is optional. */
export interface OpenOptions {
  viewport?: Partial<ViewportSize>;
  /** Runs against `lib/cloud-api.ts` with a signed-in session. */
  cloud?: boolean;
  cookies?: ContextCookies;
  localStorage?: Record<string, string>;
}

export interface EditorOptions {
  baseUrl: string;
  lang: LanguageId;
  circuitsDir?: string;
  viewport: ViewportSize;
  colorScheme?: Theme;
  onProgress?: (step: string) => void;
}

/**
 * Drives one editor page for one shot. Each shot gets a fresh browser context,
 * so drafts, the component library and preferences never leak between shots.
 */
export class Editor {
  readonly lang: LanguageId;
  private readonly browser: Browser;
  private readonly baseUrl: string;
  private readonly circuitsDir: string;
  private readonly defaultViewport: ViewportSize;
  private readonly colorScheme: Theme;
  private readonly onProgress?: (step: string) => void;
  private context: BrowserContext | null = null;
  private _page: Page | null = null;
  private translations: TranslationSchema | null = null;
  private watch: InspectionInfo | null = null;

  constructor(browser: Browser, options: EditorOptions) {
    this.browser = browser;
    this.baseUrl = options.baseUrl;
    this.lang = options.lang;
    this.circuitsDir = options.circuitsDir ?? CIRCUITS_DIR;
    this.defaultViewport = options.viewport;
    this.colorScheme = options.colorScheme ?? 'dark';
    this.onProgress = options.onProgress;
  }

  /** The open page; only reachable between {@link open} and {@link close}. */
  get page(): Page {
    if (!this._page) throw new Error('the editor is not open');
    return this._page;
  }

  t(key: TranslationKey): string {
    if (!this.translations) throw new Error('the editor is not open');
    return translate(this.translations, key);
  }

  /** Announces the step under way; only calls that can take seconds do. */
  report(step: string): void {
    this.onProgress?.(step);
  }

  /**
   * Opens the editor in a clean context, staged by the one bag the caller
   * composed.
   *
   * The pass's language and colour scheme are installed as the origin-wide
   * `preferences` cookie before the first request. That is the one mechanism
   * both apps read them from, and setting it here rather than per target is
   * what keeps a new target from pinning a key the app stopped reading — which
   * fails silently, as a capture in the wrong language that nothing flags.
   *
   * `cloud` installs the mocked backend and the signed-in session.
   */
  async open({
    viewport,
    cloud,
    cookies,
    localStorage: storage
  }: OpenOptions = {}): Promise<this> {
    this.report('opening the editor');
    this.translations = await loadTranslations(this.lang);
    this.context = await this.browser.newContext({
      viewport: { ...this.defaultViewport, ...viewport },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      // What the pixels are of; `prefers-color-scheme` alone moves nothing.
      colorScheme: this.colorScheme,
      reducedMotion: 'reduce',
      // `--base` may be an HTTPS instance with a self-signed certificate.
      ignoreHTTPSErrors: true
    });
    await this.context.addCookies([
      preferencesCookie(
        this.lang,
        this.colorScheme,
        new URL(this.baseUrl).origin
      ),
      ...(cookies ?? [])
    ]);
    await this.context.addInitScript(
      (entries) => {
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      },
      { ...SEEDED_LOCAL_STORAGE, ...storage }
    );

    this._page = await this.context.newPage();
    if (cloud) await installApiMocks(this.page, { baseUrl: this.baseUrl });

    await this.page.goto(this.baseUrl, { waitUntil: 'load' });
    await this.page
      .waitForFunction(() => !!window.__logigator, null, { timeout: 60_000 })
      .catch(() => {
        throw new Error(
          `no automation API at ${this.baseUrl} — is the editor running with ` +
            '`debug.automationApi` on?'
        );
      });
    // The facade grows additively, so its version does not identify an editor
    // missing the calls this tool drives. Probing one beats a TypeError inside
    // whichever shot ran first.
    const complete = await this.api(
      () => typeof __logigator.camera.toScreen === 'function'
    );
    if (!complete) {
      throw new Error(
        `the editor at ${this.baseUrl} has an older automation API — it is ` +
          'missing camera.toScreen; rebuild it from this branch'
      );
    }
    await this.parkPointer();
    return this;
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this._page = null;
    this.watch = null;
  }

  // -- Automation API ------------------------------------------------------

  /**
   * Runs `body(arg)` in the page, where the facade is `__logigator`.
   * Everything crossing this boundary must be structured-cloneable.
   */
  api<R>(body: () => R | Promise<R>): Promise<R>;
  api<R, A>(body: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  api(body: (arg: never) => unknown, arg?: unknown): Promise<unknown> {
    return this.page.evaluate(body as (arg: unknown) => unknown, arg ?? null);
  }

  /**
   * Loads one of the recorded circuits from `circuits/`, replacing whatever is
   * open. The files are ordinary editor exports; a scene is edited by opening
   * it in the editor and exporting it back, never by editing coordinates here.
   *
   * A v1 file embeds a frozen definition of every custom it uses, so those
   * arrive as embedded copies rather than library masters; see
   * {@link Editor.openCustomForEdit}.
   */
  async load(name: string): Promise<void> {
    this.report(`loading ${name}`);
    const json = await fs
      .readFile(path.join(this.circuitsDir, `${name}.json`), 'utf8')
      .catch(() => {
        throw new Error(`no circuit file "${name}" in ${this.circuitsDir}`);
      });
    await this.importProject(json);
  }

  /** Imports a document the target handed over as JSON text. */
  async importProject(json: string): Promise<void> {
    await this.api((body) => __logigator.importProject(body), json);
    await this.settle();
  }

  /** The open document's elements, as the API's serialized bodies. */
  elements(query?: ElementQuery): Promise<ElementList> {
    return this.api(
      (q) => __logigator.getElements(q ?? undefined),
      query ?? null
    );
  }

  async focus(target: FocusTarget, opts?: FocusOptions): Promise<void> {
    await this.api(
      (a) => __logigator.camera.focus(a.target, a.opts ?? undefined),
      { target, opts: opts ?? null }
    );
    await this.settle();
  }

  async setCamera({
    center,
    zoom
  }: {
    center?: GridPoint;
    zoom?: number;
  }): Promise<void> {
    await this.api(
      (a) => {
        if (a.zoom) __logigator.camera.setZoom(a.zoom);
        if (a.center) __logigator.camera.setCenter(a.center);
      },
      { center: center ?? null, zoom: zoom ?? null }
    );
    await this.settle();
  }

  /** Scrolls the view by a grid-space delta; `+x` moves the view right. */
  async panBy(delta: GridPoint): Promise<void> {
    await this.api((d) => __logigator.camera.pan(d), delta);
    await this.settle();
  }

  /**
   * Slides the camera until the content's centre sits at the given CSS-px
   * offsets from the board's top-left corner — how a shot parks a circuit
   * beside a floating window. Either axis may be left out. Measured from where
   * the content is, so it holds at any zoom and prior framing.
   */
  async centerContentAt({ x, y }: { x?: number; y?: number }): Promise<void> {
    const bounds = await this.contentBounds();
    const board = await this.canvasBox();
    const centre = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
    // Both points in grid units, so the pan is their difference.
    const target = await this.api((point) => __logigator.camera.toGrid(point), {
      x: board.x + (x ?? 0),
      y: board.y + (y ?? 0)
    });
    await this.panBy({
      x: x === undefined ? 0 : centre.x - target.x,
      y: y === undefined ? 0 : centre.y - target.y
    });
  }

  /** The open circuit's tight content bounds, in grid units. */
  async contentBounds(): Promise<GridRect> {
    const bounds = await this.api(() => __logigator.getProject().bounds);
    if (!bounds) throw new Error('the project is empty — nothing to frame');
    return bounds;
  }

  settings(patch: Partial<SettingsState>): Promise<SettingsState> {
    return this.api((p) => __logigator.settings.set(p), patch);
  }

  async setWorkMode(
    mode: WorkModeName,
    opts?: { componentType?: number }
  ): Promise<void> {
    await this.api(
      (a) => __logigator.setWorkMode(a.mode, a.opts ?? undefined),
      { mode, opts: opts ?? null }
    );
    await this.settle();
  }

  /** Selects as the select tool's marquee would. */
  async select(
    region: SelectRegion,
    opts?: SelectOptions
  ): Promise<SelectionState> {
    const state = await this.api(
      (a) => __logigator.select(a.region, a.opts ?? undefined),
      { region, opts: opts ?? null }
    );
    await this.settle();
    return state;
  }

  // -- Waiting -------------------------------------------------------------

  /**
   * Waits until the page is visually stable: fonts resolved (an early shot
   * catches fallback metrics), transitions finished (an overlay caught
   * mid-scale rasterizes its border a subpixel off), and two frames painted —
   * the board renders on demand, so one frame after an edit is not enough.
   */
  async settle(): Promise<void> {
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      const running = document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => animation.finished.catch(() => undefined));
      // Deadlined so an indefinite animation cannot hang a shot.
      await Promise.race([
        Promise.all(running),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    });
  }

  async parkPointer(): Promise<void> {
    await this.page.mouse.move(PARKED_POINTER.x, PARKED_POINTER.y);
    await this.settle();
  }

  // -- Geometry ------------------------------------------------------------

  // Every conversion between grid units and CSS px goes through the camera's
  // own mapping: a copy of the editor's transform out here would drift.

  /** Bounding box of the board canvas, in CSS px relative to the viewport. */
  canvasBox(): Promise<ScreenRect> {
    return this.api(() => __logigator.camera.boardRect());
  }

  /** Grid rectangle → CSS-px clip. `pad` is in grid units. */
  async gridClip(rect: GridRect, pad = 0): Promise<Clip> {
    const [box, canvas] = await Promise.all([
      this.api((r) => __logigator.camera.toScreenRect(r), {
        x: rect.x - pad,
        y: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
      }),
      this.canvasBox()
    ]);
    // Clamped to the canvas, not the window: a crop past the board would pick
    // up the status bar or the side-bar's edge.
    return clampTo(box, canvas);
  }

  /** Grid point → viewport CSS px, for driving the mouse over the board. */
  gridPoint(pos: GridPoint): Promise<ScreenPoint> {
    return this.api((p) => __logigator.camera.toScreen(p), pos);
  }

  /** Viewport CSS px → grid point. */
  gridOf(point: ScreenPoint): Promise<GridPoint> {
    return this.api((p) => __logigator.camera.toGrid(p), point);
  }

  /**
   * Renders the open circuit through the editor's own image export: the whole
   * circuit at an exact resolution, whatever the camera and the window, with
   * the simulation's state as it stands. A frame like {@link snap}'s, without
   * a clip to measure.
   */
  async renderImage(options: RenderImageOptions): Promise<Buffer> {
    this.report('rendering the board');
    const { png } = await this.api(
      (opts) => __logigator.renderImage(opts),
      options
    );
    return Buffer.from(png, 'base64');
  }

  /** Captures one frame into memory rather than to disk. */
  snap(target: SnapTarget): Promise<Buffer> {
    const options = { animations: 'disabled' } as const;
    return 'locator' in target
      ? target.locator.screenshot(options)
      : this.page.screenshot({ ...options, clip: target.clip });
  }

  async fullViewportClip(): Promise<Clip> {
    return { x: 0, y: 0, ...this.viewportSize() };
  }

  /**
   * Centres the circuit at the canonical board zoom and clips to its bounds.
   * `pad` is in grid units, so the margin is the same whatever the circuit's
   * size.
   */
  async contentClip({
    pad = 2,
    zoom = BOARD_ZOOM,
    overlays = false,
    anchor = 'center'
  }: {
    pad?: number;
    zoom?: number;
    overlays?: boolean;
    anchor?: 'center' | 'top' | 'top-left';
  } = {}): Promise<Clip> {
    const bounds = await this.contentBounds();
    if (!overlays) await this.hideOverlays();

    const board = await this.canvasBox();
    // 'top-left' parks the circuit in the board's corner, keeping a clip that
    // also reaches the chrome above tight; 'top' centres it across that frame.
    const flush = {
      x: board.width / GRID_SIZE / zoom / 2 - pad,
      y: board.height / GRID_SIZE / zoom / 2 - pad
    };
    const centred = { x: bounds.width / 2, y: bounds.height / 2 };
    const half = {
      x: anchor === 'top-left' ? flush.x : centred.x,
      y: anchor === 'center' ? centred.y : flush.y
    };
    await this.setCamera({
      zoom,
      center: { x: bounds.x + half.x, y: bounds.y + half.y }
    });
    await this.parkPointer();

    const canvas = await this.canvasBox();
    const needed = {
      width: (bounds.width + pad * 2) * GRID_SIZE * zoom,
      height: (bounds.height + pad * 2) * GRID_SIZE * zoom
    };
    if (needed.width > canvas.width || needed.height > canvas.height) {
      throw new Error(
        `the circuit needs ${Math.ceil(needed.width)}×${Math.ceil(needed.height)} ` +
          `CSS px at zoom ${zoom.toFixed(2)}, but the board is only ` +
          `${Math.round(canvas.width)}×${Math.round(canvas.height)} — ` +
          'shrink the scene, lower the zoom, or widen the shot viewport'
      );
    }
    return this.gridClip(bounds, pad);
  }

  /**
   * Padded clip covering every given selector's box, so shots of button groups
   * and adjacent bars anchor to real chrome rather than added markup.
   */
  async unionClip(
    selectors: Selector | readonly Selector[],
    pad: Padding = 0
  ): Promise<Clip> {
    const boxes: Clip[] = [];
    for (const selector of [selectors].flat()) {
      const locator =
        typeof selector === 'string' ? this.page.locator(selector) : selector;
      const count = await locator.count();
      if (count === 0) throw new Error(`no element matches ${selector}`);
      for (let i = 0; i < count; i++) {
        const box = await locator.nth(i).boundingBox();
        if (box) boxes.push(box);
      }
    }
    if (boxes.length === 0) throw new Error('union of zero boxes');

    const leftPadding = typeof pad === 'number' ? pad : (pad.left ?? 0);
    const rightPadding = typeof pad === 'number' ? pad : (pad.right ?? 0);
    const topPadding = typeof pad === 'number' ? pad : (pad.top ?? 0);
    const bottomPadding = typeof pad === 'number' ? pad : (pad.bottom ?? 0);

    const left = Math.min(...boxes.map((b) => b.x)) - leftPadding;
    const top = Math.min(...boxes.map((b) => b.y)) - topPadding;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + rightPadding;
    const bottom =
      Math.max(...boxes.map((b) => b.y + b.height)) + bottomPadding;
    return clampTo(
      { x: left, y: top, width: right - left, height: bottom - top },
      { x: 0, y: 0, ...this.viewportSize() }
    );
  }

  /** An element's box in viewport CSS px, refusing one that is not rendered. */
  async box(locator: Locator): Promise<Clip> {
    const box = await locator.boundingBox();
    if (!box) throw new Error(`${locator} is not on screen`);
    return box;
  }

  /** The page's viewport, which every context here is opened with. */
  private viewportSize(): ViewportSize {
    const size = this.page.viewportSize();
    if (!size) throw new Error('the page has no fixed viewport');
    return size;
  }

  // -- Chrome helpers ------------------------------------------------------

  /** Opens a top-level menu and picks an item, both by translation key. */
  async menu(menuKey: TranslationKey, itemKey: TranslationKey): Promise<void> {
    await this.page.getByRole('menuitem', { name: this.t(menuKey) }).click();
    await this.page.getByRole('menuitem', { name: this.t(itemKey) }).click();
    await this.settle();
  }

  /**
   * Clicks a chrome button by translation key. Arming a tool goes through
   * {@link Editor.setWorkMode} instead.
   */
  async clickButton(
    key: TranslationKey,
    options?: Parameters<Locator['click']>[0]
  ): Promise<void> {
    await this.button(key).click(options);
    await this.settle();
  }

  /** A chrome button, by the key behind its accessible name. */
  button(key: TranslationKey): Locator {
    return this.page.getByRole('button', { name: this.t(key), exact: true });
  }

  async clickTab(key: TranslationKey): Promise<void> {
    await this.page.getByRole('tab', { name: this.t(key) }).click();
    await this.settle();
  }

  /**
   * Fails the shot when the tool bar has wrapped to a second row. The bar is
   * `flex-wrap`, so a viewport fitting the English bar silently folds a longer
   * language in two and every shot of the chrome comes out a row taller.
   */
  async requireSingleRowToolBar(): Promise<void> {
    const [bar, button] = await Promise.all([
      this.box(this.page.locator('app-tool-bar')),
      this.box(this.page.locator('app-tool-bar button[lgButton]').first())
    ]);
    if (bar.height > button.height * 1.6) {
      throw new Error(
        `the tool bar wrapped to a second row in "${this.lang}" ` +
          `(${Math.round(bar.height)} px of ${Math.round(button.height)} px ` +
          "buttons) — widen this shot's viewport for that language"
      );
    }
  }

  /** Hides the controls docked over the board, which a close-up would catch. */
  async hideOverlays(): Promise<void> {
    await this.page.addStyleTag({
      content: 'app-minimap, app-bug-report-badge { display: none !important }'
    });
    await this.settle();
  }

  /** Waits for a deferred piece of chrome, such as the debounced minimap. */
  async waitVisible(selector: string): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'visible' });
    await this.settle();
  }

  /**
   * Waits until an element has stopped moving. Overlays scale and fade in, and
   * a clip measured mid-animation lands a pixel or two off — enough to make an
   * unchanged shot a new file on every run.
   */
  async waitStable(locator: Locator, attempts = 20): Promise<void> {
    this.report('waiting for the overlay to settle');
    let previous: Clip | null = null;
    for (let i = 0; i < attempts; i++) {
      const box = await locator.boundingBox();
      if (previous && JSON.stringify(box) === JSON.stringify(previous)) return;
      previous = box;
      await this.settle();
    }
    throw new Error('element never settled into a stable position');
  }

  /** Saves the draft as a named local project; needs no session. */
  async saveAs(name: string): Promise<void> {
    await this.menu(
      'titleBar.menuBar.file.label',
      'titleBar.menuBar.file.items.save.label'
    );
    const dialog = this.dialog();
    await dialog.locator('#save-project-name').fill(name);
    const button = (key: TranslationKey) =>
      dialog.getByRole('button', { name: this.t(key), exact: true });
    await button('saveProjectDialog.destinationLocal').click();
    await button('common.save').click();
    await dialog.waitFor({ state: 'detached' });
    await this.settle();
  }

  /** Placed components of one catalog type, addressed by symbol. */
  async componentsOfType(symbol: string): Promise<ApiComponent[]> {
    const type = await this.typeOf(symbol);
    const { components } = await this.elements({ types: [type] });
    if (components.length === 0) {
      throw new Error(`the open circuit has no "${symbol}" component`);
    }
    return components;
  }

  /** Type id of a catalog entry, by its unique symbol or name. */
  async typeOf(nameOrSymbol: string): Promise<number> {
    const type = await this.api(
      (needle) =>
        __logigator
          .describeCatalog()
          .find((e) => e.symbol === needle || e.name === needle)?.type ?? null,
      nameOrSymbol
    );
    if (type === null)
      throw new Error(`no catalog entry for "${nameOrSymbol}"`);
    return type;
  }

  /**
   * A point one grid unit in from a component's anchor: inside every body the
   * palette can place, and clear of the port stubs.
   */
  bodyPoint(component: ApiComponent): GridPoint {
    return { x: component.pos[0] + 1, y: component.pos[1] + 1 };
  }

  /**
   * Opens the master behind the first custom instance in its own tab. A loaded
   * file carries its customs as embedded copies, so `library.edit` restores one
   * into the browser library first — which is also what fills the palette's
   * User Components section.
   */
  async openCustomForEdit(): Promise<void> {
    const [instance] = await this.customInstances();
    await this.api((type) => __logigator.library.edit(type), instance.type);
    await this.settle();
  }

  /** Selects the first custom instance, opening its settings card. */
  async selectCustomInstance(): Promise<ApiComponent> {
    const [instance] = await this.customInstances();
    // A zero-area region is a click: one element, no marquee in the shot.
    const point = this.bodyPoint(instance);
    await this.select({ bounds: { ...point, width: 0, height: 0 } });
    await this.page.locator('app-component-settings lg-card').waitFor();
    await this.settle();
    return instance;
  }

  /** Switches back to the pinned main-project tab. */
  async openMainTab(): Promise<void> {
    await this.api(() => __logigator.tabs.activate(0));
    await this.settle();
  }

  /** Placed instances of custom masters, above the built-in type ids. */
  async customInstances(): Promise<ApiComponent[]> {
    const custom = await this.api(() => {
      const builtIn = new Set(
        __logigator
          .describeCatalog()
          .filter((e) => !e.source)
          .map((e) => e.type)
      );
      return __logigator
        .getElements()
        .components.filter((c) => !builtIn.has(c.type));
    });
    if (custom.length === 0) {
      throw new Error('the open circuit has no custom-component instance');
    }
    return custom;
  }

  /** Absolute lever/button input, resolved after the engine's snapshot lands. */
  async setInput(componentId: number, value: boolean): Promise<void> {
    await this.api((a) => __logigator.sim.setInput(a.id, a.value), {
      id: componentId,
      value
    });
    await this.settle();
  }

  /** Opens a component's live inspection; the handle is kept for later. */
  async openWatch(symbol: string): Promise<InspectionInfo> {
    this.report('opening the inspection');
    const [instance] = await this.componentsOfType(symbol);
    const watch = await this.api(
      (id) => __logigator.inspect.open(id),
      instance.id
    );
    this.watch = watch;
    await this.watchWindow().waitFor({ state: 'visible' });
    await this.settle();
    return watch;
  }

  watchWindow(): Locator {
    return this.page.locator('lg-window').first();
  }

  requireWatch(): number {
    if (!this.watch) throw new Error('no inspection is open');
    return this.watch.id;
  }

  /**
   * Places the inspection window at an absolute viewport point. The window is
   * clamped to the board, so a target that does not fit is refused rather than
   * silently reframing the shot.
   */
  async moveWatch({ x, y }: ScreenPoint): Promise<void> {
    const placed = await this.api(
      (a) => __logigator.inspect.setBounds(a.id, { x: a.x, y: a.y }),
      { id: this.requireWatch(), x, y }
    );
    await this.settle();
    if (!placed) {
      throw new Error('the inspection is not hosted in a window');
    }
    if (Math.abs(placed.x - x) > 2 || Math.abs(placed.y - y) > 2) {
      throw new Error(
        `the window was clamped to ${Math.round(placed.x)},${Math.round(placed.y)} ` +
          `instead of ${Math.round(x)},${Math.round(y)} — it does not fit beside ` +
          'the rest of the shot; lower the zoom or widen the shot viewport'
      );
    }
  }

  /**
   * Frames the watch's circuit at an absolute zoom. A watch fits its circuit at
   * 100 % at most, so a small circuit in a large window needs this to fill it.
   */
  async zoomWatch(zoom: number): Promise<void> {
    await this.api(
      (a) => {
        const { camera } = __logigator.inspect;
        camera.setZoom(a.id, a.zoom);
        camera.focus(a.id, 'content', { maxZoom: a.zoom });
      },
      { id: this.requireWatch(), zoom }
    );
    await this.settle();
  }

  /** `ticks` engine ticks, resolved after the resulting snapshot is applied. */
  async stepSimulation(ticks = 1): Promise<void> {
    this.report('settling the simulation');
    await this.api(async (n) => {
      __logigator.sim.pause();
      await __logigator.sim.step(n);
    }, ticks);
    await this.settle();
  }

  /** Runs until the inputs reach the outputs, then pauses. */
  runUntilSettled(ticks = 12): Promise<void> {
    return this.stepSimulation(ticks);
  }

  /**
   * Drills one level down by activating the first nested custom of the visible
   * level, as a tap would. Each level is a fresh copy of the inner circuit, so
   * its ids are the copy's.
   */
  async drillIntoWatch(): Promise<void> {
    const id = this.requireWatch();
    const inner = await this.api((watchId) => {
      const api = __logigator;
      const builtIn = new Set(
        api
          .describeCatalog()
          .filter((entry) => !entry.source)
          .map((entry) => entry.type)
      );
      return (
        api.inspect
          .getElements(watchId)
          .components.find((component) => !builtIn.has(component.type)) ?? null
      );
    }, id);
    if (!inner) {
      throw new Error('the watched circuit has no nested custom to drill into');
    }
    this.watch = await this.api(
      (a) => __logigator.inspect.activate(a.id, a.componentId),
      { id, componentId: inner.id }
    );
    await this.settle();
  }

  dialog(): Locator {
    return this.page.locator('.cdk-overlay-pane [role="dialog"]').first();
  }

  /**
   * Enters simulation and waits for the engine, so a shot never catches the
   * controls mid-boot. Auto-start is off in the seeded preferences, so the
   * session comes up paused.
   */
  async enterSimulation(): Promise<SimStatus> {
    this.report('entering simulation');
    const status = await this.api(() => __logigator.sim.enter());
    if (status.state === 'inactive') {
      throw new Error(
        `simulation refused: ${JSON.stringify(status.diagnostics ?? [])}`
      );
    }
    await this.settle();
    return status;
  }
}

/** Rounds a clip to whole CSS px and trims it to the given container box. */
function clampTo(rect: Clip, container: Clip): Clip {
  const x = Math.max(Math.round(container.x), Math.round(rect.x));
  const y = Math.max(Math.round(container.y), Math.round(rect.y));
  return {
    x,
    y,
    width: Math.min(
      Math.round(rect.width),
      Math.round(container.x + container.width) - x
    ),
    height: Math.min(
      Math.round(rect.height),
      Math.round(container.y + container.height) - y
    )
  };
}
