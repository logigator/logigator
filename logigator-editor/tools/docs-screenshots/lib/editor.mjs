import {
  BOARD_ZOOM,
  CIRCUITS_DIR,
  DEVICE_SCALE_FACTOR,
  GRID_SIZE,
  SEEDED_LOCAL_STORAGE,
  VIEWPORT
} from '../config.mjs';
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
   * @param {{ baseUrl: string }} options
   */
  constructor(browser, options) {
    this.browser = browser;
    this.baseUrl = options.baseUrl;
    this.context = null;
    this.page = null;
  }

  /**
   * Opens the editor in a clean context. `viewport` widens or heightens the
   * window for shots that frame something taller than the standard one (the
   * full component palette, the shortcut manager); `cloud` installs the mocked
   * backend and the signed-in session.
   */
  async open({ viewport, cloud, localStorage: overrides } = {}) {
    this.context = await this.browser.newContext({
      viewport: { ...VIEWPORT, ...viewport },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: 'dark',
      reducedMotion: 'reduce'
    });
    await this.context.addInitScript(
      (entries) => {
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, value);
        }
      },
      { ...SEEDED_LOCAL_STORAGE, ...overrides }
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
    await this.parkPointer();
    await this.settle();
    return this;
  }

  async close() {
    await this.context?.close();
    this.context = null;
    this.page = null;
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

  viewport() {
    return this.api(() => window.__logigator.camera.getViewport());
  }

  settings(patch) {
    return this.api((p) => window.__logigator.settings.set(p), patch);
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

  /** Bounding box of the board canvas, in CSS px relative to the viewport. */
  async canvasBox() {
    const box = await this.page.locator('app-board canvas').boundingBox();
    if (!box) throw new Error('board canvas has no box');
    return box;
  }

  /**
   * Grid rectangle → clip rectangle in CSS px, via the camera's current
   * grid-to-screen mapping. `pad` is in grid units, so framing stays stable
   * across zoom levels.
   */
  async gridClip(rect, pad = 0) {
    const [{ view, screen }, canvas] = await Promise.all([
      this.viewport(),
      this.canvasBox()
    ]);
    const pxPerGridX = screen.width / view.width;
    const pxPerGridY = screen.height / view.height;
    // Clamped to the canvas, not the window: a crop that ran past the board
    // would otherwise pick up the status bar or the side-bar's edge.
    return clampTo(
      {
        x: canvas.x + (rect.x - pad - view.x) * pxPerGridX,
        y: canvas.y + (rect.y - pad - view.y) * pxPerGridY,
        width: (rect.width + pad * 2) * pxPerGridX,
        height: (rect.height + pad * 2) * pxPerGridY
      },
      canvas
    );
  }

  /** Grid point → viewport CSS px, for driving the mouse over the board. */
  async gridPoint(pos) {
    const [{ view, screen }, canvas] = await Promise.all([
      this.viewport(),
      this.canvasBox()
    ]);
    return {
      x: canvas.x + ((pos.x - view.x) * screen.width) / view.width,
      y: canvas.y + ((pos.y - view.y) * screen.height) / view.height
    };
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
    const bounds = await this.api(() => window.__logigator.getProject().bounds);
    if (!bounds) throw new Error('the project is empty — nothing to frame');
    if (!overlays) await this.hideOverlays();

    const board = await this.canvasBox();
    // 'top-left' parks the circuit in the board's top-left corner, so a clip
    // that also has to reach the chrome above the board stays tight.
    const half =
      anchor === 'top-left'
        ? {
            x: board.width / GRID_SIZE / zoom / 2 - pad,
            y: board.height / GRID_SIZE / zoom / 2 - pad
          }
        : { x: bounds.width / 2, y: bounds.height / 2 };
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
    const left = Math.min(...boxes.map((b) => b.x)) - pad;
    const top = Math.min(...boxes.map((b) => b.y)) - pad;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
    return clampTo(
      { x: left, y: top, width: right - left, height: bottom - top },
      { x: 0, y: 0, ...(await this.page.viewportSize()) }
    );
  }

  // -- Chrome helpers ------------------------------------------------------

  /** Opens a top-level menu (File / Edit / View / Help) and picks an item. */
  async menu(menuLabel, itemLabel) {
    await this.page.getByRole('menuitem', { name: menuLabel }).click();
    await this.page.getByRole('menuitem', { name: itemLabel }).click();
    await this.settle();
  }

  /** Clicks a toolbar/tool button by its accessible name. */
  async clickButton(name, options) {
    await this.page.getByRole('button', { name, exact: true }).click(options);
    await this.settle();
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
    let previous = null;
    for (let i = 0; i < attempts; i++) {
      const box = await locator.boundingBox();
      if (previous && JSON.stringify(box) === JSON.stringify(previous)) return;
      previous = box;
      await this.settle();
    }
    throw new Error('element never settled into a stable position');
  }

  /** Clicks a grid point on the board with the current tool. */
  async clickGrid(pos) {
    const point = await this.gridPoint(pos);
    await this.page.mouse.click(point.x, point.y);
    await this.settle();
  }

  /**
   * Saves the draft as a named local project, which is what turns the title
   * bar's "Draft" chip into a name and the status bar into "Saved". Cloud
   * destinations need a session; local needs nothing.
   */
  async saveAs(name) {
    await this.menu('File', 'Save');
    const dialog = this.dialog();
    await dialog.locator('#save-project-name').fill(name);
    await dialog.getByRole('button', { name: 'Local', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
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
   * Opens the master behind the first custom instance in a second tab.
   *
   * A loaded circuit file carries its customs as embedded copies rather than as
   * library entries, so the settings card offers "Restore & edit" — which
   * rebuilds the master into the browser library — where a document opened from
   * the library would offer "Edit circuit". Either way the master ends up in the
   * library, which is also what fills the palette's User Components section.
   */
  async openCustomForEdit() {
    await this.selectCustomInstance();
    const edit = this.page.getByRole('button', {
      name: 'Edit circuit',
      exact: true
    });
    const restore = this.page.getByRole('button', {
      name: 'Restore & edit',
      exact: true
    });
    await edit.or(restore).first().click();
    await this.page.locator('app-tab-bar [role="tab"]').nth(1).waitFor();
    await this.settle();
  }

  /** Clicks the first custom instance with the select tool, opening its card. */
  async selectCustomInstance() {
    const [instance] = await this.customInstances();
    await this.clickButton('Select');
    await this.clickGrid(this.bodyPoint(instance));
    await this.page.locator('app-component-settings lg-card').waitFor();
    await this.settle();
    return instance;
  }

  /** Switches back to the pinned main-project tab. */
  async openMainTab() {
    await this.page.locator('app-tab-bar [role="tab"]').first().click();
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
   * Opens a component's live inspection the way a user does — by tapping it
   * while the simulation runs.
   */
  async openWatch(symbol) {
    const [instance] = await this.componentsOfType(symbol);
    await this.clickGrid(this.bodyPoint(instance));
    await this.watchWindow().waitFor({ state: 'visible' });
    await this.settle();
  }

  /** The floating inspection window. */
  watchWindow() {
    return this.page.locator('lg-window').first();
  }

  /** Drags the inspection window by its header to an absolute viewport point. */
  async moveWatch({ x, y }) {
    const header = this.watchWindow().locator('div').first();
    const box = await header.boundingBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(x + box.width / 2, y + box.height / 2, {
      steps: 6
    });
    await this.page.mouse.up();
    await this.settle();
  }

  /** One engine tick, resolved after its snapshot has been applied. */
  async stepSimulation() {
    await this.api(async () => {
      window.__logigator.sim.pause();
      await window.__logigator.sim.step();
    });
    await this.settle();
  }

  /**
   * Runs the engine long enough for the inputs to reach the outputs, then
   * pauses so the board holds a settled, photographable state.
   */
  async runUntilSettled(ticks = 12) {
    await this.api(async (n) => {
      const api = window.__logigator;
      api.sim.pause();
      for (let i = 0; i < n; i++) await api.sim.step();
    }, ticks);
    await this.settle();
  }

  /**
   * Drills one level down in an open watch by tapping the nested master at the
   * centre of its canvas — the watch frames its circuit, so the nested
   * component sits in the middle.
   */
  async drillIntoWatch() {
    const canvas = this.watchWindow().locator('canvas').first();
    const box = await canvas.boundingBox();
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
