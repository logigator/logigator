import { BOARD_ZOOM } from '../config.mjs';

/** Smallest clip covering every given rectangle. */
function mergeRects(...rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y
  };
}

/**
 * One entry per image the documentation embeds. `run(editor)` puts the editor
 * into the state the picture is of and returns what to capture: a `clip` (CSS
 * px, viewport-relative) or a `locator`. The editor arrives freshly loaded,
 * dark-themed, with tips and the changelog popup suppressed and an empty draft
 * open; circuits come from `circuits/*.json` via `editor.load(name)`.
 *
 * Not here, because they are not captures of the editor: `intro-banner.png` (a
 * designed banner) and the two `.gif`s (animations).
 */
export const SHOTS = [
  // -- Chrome ---------------------------------------------------------------
  {
    name: 'menu-bar',
    async run(ed) {
      return { clip: await ed.unionClip(['app-title-bar', 'app-tool-bar']) };
    }
  },
  {
    name: 'tool-buttons',
    async run(ed) {
      const tools = ['Pan', 'Wire Tool', 'Select', 'Eraser', 'Text'].map(
        (name) => ed.page.getByRole('button', { name, exact: true })
      );
      return { clip: await ed.unionClip(tools, 6) };
    }
  },
  {
    name: 'board-overview',
    async run(ed) {
      await ed.load('half-adder');
      await ed.focus('content', { paddingGrid: 4, maxZoom: BOARD_ZOOM });
      // The minimap renders its first frame off a debounced action stream, so
      // it is not on screen when the import returns.
      await ed.waitVisible('app-minimap canvas');
      await ed.parkPointer();
      return { clip: await ed.fullViewportClip() };
    }
  },
  {
    name: 'component-settings',
    async run(ed) {
      await ed.load('single-gate');
      const [gate] = (await ed.elements()).components;
      await ed.focus('content', { paddingGrid: 8, maxZoom: 1 });
      // Selected with a real click: the settings card follows the selection
      // inspector, which does not observe an `api.select()`.
      await ed.clickButton('Select');
      await ed.clickGrid({ x: gate.pos[0] + 1, y: gate.pos[1] + 1 });
      await ed.parkPointer();
      return { clip: await ed.unionClip('app-component-settings lg-card', 8) };
    }
  },

  // -- Board ----------------------------------------------------------------
  {
    name: 'wire-circuit-display',
    async run(ed) {
      await ed.load('wiring-showcase');
      return { clip: await ed.contentClip({ pad: 2 }) };
    }
  },
  {
    name: 'wire-junction',
    async run(ed) {
      await ed.load('wire-junctions');
      return { clip: await ed.contentClip({ pad: 2 }) };
    }
  },
  {
    name: 'tunnel',
    async run(ed) {
      await ed.load('tunnels');
      return { clip: await ed.contentClip({ pad: 1.5 }) };
    }
  },
  {
    name: 'negated-gate',
    async run(ed) {
      await ed.load('negated-gate');
      return { clip: await ed.contentClip({ pad: 1.5 }) };
    }
  },
  {
    name: 'scissor-select',
    async run(ed) {
      await ed.load('half-adder');
      await ed.focus('content', { paddingGrid: 3, maxZoom: BOARD_ZOOM });

      // The pill only renders while the select tool is active, and the marquee
      // is a live gesture: press and drag, and stop before releasing so the
      // half-drawn rectangle is in frame.
      await ed.clickButton('Select');
      await ed.clickButton('Cut wires at selection edge (hold to activate)');
      const from = await ed.gridPoint({ x: 5, y: 13 });
      const to = await ed.gridPoint({ x: 20, y: 16 });
      await ed.page.mouse.move(from.x, from.y);
      await ed.page.mouse.down();
      await ed.page.mouse.move(to.x, to.y, { steps: 8 });
      await ed.settle();
      return { clip: await ed.unionClip(['app-tool-bar', 'app-board']) };
    }
  },

  // -- Custom components ----------------------------------------------------
  {
    name: 'component-palette',
    // Tall enough to hold the whole palette: it is one scrolling column, and a
    // clip only ever captures what is laid out on screen.
    context: { viewport: { width: 1280, height: 1500 } },
    async run(ed) {
      // A loaded file carries its customs as embedded copies; restoring one
      // into the browser library is what fills "User Components".
      await ed.load('custom-example');
      await ed.openCustomForEdit();
      await ed.openMainTab();
      await ed.parkPointer();
      // The side-bar host is a scroll container that fills the window; its
      // single child is the palette itself, which is what the shot frames.
      return { clip: await ed.unionClip('app-side-bar > *') };
    }
  },
  {
    name: 'custom-component-showcase',
    async run(ed) {
      await ed.load('custom-comparison');
      return { clip: await ed.contentClip({ pad: 2, zoom: 1.2 ** 2 }) };
    }
  },
  {
    name: 'custom-component-tab',
    async run(ed) {
      await ed.load('custom-example');
      await ed.openCustomForEdit();
      // Back to Pan: the select tool's scissor pill floats over the board and
      // would sit in the middle of this crop.
      await ed.clickButton('Pan');
      await ed.hideOverlays();
      // The tab bar plus exactly the circuit the component tab opened onto.
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: 1,
        anchor: 'top-left'
      });
      const tabs = await ed.unionClip('app-tab-bar');
      return { clip: mergeRects(tabs, circuit) };
    }
  },

  // -- Simulation -----------------------------------------------------------
  {
    name: 'simulation-controls',
    async run(ed) {
      await ed.load('half-adder');
      await ed.enterSimulation();
      return { clip: await ed.unionClip('app-simulation-controls', 4) };
    }
  },
  {
    // Animated: two ticks of a clock, so the LED is dark in one frame and lit
    // in the next. A `frames` result is encoded as a GIF instead of a PNG.
    name: 'simulation-showcase',
    async run(ed) {
      await ed.load('clock');
      await ed.enterSimulation();
      // The run controls belong in frame, so the circuit is parked directly
      // under them rather than centred in the board.
      const circuit = await ed.contentClip({
        pad: 3,
        zoom: 1,
        anchor: 'top-left'
      });
      const bars = await ed.unionClip(['app-title-bar', 'app-tool-bar']);
      const clip = mergeRects(bars, circuit);

      const frames = [];
      for (let tick = 0; tick < 2; tick++) {
        await ed.stepSimulation();
        await ed.parkPointer();
        frames.push(await ed.snap({ clip }));
      }
      return { frames };
    }
  },
  {
    // Animated: the ROM inspector following the address as the low address
    // line flips, so the highlighted word and the lit output both move.
    name: 'rom-inspection',
    async run(ed) {
      await ed.load('rom');
      // The topmost lever drives A1, the low address bit — flipping it is what
      // moves the addressed word from 0x00 to 0x01.
      const levers = await ed.componentsOfType('SW');
      const address = levers.sort((a, b) => a.pos[1] - b.pos[1])[0];

      await ed.enterSimulation();
      await ed.runUntilSettled();
      const circuit = await ed.contentClip({
        pad: 3,
        zoom: 1,
        anchor: 'top-left'
      });
      await ed.openWatch('ROM');
      await ed.moveWatch({ x: circuit.x + circuit.width + 24, y: circuit.y });
      await ed.parkPointer();
      const window = await ed.unionClip(ed.watchWindow(), 8);
      const clip = mergeRects(circuit, window);

      const frames = [await ed.snap({ clip })];
      await ed.setInput(address.id, true);
      await ed.runUntilSettled();
      await ed.parkPointer();
      frames.push(await ed.snap({ clip }));
      return { frames };
    }
  },
  {
    name: 'inspection-showcase',
    async run(ed) {
      await ed.load('custom-example');
      // The circuit sits in the left third; the watch window is dragged into
      // the space on the right, so both are readable side by side.
      await ed.focus('content', { paddingGrid: 3, maxZoom: 1 });
      await ed.panBy({ x: 14, y: 0 });
      await ed.hideOverlays();

      const [lever] = await ed.componentsOfType('SW');
      await ed.enterSimulation();
      await ed.setInput(lever.id, true);
      await ed.runUntilSettled();
      await ed.openWatch('EX');
      await ed.moveWatch({ x: 700, y: 150 });
      await ed.parkPointer();
      return { clip: await ed.fullViewportClip() };
    }
  },
  {
    name: 'inspection-window-multilayer',
    async run(ed) {
      await ed.load('nested-custom');
      await ed.focus('content', { paddingGrid: 3, maxZoom: 1 });
      await ed.enterSimulation();
      await ed.openWatch('OTR');
      // Drill into the nested master from the watch canvas, which is what puts
      // the "Outer › Inner" trail in the window's header.
      await ed.drillIntoWatch();
      await ed.parkPointer();
      return { locator: ed.watchWindow() };
    }
  },

  // -- Dialogs --------------------------------------------------------------
  {
    name: 'open-file',
    async run(ed) {
      await ed.menu('File', 'Open');
      await ed.page.getByRole('tab', { name: 'From File' }).click();
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  {
    name: 'export-image',
    async run(ed) {
      await ed.load('half-adder');
      await ed.menu('File', 'Generate image');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  // -- Cloud ----------------------------------------------------------------
  //
  // These run against `lib/mock-api.mjs` rather than a real backend: a live
  // account would put a drifting project list and a moving "Last edited" date
  // into the docs, so the images would churn on every capture.
  {
    name: 'account-menu',
    // This shot is *of* the preferences, so it shows them at their shipped
    // defaults rather than at the values the capture run pins for determinism.
    context: {
      cloud: true,
      localStorage: {
        'logigator.settings': JSON.stringify({
          fpsCounter: true,
          showGrid: true,
          autoStartSimulation: true
        }),
        'logigator.onboarding.tips-enabled': 'true'
      }
    },
    async run(ed) {
      const trigger = ed.page.locator('app-user-settings > button');
      await trigger.click();
      const panel = ed.page.locator('app-user-settings-panel');
      await panel.waitFor({ state: 'visible' });
      await ed.waitStable(panel);
      await ed.parkPointer();
      return { clip: await ed.unionClip([trigger, panel]) };
    }
  },
  {
    name: 'open-cloud',
    context: { cloud: true },
    async run(ed) {
      await ed.menu('File', 'Open');
      await ed.page.getByRole('tab', { name: 'Cloud Projects' }).click();
      await ed.page.getByText('Example', { exact: true }).waitFor();
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  {
    name: 'upload-to-cloud',
    context: { cloud: true },
    async run(ed) {
      // "Outer" embeds "Inner", so the dialog has a local dependency to list.
      // Both have to reach the browser library for that: restoring "Outer"
      // opens its circuit, where "Inner" is still an embedded copy until it is
      // restored in turn.
      await ed.load('nested-custom');
      await ed.openCustomForEdit();
      await ed.openCustomForEdit();
      await ed.openMainTab();
      await ed.selectCustomInstance();
      await ed.clickButton('Upload to cloud');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  {
    name: 'share-component',
    context: { cloud: true },
    async run(ed) {
      // A cloud master from the mocked library, placed and selected: sharing is
      // an action on a component that already lives in the cloud.
      const type = await ed.typeOf('Memory');
      await ed.api(
        (t) =>
          window.__logigator.applyEdit([
            { op: 'addComponent', type: t, pos: [4, 4], direction: 0 }
          ]),
        type
      );
      await ed.selectCustomInstance();
      await ed.clickButton('Share');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },

  {
    name: 'shortcut-manager',
    context: { viewport: { width: 1280, height: 1400 } },
    async run(ed) {
      await ed.menu('Edit', 'Keyboard Shortcuts');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  }
];
