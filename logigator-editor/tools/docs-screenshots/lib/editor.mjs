import {
  BOARD_ZOOM,
  CIRCUITS_DIR,
  DEVICE_SCALE_FACTOR,
  GRID_SIZE,
  LANG_STORAGE_KEY,
  SEEDED_LOCAL_STORAGE,
  VIEWPORT
} from '../config.mjs';
import { loadTranslations, translate } from './i18n.mjs';
import { installApiMocks } from './mock-api.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Where the pointer rests whenever a shot is not deliberately hovering
 * something: the very top-left of the chrome, clear of every button (so no
 * tooltip opens) and clear of the canvas (so the status bar's coordinate
 * readout and the tools' hover ghosts stay at their idle state).
 */
const PARKED_POINTER = { x: 2, y: 2 };

/**
 * Drives one editor page for one shot. Every shot gets a fresh browser context,
 * so IndexedDB drafts, the custom-component library and the preference store
 * never leak from one shot into the next.
 */
export class Editor {
  /**
   * @param {import('playwright').Browser} browser
   * @param {{ baseUrl: string, lang?: string,
   *          onProgress?: (step: string) => void }} options
   */
  constructor(browser, options) {
    this.browser = browser;
    this.baseUrl = options.baseUrl;
    this.lang = options.lang ?? 'en';
    this.onProgress = options.onProgress;
    this.context = null;
    this.page = null;
    /** The language's translations, loaded by {@link Editor.open}. */
    this.translations = null;
    /** Handle of the open inspection, set by {@link Editor.openWatch}. */
    this.watch = null;
  }

  /**
   * The editor's own text for a translation key, in the language this run is
   * capturing — how every label a shot matches on is addressed.
   */
  t(key) {
    return translate(this.translations, key);
  }

  /**
   * Announces the step now under way. Only the calls that can take seconds
   * report, so the line names what a stalled shot is waiting on rather than
   * flickering through every geometry query.
   */
  report(step) {
    this.onProgress?.(step);
  }

  /**
   * Opens the editor in a clean context. `viewport` widens or heightens the
   * window for shots that frame something taller than the standard one (the
   * full component palette, the shortcut manager); `cloud` installs the mocked
   * backend and the signed-in session.
   */
  async open({ viewport, cloud, localStorage: overrides } = {}) {
    this.report('opening the editor');
    this.translations = await loadTranslations(this.lang);
    this.context = await this.browser.newContext({
      viewport: { ...VIEWPORT, ...viewport },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      // `--base` points at a development instance, which may be served over
      // HTTPS with a self-signed certificate (`https://logigator.test/editor`).
      ignoreHTTPSErrors: true
    });
    await this.context.addInitScript(
      (entries) => {
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      },
      {
        ...SEEDED_LOCAL_STORAGE,
        [LANG_STORAGE_KEY]: this.lang,
        ...overrides
      }
    );

    this.page = await this.context.newPage();
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
    // The facade grows additively, so its version does not distinguish an
    // editor without the calls this tool drives. Probe one of them instead of
    // failing with a TypeError inside whichever shot ran first.
    const complete = await this.api(
      () => typeof window.__logigator.camera.toScreen === 'function'
    );
    if (!complete) {
      throw new Error(
        `the editor at ${this.baseUrl} has an older automation API — it is ` +
          'missing camera.toScreen; rebuild it from this branch'
      );
    }
    await this.parkPointer();
    await this.settle();
    return this;
  }

  async close() {
    await this.context?.close();
    this.context = null;
    this.page = null;
    /** Handle of the open inspection, set by {@link Editor.openWatch}. */
    this.watch = null;
  }

  // -- Automation API ------------------------------------------------------

  /**
   * Runs `body(arg)` in the page, where the facade is `window.__logigator`.
   * Everything crossing this boundary is structured-cloneable, exactly like the
   * contract an agent driving the editor sees.
   */
  api(body, arg) {
    return this.page.evaluate(body, arg ?? null);
  }

  /**
   * Loads one of the recorded circuits from `circuits/`, replacing whatever is
   * open. The files are ordinary editor exports (File → Export to file), so a
   * scene is edited by opening it in the editor, changing it and exporting it
   * back over the same name — not by editing coordinates here.
   *
   * The document's name comes from the file, and so do any custom components
   * it uses: a v1 file embeds a frozen definition of every custom in its
   * circuit. Those arrive as embedded copies, not as library masters — see
   * {@link Editor.openCustomForEdit} for the shots that need the master.
   */
  async load(name) {
    this.report(`loading ${name}`);
    const file = path.join(CIRCUITS_DIR, `${name}.json`);
    const json = await fs.readFile(file, 'utf8').catch(() => {
      throw new Error(`no circuit file "${name}" in ${CIRCUITS_DIR}`);
    });
    await this.api((body) => window.__logigator.importProject(body), json);
    await this.settle();
  }

  /** Every element in the open document, as the API's serialized bodies. */
  elements(query) {
    return this.api(
      (q) => window.__logigator.getElements(q ?? undefined),
      query
    );
  }

  async focus(target, opts) {
    await this.api(
      (a) => window.__logigator.camera.focus(a.target, a.opts ?? undefined),
      { target, opts: opts ?? null }
    );
    await this.settle();
  }

  /**
   * Absolute camera placement. Zoom first, then centre: `setZoom` keeps the
   * viewport centre fixed, so the order does not matter for the result but does
   * keep the intermediate frame from jumping.
   */
  async setCamera({ center, zoom }) {
    await this.api(
      (a) => {
        if (a.zoom) window.__logigator.camera.setZoom(a.zoom);
        if (a.center) window.__logigator.camera.setCenter(a.center);
      },
      { center: center ?? null, zoom: zoom ?? null }
    );
    await this.settle();
  }

  /** Scrolls the view by a grid-space delta; `+x` moves the view right. */
  async panBy(delta) {
    await this.api((d) => window.__logigator.camera.pan(d), delta);
    await this.settle();
  }

  /**
   * Slides the camera until the content's centre sits at the given CSS-px
   * offsets from the board's top-left corner — how a shot parks a circuit
   * beside, or level with, a floating window. Either axis may be left out.
   * Measured from where the content actually is, so it holds at any zoom and
   * whatever framing came before it.
   */
  async centerContentAt({ x, y }) {
    const bounds = await this.contentBounds();
    const board = await this.canvasBox();
    const centre = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
    // Both points in grid units, so the pan is their difference: where the
    // content is now, and where the given board offsets land on the grid.
    const target = await this.api(
      (point) => window.__logigator.camera.toGrid(point),
      { x: board.x + (x ?? 0), y: board.y + (y ?? 0) }
    );
    await this.panBy({
      x: x === undefined ? 0 : centre.x - target.x,
      y: y === undefined ? 0 : centre.y - target.y
    });
  }

  /** The open circuit's tight content bounds, in grid units. */
  async contentBounds() {
    const bounds = await this.api(() => window.__logigator.getProject().bounds);
    if (!bounds) throw new Error('the project is empty — nothing to frame');
    return bounds;
  }

  settings(patch) {
    return this.api((p) => window.__logigator.settings.set(p), patch);
  }

  /** Arms one of the board's tools, as the tool bar's buttons do. */
  async setWorkMode(mode, opts) {
    await this.api(
      (a) => window.__logigator.setWorkMode(a.mode, a.opts ?? undefined),
      { mode, opts: opts ?? null }
    );
    await this.settle();
  }

  /** Selects elements the way the select tool's marquee would. */
  async select(region, opts) {
    const state = await this.api(
      (a) => window.__logigator.select(a.region, a.opts ?? undefined),
      { region, opts: opts ?? null }
    );
    await this.settle();
    return state;
  }

  // -- Waiting -------------------------------------------------------------

  /**
   * Waits until the page is visually stable: web fonts resolved (they are
   * self-hosted and load async, so an early shot catches fallback metrics),
   * running transitions finished (an overlay caught mid-scale rasterizes its
   * border a subpixel off), and two animation frames painted — the board
   * renders on demand, so one frame after an edit is not enough.
   */
  async settle() {
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      const running = document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => animation.finished.catch(() => undefined));
      // Raced against a deadline so an indefinite animation cannot hang a shot.
      await Promise.race([
        Promise.all(running),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    });
  }

  /** Moves the pointer out of every hover target and settles. */
  async parkPointer() {
    await this.page.mouse.move(PARKED_POINTER.x, PARKED_POINTER.y);
    await this.settle();
  }

  // -- Geometry ------------------------------------------------------------

  // Every conversion between grid units and CSS px goes through the camera's
  // own mapping (`camera.toScreen` / `toScreenRect` / `boardRect`) rather than
  // being recomputed here — the editor owns that transform, and a copy of it
  // out here would drift the moment the camera changed.

  /** Bounding box of the board canvas, in CSS px relative to the viewport. */
  canvasBox() {
    return this.api(() => window.__logigator.camera.boardRect());
  }

  /**
   * Grid rectangle → clip rectangle in CSS px. `pad` is in grid units, so
   * framing stays stable across zoom levels.
   */
  async gridClip(rect, pad = 0) {
    const [box, canvas] = await Promise.all([
      this.api((r) => window.__logigator.camera.toScreenRect(r), {
        x: rect.x - pad,
        y: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
      }),
      this.canvasBox()
    ]);
    // Clamped to the canvas, not the window: a crop that ran past the board
    // would otherwise pick up the status bar or the side-bar's edge.
    return clampTo(box, canvas);
  }

  /** Grid point → viewport CSS px, for driving the mouse over the board. */
  gridPoint(pos) {
    return this.api((p) => window.__logigator.camera.toScreen(p), pos);
  }

  /** Viewport CSS px → grid point: what the board shows at a screen position. */
  gridOf(point) {
    return this.api((p) => window.__logigator.camera.toGrid(p), point);
  }

  /**
   * Captures one frame into memory instead of to disk — how an animated shot
   * builds its frames, advancing the editor between calls. Same target shape a
   * still shot returns.
   */
  snap(target) {
    const options = { animations: 'disabled' };
    return target.locator
      ? target.locator.screenshot(options)
      : this.page.screenshot({ ...options, clip: target.clip });
  }

  /** The whole window — what a "here is the editor" shot frames. */
  async fullViewportClip() {
    const size = await this.page.viewportSize();
    return { x: 0, y: 0, ...size };
  }

  /**
   * Centres the circuit at the canonical board zoom and clips to its bounds.
   * `pad` is in grid units, so the margin around a circuit is the same on every
   * page regardless of how big the circuit is.
   */
  async contentClip({
    pad = 2,
    zoom = BOARD_ZOOM,
    overlays = false,
    anchor = 'center'
  } = {}) {
    const bounds = await this.contentBounds();
    if (!overlays) await this.hideOverlays();

    const board = await this.canvasBox();
    // 'top-left' parks the circuit in the board's top-left corner, so a clip
    // that also has to reach the chrome above the board stays tight; 'top'
    // keeps that short frame but leaves the circuit centred across it.
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
   * Clip covering every given selector's box, padded. The union keeps shots of
   * button groups and adjacent bars anchored to the real chrome instead of to
   * markup this tool would otherwise have to add.
   * @arg pad {number|{left?: number, right?: number, top?: number, bottom?: number}}
   */
  async unionClip(selectors, pad = 0) {
    const boxes = [];
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
      { x: 0, y: 0, ...(await this.page.viewportSize()) }
    );
  }

  // -- Chrome helpers ------------------------------------------------------

  /**
   * Opens a top-level menu (File / Edit / View / Help) and picks an item, both
   * named by translation key — the labels are whatever the run's language calls
   * them.
   */
  async menu(menuKey, itemKey) {
    await this.page.getByRole('menuitem', { name: this.t(menuKey) }).click();
    await this.page.getByRole('menuitem', { name: this.t(itemKey) }).click();
    await this.settle();
  }

  /**
   * Clicks a chrome button by its accessible name, given as a translation key —
   * for the buttons that *are* the shot's subject (the scissor pill) or that
   * open a dialog. Arming a tool goes through {@link Editor.setWorkMode}
   * instead: an accessible name is not how a tool should be picked.
   */
  async clickButton(key, options) {
    await this.button(key).click(options);
    await this.settle();
  }

  /** A chrome button, by the translation key behind its accessible name. */
  button(key) {
    return this.page.getByRole('button', { name: this.t(key), exact: true });
  }

  /** Switches a dialog to one of its tabs, named by translation key. */
  async clickTab(key) {
    await this.page.getByRole('tab', { name: this.t(key) }).click();
    await this.settle();
  }

  /**
   * Fails the shot when the tool bar has wrapped to a second row. Its buttons
   * are labelled by tooltip, not by text, but its width still follows the
   * language: the bar is laid out `flex-wrap`, so in a viewport that fits the
   * English bar a longer language silently folds it in two and every shot
   * framing the chrome comes out a row taller. Called by the shots that frame
   * the bar, so a language that needs a wider viewport says so instead of
   * quietly producing a different picture.
   */
  async requireSingleRowToolBar() {
    const [bar, button] = await Promise.all([
      this.page.locator('app-tool-bar').boundingBox(),
      this.page.locator('app-tool-bar lg-button').first().boundingBox()
    ]);
    if (bar.height > button.height * 1.6) {
      throw new Error(
        `the tool bar wrapped to a second row in "${this.lang}" ` +
          `(${Math.round(bar.height)} px of ${Math.round(button.height)} px ` +
          "buttons) — widen this shot's viewport for that language"
      );
    }
  }

  /**
   * Hides the controls docked over the board — the minimap and the bug-report
   * badge — so a close-up of a circuit does not catch a corner of them. They
   * are chrome, not circuit, and every board crop would otherwise have to dodge
   * the bottom-right corner.
   */
  async hideOverlays() {
    await this.page.addStyleTag({
      content: 'app-minimap, app-bug-report-badge { display: none !important }'
    });
    await this.settle();
  }

  /** Waits for a deferred piece of chrome (the minimap debounces its first render). */
  async waitVisible(selector) {
    await this.page.locator(selector).waitFor({ state: 'visible' });
    await this.settle();
  }

  /**
   * Waits until an element has stopped moving. Overlays scale and fade in, and
   * a clip measured mid-animation lands a pixel or two off — enough to make an
   * otherwise identical capture a new file on every run.
   */
  async waitStable(locator, attempts = 20) {
    this.report('waiting for the overlay to settle');
    let previous = null;
    for (let i = 0; i < attempts; i++) {
      const box = await locator.boundingBox();
      if (previous && JSON.stringify(box) === JSON.stringify(previous)) return;
      previous = box;
      await this.settle();
    }
    throw new Error('element never settled into a stable position');
  }

  /**
   * Saves the draft as a named local project, which is what turns the title
   * bar's "Draft" chip into a name and the status bar into "Saved". Cloud
   * destinations need a session; local needs nothing.
   */
  async saveAs(name) {
    await this.menu(
      'titleBar.menuBar.file.label',
      'titleBar.menuBar.file.items.save.label'
    );
    const dialog = this.dialog();
    await dialog.locator('#save-project-name').fill(name);
    const button = (key) =>
      dialog.getByRole('button', { name: this.t(key), exact: true });
    await button('saveProjectDialog.destinationLocal').click();
    await button('common.save').click();
    await dialog.waitFor({ state: 'detached' });
    await this.settle();
  }

  /** Placed components of one catalog type, addressed by symbol. */
  async componentsOfType(symbol) {
    const type = await this.typeOf(symbol);
    const { components } = await this.elements({ types: [type] });
    if (components.length === 0) {
      throw new Error(`the open circuit has no "${symbol}" component`);
    }
    return components;
  }

  /** Type id of a catalog entry, looked up by its unique symbol or name. */
  async typeOf(nameOrSymbol) {
    const type = await this.api(
      (needle) =>
        window.__logigator
          .describeCatalog()
          .find((e) => e.symbol === needle || e.name === needle)?.type ?? null,
      nameOrSymbol
    );
    if (type === null)
      throw new Error(`no catalog entry for "${nameOrSymbol}"`);
    return type;
  }

  /**
   * A point inside a component's body, one grid unit in from its anchor —
   * inside every body the palette can place, and clear of the port stubs.
   */
  bodyPoint(component) {
    return { x: component.pos[0] + 1, y: component.pos[1] + 1 };
  }

  /**
   * Opens the master behind the first custom instance of the open document in
   * its own tab.
   *
   * A loaded circuit file carries its customs as embedded copies rather than as
   * library entries, so there is no master to open yet — `library.edit`
   * restores the embedded circuit into the browser library first, which is also
   * what fills the palette's User Components section.
   */
  async openCustomForEdit() {
    const [instance] = await this.customInstances();
    await this.api(
      (type) => window.__logigator.library.edit(type),
      instance.type
    );
    await this.settle();
  }

  /** Selects the first custom instance, opening its settings card. */
  async selectCustomInstance() {
    const [instance] = await this.customInstances();
    // A zero-area region is a click: the single element under the point, and
    // no marquee left drawn over the shot.
    const point = this.bodyPoint(instance);
    await this.select({ bounds: { ...point, width: 0, height: 0 } });
    await this.page.locator('app-component-settings lg-card').waitFor();
    await this.settle();
    return instance;
  }

  /** Switches back to the pinned main-project tab. */
  async openMainTab() {
    await this.api(() => window.__logigator.tabs.activate(0));
    await this.settle();
  }

  /** Placed instances of custom masters, which live above the built-in type ids. */
  async customInstances() {
    const custom = await this.api(() => {
      const builtIn = new Set(
        window.__logigator
          .describeCatalog()
          .filter((e) => !e.source)
          .map((e) => e.type)
      );
      return window.__logigator
        .getElements()
        .components.filter((c) => !builtIn.has(c.type));
    });
    if (custom.length === 0) {
      throw new Error('the open circuit has no custom-component instance');
    }
    return custom;
  }

  /** Absolute lever/button input, resolved after the engine's snapshot lands. */
  async setInput(componentId, value) {
    await this.api((a) => window.__logigator.sim.setInput(a.id, a.value), {
      id: componentId,
      value
    });
    await this.settle();
  }

  /**
   * Opens a component's live inspection — the view a tap on it opens while the
   * simulation runs. The handle is kept, so the calls below address it without
   * every shot having to carry it.
   */
  async openWatch(symbol) {
    this.report('opening the inspection');
    const [instance] = await this.componentsOfType(symbol);
    this.watch = await this.api(
      (id) => window.__logigator.inspect.open(id),
      instance.id
    );
    await this.watchWindow().waitFor({ state: 'visible' });
    await this.settle();
    return this.watch;
  }

  /** The floating inspection window. */
  watchWindow() {
    return this.page.locator('lg-window').first();
  }

  /** The open inspection's handle, or a thrown error when none is open. */
  requireWatch() {
    if (!this.watch) throw new Error('no inspection is open');
    return this.watch.id;
  }

  /**
   * Places the inspection window at an absolute viewport point. The window is
   * clamped to the board it floats over, so a target that does not fit is
   * refused rather than silently reframing the shot around a window that ended
   * up somewhere else.
   */
  async moveWatch({ x, y }) {
    const placed = await this.api(
      (a) => window.__logigator.inspect.setBounds(a.id, { x: a.x, y: a.y }),
      { id: this.requireWatch(), x, y }
    );
    await this.settle();
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
   * 100 % at most, so a small circuit in a large window needs this to fill it;
   * `BOARD_ZOOM` gives the inner circuit the same weight as the board's.
   */
  async zoomWatch(zoom) {
    await this.api(
      (a) => {
        const { camera } = window.__logigator.inspect;
        camera.setZoom(a.id, a.zoom);
        camera.focus(a.id, 'content', { maxZoom: a.zoom });
      },
      { id: this.requireWatch(), zoom }
    );
    await this.settle();
  }

  /** `ticks` engine ticks, resolved after the resulting snapshot is applied. */
  async stepSimulation(ticks = 1) {
    this.report('settling the simulation');
    await this.api(async (n) => {
      window.__logigator.sim.pause();
      await window.__logigator.sim.step(n);
    }, ticks);
    await this.settle();
  }

  /**
   * Runs the engine long enough for the inputs to reach the outputs, then
   * pauses so the board holds a settled, photographable state.
   */
  runUntilSettled(ticks = 12) {
    return this.stepSimulation(ticks);
  }

  /**
   * Drills one level down in an open watch by activating the first nested
   * custom of the visible level — the same routing a tap on it takes. The
   * level's elements are a fresh copy of the inner circuit, so their ids are
   * the copy's.
   */
  async drillIntoWatch() {
    const id = this.requireWatch();
    const inner = await this.api((watchId) => {
      const api = window.__logigator;
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
      (a) => window.__logigator.inspect.activate(a.id, a.componentId),
      { id, componentId: inner.id }
    );
    await this.settle();
  }

  /** The open dynamic dialog's card — the thing a dialog shot is of. */
  dialog() {
    return this.page.locator('.cdk-overlay-pane [role="dialog"]').first();
  }

  /**
   * Enters simulation and waits for the engine, so a shot never catches the
   * controls mid-boot. Auto-start is off in the seeded preferences, so the
   * session comes up paused and the board holds still.
   */
  async enterSimulation() {
    this.report('entering simulation');
    const status = await this.api(() => window.__logigator.sim.enter());
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
function clampTo(rect, container) {
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
