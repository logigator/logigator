import type { GridRect } from '../../../../src/app/automation/automation-api.model.ts';
import type { Editor } from '../../lib/editor.ts';
import type { Shot } from '../../lib/target.ts';

/**
 * The scene, from `circuits/`: "LOGIGATOR" scrolling across three 16×16 LED
 * matrices, driven by a counter, a font ROM and a RAM holding the picture.
 */
const CIRCUIT = 'hero-marquee';
/** The display, by catalog name; the pictures are framed around it. */
const MATRIX = 'LED Matrix';

/**
 * Clock pulses per displayed frame. A fact of the circuit's design that its
 * file does not state: each of the 16 display rows takes 4 pulses — latch the
 * bits that cross into the left half-row, shift and write back both half-rows,
 * and one idle pulse that keeps the counter a plain binary one.
 */
const PULSES_PER_FRAME = 16 * 4;
/** Frames in a lap: the text is a 128-column strip scrolled a column a frame. */
const LAP_FRAMES = 128;
/** Where the loop starts within a lap, which is what the still shows. */
const START_FRAME = 46;
/**
 * Ticks past a frame boundary each frame is sampled at. A frame's rows are
 * drawn from the middle, row 8 first, so the frame is whole once that row has
 * latched its second half, 26 ticks in, until the next row latches at 74:
 * sampled in between, the data lines under the matrices carry a row of text.
 * At 40 the clock is high as well, so its lines are lit. Found by stepping
 * through a frame a tick at a time.
 */
const SAMPLE_PHASE = 40;
/**
 * Ticks before the sample the display must already show the same picture.
 * The shots check it, so a retimed circuit fails rather than tearing.
 */
const HOLD_TICKS = 12;
/**
 * Frames between two the loop stores whole. A browser decodes a frame it
 * skipped to from the last whole one — a page coming back from the
 * background skips to where the loop is by the clock — so this bounds that
 * work, at the price of one whole frame of bytes per interval. Chromium
 * spends about 5 ms a frame on it: 12 keeps the stall near 60 ms for 12%
 * more bytes than 16, where 8 would take a third more.
 */
const KEYFRAME_INTERVAL = 12;
/**
 * How long each frame is held — one column of scroll. A frame is one sample,
 * at the same point of the circuit's cycle every time, so only what changes
 * once a column moves changes on screen: a circuit at work, not flicker.
 */
const FRAME_DELAY = 125;

/**
 * Output px per grid unit over the grid size — 16 px a cell. Whole, because
 * the export keeps line weights at their 1 px of the 100% board and scales
 * them with the rest: at a fraction every wire and grid dot would spill into
 * a blended neighbouring pixel, which is softer and costs bytes.
 */
const MULTIPLIER = 1;

/**
 * Grid columns left off the frame's left edge. Beside the copy the home
 * page's scrim is opaque over the frame's first 27.5 columns at every width,
 * so a render starting a little inside that never shows its edge; one
 * starting where the scrim has begun to lift does, as a faint vertical line.
 */
const HIDDEN_COLUMNS = 25;

/**
 * What the pictures cover. The frame is the matrices, everything right of
 * them, and the board to their left as far as puts the matrices' centre at
 * three-quarters of its width — the centre of its right half, which a narrow
 * page zooms onto; a wide page shows the rest beside its copy. The render is
 * the frame less {@link HIDDEN_COLUMNS}. The home page's stylesheet sizes it
 * by its width in columns, so a change here is a change there. The circuit's
 * whole height, either way, with more room above it than below: both pages
 * pin the picture to their top edge, and the social card crops it from there.
 */
function region(matrices: GridRect, content: GridRect): GridRect {
  const right = content.x + content.width + 3;
  const centre = matrices.x + matrices.width / 2;
  const width = 4 * (right - centre) - HIDDEN_COLUMNS;
  return {
    x: right - width,
    y: content.y - 6,
    width,
    height: content.height + 9
  };
}

/**
 * `count` consecutive frames of the running marquee, from {@link START_FRAME}
 * of its second lap: the first lap scrolls out of an empty RAM, so it is not
 * part of the loop. The clock's speed is read off the circuit, so retiming the
 * clock moves the sampling with it.
 */
async function marqueeFrames(ed: Editor, count: number): Promise<Buffer[]> {
  await ed.load(CIRCUIT);
  const [clock] = await ed.componentsOfType('clk');
  // Low for `speed` ticks, then high for as many, or for one as a pulse.
  const speed = Number(clock.options['speed']);
  const period = clock.options['mode'] === 'pulse' ? speed + 1 : 2 * speed;
  const frameTicks = PULSES_PER_FRAME * period;
  const matrices = await boundsOf(ed, await ed.componentsOfType(MATRIX));
  const area = region(matrices, await ed.contentBounds());
  const render = (area: GridRect, multiplier: number) =>
    ed.renderImage({ multiplier, region: area, margin: 0 });
  await ed.enterSimulation();

  await ed.stepSimulation(
    frameTicks * (LAP_FRAMES + START_FRAME) + SAMPLE_PHASE - HOLD_TICKS
  );
  // The rows above the pins, which light at the sampling tick by design.
  const display = { ...matrices, height: matrices.height - 2 };
  const finished = await render(display, 0.5);
  await ed.stepSimulation(HOLD_TICKS);
  if (!(await render(display, 0.5)).equals(finished)) {
    throw new Error(
      `the display is redrawing within ${HOLD_TICKS} ticks before the ` +
        `sample, ${SAMPLE_PHASE} ticks past a frame boundary — find ` +
        'SAMPLE_PHASE again for the edited circuit'
    );
  }

  const frames: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) await ed.stepSimulation(frameTicks);
    frames.push(await render(area, MULTIPLIER));
  }
  return frames;
}

/** The grid rectangle covering every given component. */
async function boundsOf(
  ed: Editor,
  components: readonly { id: number }[]
): Promise<GridRect> {
  const bounds = await ed.api(
    (ids) => __logigator.getBounds({ elementIds: ids }),
    components.map((component) => component.id)
  );
  if (!bounds) throw new Error('the components cover nothing');
  return bounds;
}

/**
 * The board behind the home page's headline, through the editor's own image
 * export. The page shows the loop, and the still only to a reader who asked
 * for reduced motion; the social card is composed from the still. Both cover
 * the same region, the still being the loop's first frame.
 */
export const SHOTS: Shot[] = [
  {
    name: 'hero-board',
    async run(ed) {
      return { frames: await marqueeFrames(ed, 1) };
    }
  },
  {
    name: 'hero-board-animated',
    async run(ed) {
      // One more frame than the loop holds: the lap has to return to its
      // first frame, or the constants above no longer describe the circuit
      // and the loop would jump on every repeat.
      const frames = await marqueeFrames(ed, LAP_FRAMES + 1);
      const next = frames.pop()!;
      if (!next.equals(frames[0])) {
        throw new Error(
          `the marquee is not back at its first frame after ${LAP_FRAMES} ` +
            '— update PULSES_PER_FRAME or LAP_FRAMES for the edited circuit'
        );
      }
      return { frames, delay: FRAME_DELAY, keyframes: KEYFRAME_INTERVAL };
    }
  }
];
