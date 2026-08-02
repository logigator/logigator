import { BOARD_ZOOM, NARROW_VIEWPORT } from '../config.mjs';

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
 * Two frames of a running circuit with the given switches flipped between them:
 * the scene dark, then the same scene powered. The engine is stepped to a
 * settled state for each, so both frames are deterministic. `target` is a
 * `clip` or a `locator` and is shared by both, as every animated shot's must be.
 */
async function switchedFrames(ed, target, levers) {
  const frames = [];
  for (const on of [false, true]) {
    for (const lever of levers) {
      await ed.setInput(lever.id, on);
    }
    await ed.runUntilSettled();
    await ed.parkPointer();
    frames.push(await ed.snap(target));
  }
  return { frames };
}

/**
 * One entry per image the documentation embeds. `run(editor)` puts the editor
 * into the state the picture is of and returns what to capture: a `clip` (CSS
 * px, viewport-relative) or a `locator` — or, for an animated one, the `frames`
 * it captured along the way. The editor arrives freshly loaded, dark-themed,
 * with tips and the changelog popup suppressed and an empty draft open;
 * circuits come from `circuits/*.json` via `editor.load(name)`.
 *
 * Not here, because it is not a capture of the editor: `intro-banner.png`, a
 * designed banner.
 */
export const SHOTS = [
  // -- Chrome ---------------------------------------------------------------
  {
    name: 'menu-bar',
    // The bars span the window, so the narrowest desktop viewport is also the
    // tightest crop of them.
    context: { viewport: NARROW_VIEWPORT },
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
    // Shorter than the standard viewport: this is a whole-window shot, and the
    // documentation embeds it at page width, where a 3:2 window is as tall as
    // the surrounding text can carry.
    context: { viewport: { height: 720 } },
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
      // A zero-area region is a click: the single element under the point,
      // which is what puts its card in the side panel — and no marquee stays
      // drawn over the gate.
      await ed.select({
        bounds: { ...ed.bodyPoint(gate), width: 0, height: 0 }
      });
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
    // Animated: the switch drives the far LED through the tunnel pair, so the
    // frame that powers it shows the two ends light up with nothing between.
    name: 'tunnel',
    async run(ed) {
      await ed.load('tunnels');
      const [lever] = await ed.componentsOfType('SW');
      await ed.enterSimulation();
      const clip = await ed.contentClip({ pad: 1.5 });
      return switchedFrames(ed, { clip }, [lever]);
    }
  },
  {
    // Animated: the gate's negated input, which is what the page is about —
    // the output is high until the switch feeding it goes high.
    name: 'negated-gate',
    async run(ed) {
      await ed.load('negated-gate');
      const [lever] = await ed.componentsOfType('SW');
      await ed.enterSimulation();
      const clip = await ed.contentClip({ pad: 1.5 });
      return switchedFrames(ed, { clip }, [lever]);
    }
  },
  {
    name: 'scissor-select',
    async run(ed) {
      await ed.load('half-adder');
      // The editor's maximum zoom (`ZOOM_STEP_MAX`), because the subject is a
      // one-unit piece of wire — a handful of pixels at the standard board step.
      await ed.focus('content', { paddingGrid: 3, maxZoom: 1.2 ** 5 });

      // One grid unit of the runs feeding the LEDs, taken out of the middle of
      // them: the box edges fall between the wires' ends, so what stays selected
      // is a short piece of each — trimmed at the box edge instead of grabbed
      // whole, which is the whole point of the mode. Whole grid units, because
      // the marquee snaps to the lattice.
      const leds = await ed.componentsOfType('LED');
      const rows = leds.map((led) => led.pos[1]);
      const region = {
        x: Math.min(...leds.map((led) => led.pos[0])) - 3,
        y: Math.min(...rows) - 1,
        width: 1,
        height: Math.max(...rows) - Math.min(...rows) + 2
      };

      // The pill only renders while the select tool is active. The marquee is a
      // live gesture, and the shot is of its result: drag it, then release, so
      // the cut lands and the enclosed elements come up selected instead of the
      // half-drawn rectangle staying on screen.
      await ed.setWorkMode('sel');
      await ed.clickButton('Cut wires at selection edge (hold to activate)');
      const from = await ed.gridPoint({ x: region.x, y: region.y });
      const to = await ed.gridPoint({
        x: region.x + region.width,
        y: region.y + region.height
      });
      await ed.page.mouse.move(from.x, from.y);
      await ed.page.mouse.down();
      await ed.page.mouse.move(to.x, to.y, { steps: 8 });
      await ed.page.mouse.up();
      await ed.parkPointer();
      // The pill and the cut, with nothing between them: the board is already at
      // its maximum zoom, so cropping is the only way left to make a one-unit
      // piece of wire read. The pill is docked to the top of the board, so the
      // circuit is panned up under it rather than the crop reaching down to it.
      const pill = ed.page.getByRole('button', {
        name: 'Cut wires at selection edge (hold to activate)'
      });
      const pillBox = await pill.boundingBox();
      // Where the pill sits, in grid units — the cut is panned onto that point
      // rather than the two being related through a hand-rolled px-per-grid.
      const under = await ed.gridOf({
        x: pillBox.x + pillBox.width / 2,
        y: pillBox.y + pillBox.height + 90
      });
      await ed.panBy({
        x: region.x + region.width / 2 - under.x,
        y: region.y + region.height / 2 - under.y
      });

      // From the gate that drives the wires to past the LEDs they end at, so the
      // piece taken out of the middle has both its ends in frame.
      const cut = await ed.gridClip({
        x: region.x - 4,
        y: region.y - 1,
        width: region.width + 8,
        height: region.height + 1.5
      });
      return { clip: mergeRects(await ed.unionClip(pill, 8), cut) };
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
    // Animated: one switch of the built-in half of the comparison, so the gates
    // above and the custom below are seen running the same circuit.
    name: 'custom-component-showcase',
    async run(ed) {
      await ed.load('custom-comparison');
      // The scene stacks the same circuit twice — gates above, the custom
      // below. Driving the matching switch in both is what makes the two halves
      // answer alike, which is the comparison the page is making.
      const bounds = await ed.contentBounds();
      const middle = bounds.y + bounds.height / 2;
      const levers = (await ed.componentsOfType('SW')).sort(
        (a, b) => a.pos[1] - b.pos[1]
      );
      const drive = [
        levers.find((lever) => lever.pos[1] < middle),
        levers.find((lever) => lever.pos[1] >= middle)
      ].filter(Boolean);

      await ed.enterSimulation();
      const clip = await ed.contentClip({ pad: 2, zoom: 1.2 ** 2 });
      return switchedFrames(ed, { clip }, drive);
    }
  },
  {
    name: 'custom-component-tab',
    async run(ed) {
      await ed.load('custom-example');
      await ed.openCustomForEdit();
      // Back to Pan: the select tool's scissor pill floats over the board and
      // would sit in the middle of this crop.
      await ed.setWorkMode('pan');
      await ed.hideOverlays();
      // The tab bar plus exactly the circuit the component tab opened onto.
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: BOARD_ZOOM,
        anchor: 'top-left'
      });
      // The tabs themselves, not the bar they sit in: the bar runs the full
      // width of the board, and the shot is only as wide as its subject.
      const tabs = await ed.unionClip('app-tab-bar [role="tab"]');
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
    // The run controls span the window, and they set the frame's width — a
    // wider viewport only adds empty bar to the right of the clock.
    context: { viewport: NARROW_VIEWPORT },
    async run(ed) {
      await ed.load('clock');
      await ed.enterSimulation();
      // The run controls belong in frame, so the circuit is parked directly
      // under them rather than in the middle of the board — but centred across
      // them, since the bars are what set the frame's width. Zoomed past the
      // standard board step: the scene is one clock driving one LED, and at
      // 100 % it reads as a detail in the corner of a picture of the bars.
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: 1.2 ** 4,
        anchor: 'top'
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
      // Zoomed well past the standard board step so the ROM and its address
      // lines carry the frame's left column: the inspector beside them is
      // ~450 px tall, and a 100 % circuit leaves that column mostly empty.
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: 1.2 ** 5,
        anchor: 'top-left'
      });
      await ed.openWatch('ROM');
      await ed.moveWatch({ x: circuit.x + circuit.width + 24, y: circuit.y });
      const inspector = await ed.unionClip(ed.watchWindow(), 8);

      // The inspector is the taller of the two, so the circuit rides down to
      // its middle rather than sitting at the top of a half-empty column.
      const board = await ed.canvasBox();
      const bounds = await ed.contentBounds();
      await ed.centerContentAt({
        y: inspector.y + inspector.height / 2 - board.y
      });
      await ed.parkPointer();
      const clip = mergeRects(await ed.gridClip(bounds, 2), inspector);

      const frames = [await ed.snap({ clip })];
      await ed.setInput(address.id, true);
      await ed.runUntilSettled();
      await ed.parkPointer();
      frames.push(await ed.snap({ clip }));
      return { frames };
    }
  },
  {
    // Animated: the instance's switch, so the watch is seen following the board
    // it mirrors — the inner circuit lights with the outer one.
    name: 'inspection-showcase',
    // A whole-window shot of two things side by side: the narrowest desktop
    // viewport puts the circuit and the watch as close together as the layout
    // allows, and the short height keeps the board from being mostly grid.
    context: { viewport: { ...NARROW_VIEWPORT, height: 560 } },
    async run(ed) {
      await ed.load('custom-example');
      await ed.hideOverlays();

      const [lever] = await ed.componentsOfType('SW');
      await ed.enterSimulation();
      await ed.setInput(lever.id, true);
      await ed.runUntilSettled();
      // Zoomed to the standard board step, so the instance is the same size
      // here as on every other board shot.
      await ed.focus('content', { paddingGrid: 3, maxZoom: BOARD_ZOOM });
      await ed.openWatch('EX');

      // The window is dragged flush to the board's right edge and the circuit
      // parked in the middle of what is left, so the two read side by side at
      // whatever size the window came up.
      const board = await ed.canvasBox();
      const watch = await ed.watchWindow().boundingBox();
      const margin = 16;
      // The window comes up as tall as the board allows, so there is only ever
      // room for the margin on the sides.
      const left = Math.max(0, board.width - watch.width - margin);
      const top = Math.max(0, Math.min(margin, board.height - watch.height));
      await ed.moveWatch({ x: board.x + left, y: board.y + top });
      await ed.centerContentAt({ x: left / 2 });
      // The watch fits its circuit at 100 % at most, which leaves this one small
      // in a window this size; framing it at `BOARD_ZOOM` gives the inner
      // circuit the same weight as the instance on the board beside it.
      await ed.zoomWatch(BOARD_ZOOM);
      return switchedFrames(ed, { clip: await ed.fullViewportClip() }, [lever]);
    }
  },
  {
    name: 'inspection-window-multilayer',
    // The watch opens at 640×480 but is clamped to the board it floats over, so
    // a short viewport is what makes the window short. The circuit inside is
    // fit to the canvas when a level first shows, and this shot only opens its
    // levels once the window is already at its final size — so the smaller
    // window means less empty grid around the circuit, not a cropped one.
    context: { viewport: { height: 440 } },
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
      // Padded, so neither the panel nor the button it hangs off is cut flush
      // by the crop. The trigger sits 4 px from the window's right edge, and
      // `unionClip` clamps there — that side keeps the smaller margin.
      return {
        clip: await ed.unionClip([trigger, panel], {
          top: 8,
          left: 12,
          bottom: 8,
          right: 8
        })
      };
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
    // The dialog fills the window's height, and its list scrolls: a viewport
    // tall enough to hold every binding makes an image the docs cannot show at
    // a readable size. This frames the first sections and lets the rest scroll.
    context: { viewport: { width: 1280, height: 820 } },
    async run(ed) {
      await ed.menu('Edit', 'Keyboard Shortcuts');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  }
];
