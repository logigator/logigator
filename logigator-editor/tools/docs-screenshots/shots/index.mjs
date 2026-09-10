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
 * Two frames of a running circuit, dark then powered, with the given switches
 * flipped between them. The engine is settled for each, so both are
 * deterministic. Both frames share one `target`, as every animated shot's must.
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
 * One entry per image the documentation embeds. `run(editor)` stages the state
 * the picture is of and returns what to capture: a `clip` (CSS px,
 * viewport-relative), a `locator`, or `frames` for an animated one. The editor
 * arrives freshly loaded, dark-themed, tips and changelog popup suppressed,
 * with an empty draft; circuits come from `circuits/*.json`.
 *
 * `intro-banner.png` is absent: it is a designed banner, not a capture.
 */
export const SHOTS = [
  // -- Chrome ---------------------------------------------------------------
  {
    name: 'menu-bar',
    // The bars span the window, so the narrowest viewport crops them tightest.
    context: { viewport: NARROW_VIEWPORT },
    async run(ed) {
      await ed.requireSingleRowToolBar();
      return { clip: await ed.unionClip(['app-title-bar', 'app-tool-bar']) };
    }
  },
  {
    name: 'tool-buttons',
    async run(ed) {
      await ed.requireSingleRowToolBar();
      const tools = [
        'toolBar.pan',
        'toolBar.wireTool',
        'toolBar.select',
        'toolBar.eraser',
        'toolBar.text'
      ].map((key) => ed.button(key));
      return { clip: await ed.unionClip(tools, 6) };
    }
  },
  {
    name: 'board-overview',
    // Embedded at page width, where 3:2 is as tall as the text carries.
    context: { viewport: { height: 720 } },
    async run(ed) {
      await ed.requireSingleRowToolBar();
      await ed.load('half-adder');
      await ed.focus('content', { paddingGrid: 4, maxZoom: BOARD_ZOOM });
      // The minimap's first frame comes off a debounced action stream, so it
      // is not on screen when the import returns.
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
      // A zero-area region is a click: one element, its card in the side
      // panel, and no marquee left drawn over the gate.
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
    // powered frame lights both ends with nothing between.
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
    // Animated: the gate's negated input — the output is high until the switch
    // feeding it goes high.
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
      // The editor's maximum zoom: the subject is a one-unit piece of wire, a
      // handful of pixels at the standard board step.
      await ed.focus('content', { paddingGrid: 3, maxZoom: 1.2 ** 5 });

      // One grid unit out of the middle of the runs feeding the LEDs: the box
      // edges fall between the wires' ends, so each stays selected as a short
      // piece trimmed at the edge rather than grabbed whole — the point of the
      // mode. Whole grid units, because the marquee snaps to the lattice.
      const leds = await ed.componentsOfType('LED');
      const rows = leds.map((led) => led.pos[1]);
      const region = {
        x: Math.min(...leds.map((led) => led.pos[0])) - 3,
        y: Math.min(...rows) - 1,
        width: 1,
        height: Math.max(...rows) - Math.min(...rows) + 2
      };

      // The pill only renders while the select tool is active. The shot is of
      // the gesture's result, so the drag is released and the cut lands.
      await ed.setWorkMode('sel');
      await ed.clickButton('toolBar.selExact');
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
      // At maximum zoom, cropping is the only way left to make a one-unit
      // wire read. The pill is docked to the top of the board, so the circuit
      // is panned up under it rather than the crop reaching down.
      const pill = ed.button('toolBar.selExact');
      const pillBox = await pill.boundingBox();
      // Where the pill sits, in grid units, so the pan needs no px-per-grid.
      const under = await ed.gridOf({
        x: pillBox.x + pillBox.width / 2,
        y: pillBox.y + pillBox.height + 90
      });
      await ed.panBy({
        x: region.x + region.width / 2 - under.x,
        y: region.y + region.height / 2 - under.y
      });

      // Gate to past the LEDs, so the piece cut out has both ends in frame.
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
    // Tall enough for the whole palette: it is one scrolling column, and a
    // clip only captures what is laid out on screen.
    context: { viewport: { width: 1280, height: 1500 } },
    async run(ed) {
      // A loaded file carries its customs as embedded copies; restoring one
      // fills "User Components".
      await ed.load('custom-example');
      await ed.openCustomForEdit();
      await ed.openMainTab();
      await ed.parkPointer();
      // The side-bar host is a window-filling scroll container; its single
      // child is the palette.
      return { clip: await ed.unionClip('app-side-bar > *') };
    }
  },
  {
    // Animated: the gates above and the custom below running the same circuit.
    name: 'custom-component-showcase',
    async run(ed) {
      await ed.load('custom-comparison');
      // The scene stacks the circuit twice; driving the matching switch in
      // both halves is what makes them answer alike.
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
      // Back to Pan: the select tool's scissor pill would float in this crop.
      await ed.setWorkMode('pan');
      await ed.hideOverlays();
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: BOARD_ZOOM,
        anchor: 'top-left'
      });
      // The tabs, not the bar: the bar spans the board and the shot is only as
      // wide as its subject.
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
    // Animated: two ticks of a clock, so the LED is dark then lit.
    name: 'simulation-showcase',
    // The run controls set the frame's width; a wider viewport only adds empty
    // bar to the right of the clock.
    context: { viewport: NARROW_VIEWPORT },
    async run(ed) {
      await ed.requireSingleRowToolBar();
      await ed.load('clock');
      await ed.enterSimulation();
      // Parked under the run controls but centred across them, since the bars
      // set the frame's width. Zoomed past the standard board step, or one
      // clock and one LED read as a detail.
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
    // Animated: the low address line flips, so the highlighted word and the
    // lit output both move.
    name: 'rom-inspection',
    async run(ed) {
      await ed.load('rom');
      // The topmost lever drives A1, the low address bit: 0x00 → 0x01.
      const levers = await ed.componentsOfType('SW');
      const address = levers.sort((a, b) => a.pos[1] - b.pos[1])[0];

      await ed.enterSimulation();
      await ed.runUntilSettled();
      // Zoomed well past the standard board step so the ROM and its address
      // lines fill the left column beside the ~450 px-tall inspector.
      const circuit = await ed.contentClip({
        pad: 2,
        zoom: 1.2 ** 5,
        anchor: 'top-left'
      });
      await ed.openWatch('ROM');
      await ed.moveWatch({ x: circuit.x + circuit.width + 24, y: circuit.y });
      const inspector = await ed.unionClip(ed.watchWindow(), 8);

      // The inspector is the taller, so the circuit rides down to its middle.
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
    // Animated: the watch following the board it mirrors, inner circuit
    // lighting with the outer one.
    name: 'inspection-showcase',
    // Two things side by side: the narrowest viewport puts them as close as
    // the layout allows, and the short height keeps the board off mostly grid.
    context: { viewport: { ...NARROW_VIEWPORT, height: 560 } },
    async run(ed) {
      await ed.requireSingleRowToolBar();
      await ed.load('custom-example');
      await ed.hideOverlays();

      const [lever] = await ed.componentsOfType('SW');
      await ed.enterSimulation();
      await ed.setInput(lever.id, true);
      await ed.runUntilSettled();
      // The standard board step, so the instance matches every other shot.
      await ed.focus('content', { paddingGrid: 3, maxZoom: BOARD_ZOOM });
      await ed.openWatch('EX');

      // The window goes flush to the board's right edge and the circuit into
      // the middle of what is left, whatever size the window came up.
      const board = await ed.canvasBox();
      const watch = await ed.watchWindow().boundingBox();
      const margin = 16;
      // The window is as tall as the board allows: margin only on the sides.
      const left = Math.max(0, board.width - watch.width - margin);
      const top = Math.max(0, Math.min(margin, board.height - watch.height));
      await ed.moveWatch({ x: board.x + left, y: board.y + top });
      await ed.centerContentAt({ x: left / 2 });
      // A watch fits its circuit at 100 % at most, which leaves this one small
      // in a window this size; `BOARD_ZOOM` gives the inner circuit the same
      // weight as the instance beside it.
      await ed.zoomWatch(BOARD_ZOOM);
      return switchedFrames(ed, { clip: await ed.fullViewportClip() }, [lever]);
    }
  },
  {
    name: 'inspection-window-multilayer',
    // The watch is clamped to the board it floats over, so a short viewport
    // makes a short window. Each level is fit to the canvas when it first
    // shows, and these open at the window's final size, so the smaller window
    // means less empty grid, not a cropped circuit.
    context: { viewport: { height: 440 } },
    async run(ed) {
      await ed.load('nested-custom');
      await ed.focus('content', { paddingGrid: 3, maxZoom: 1 });
      await ed.enterSimulation();
      await ed.openWatch('OTR');
      // Drilling in is what puts the "Outer › Inner" trail in the header.
      await ed.drillIntoWatch();
      await ed.parkPointer();
      return { locator: ed.watchWindow() };
    }
  },

  // -- Dialogs --------------------------------------------------------------
  {
    name: 'open-file',
    async run(ed) {
      await ed.menu(
        'titleBar.menuBar.file.label',
        'titleBar.menuBar.file.items.open.label'
      );
      await ed.clickTab('openProjectDialog.fromFile');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  {
    name: 'export-image',
    async run(ed) {
      await ed.load('half-adder');
      await ed.menu(
        'titleBar.menuBar.file.label',
        'titleBar.menuBar.file.items.generateImage.label'
      );
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  // -- Cloud ----------------------------------------------------------------
  //
  // `context: { cloud: true }` runs the shot against `lib/mock-api.mjs`, not a
  // real backend.
  {
    name: 'account-menu',
    // This shot is *of* the preferences, so it shows their shipped defaults
    // rather than the values the capture run pins for determinism.
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
      // Padded, so neither the panel nor its trigger is cut flush. The
      // trigger sits 4 px from the window's right edge and `unionClip` clamps
      // there, so that side keeps the smaller margin.
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
      await ed.menu(
        'titleBar.menuBar.file.label',
        'titleBar.menuBar.file.items.open.label'
      );
      await ed.clickTab('openProjectDialog.cloudProjects');
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
      // Both must reach the browser library: restoring "Outer" opens its
      // circuit, where "Inner" is an embedded copy until restored in turn.
      await ed.load('nested-custom');
      await ed.openCustomForEdit();
      await ed.openCustomForEdit();
      await ed.openMainTab();
      await ed.selectCustomInstance();
      await ed.clickButton('uploadComponent.button');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },
  {
    name: 'share-component',
    context: { cloud: true },
    async run(ed) {
      // Sharing acts on a component that already lives in the cloud.
      const type = await ed.typeOf('Memory');
      await ed.api(
        (t) =>
          window.__logigator.applyEdit([
            { op: 'addComponent', type: t, pos: [4, 4], direction: 0 }
          ]),
        type
      );
      await ed.selectCustomInstance();
      await ed.clickButton('shareComponent.button');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  },

  {
    name: 'shortcut-manager',
    // The dialog fills the window's height and its list scrolls. A viewport
    // holding every binding makes an image too tall to read, so this frames
    // the first sections only.
    context: { viewport: { width: 1280, height: 820 } },
    async run(ed) {
      await ed.menu('titleBar.menuBar.edit.label', 'shortcuts.title');
      await ed.parkPointer();
      return { locator: ed.dialog() };
    }
  }
];
