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
 * file does not state: each of the 16 display rows takes 8 pulses — read,
 * shift and write back both half-rows.
 */
const PULSES_PER_FRAME = 16 * 8;
/** Frames in a lap: the text is a 128-column strip scrolled a column a frame. */
const LAP_FRAMES = 128;
/** Where the loop starts within a lap, which is what the still shows. */
const START_FRAME = 46;
/**
 * Ticks past a frame boundary each frame is sampled at: the matrices' clock
 * fires for the next frame's first half-row, so the lines into them are lit,
 * while the display still holds the finished frame — it latches a few ticks
 * later. Found by stepping across the boundary a tick at a time; the shots
 * check the display against the boundary's, so a retimed circuit fails rather
 * than tearing.
 */
const SAMPLE_PHASE = 33;
/**
 * How long each frame is held — one column of scroll. A frame is one sample,
 * at the same point of the circuit's cycle every time, so only what changes
 * once a column moves changes on screen: a circuit at work, not flicker.
 */
const FRAME_DELAY = 125;

/** Output px per grid unit over the grid size — 20 px a cell. */
const MULTIPLIER = 1.25;

/**
 * What the pictures cover: the matrices, everything right of them, and the
 * board to their left as far as puts the matrices' centre at three-quarters
 * of the width — the centre of the right half, which a narrow page doubles
 * about the top-right corner to show. A wide page shows the rest beside its
 * copy, which covers what lies further left, so that is not rendered. The
 * circuit's whole height, either way.
 */
function region(matrices: GridRect, content: GridRect): GridRect {
  const right = content.x + content.width + 3;
  const centre = matrices.x + matrices.width / 2;
  const width = 4 * (right - centre);
  return {
    x: right - width,
    y: content.y - 3,
    width,
    height: content.height + 6
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
  const period = Number(clock.options['speed']) + 1;
  const frameTicks = PULSES_PER_FRAME * period;
  const matrices = await boundsOf(ed, await ed.componentsOfType(MATRIX));
  const area = region(matrices, await ed.contentBounds());
  const render = (area: GridRect, multiplier: number) =>
    ed.renderImage({ multiplier, region: area, margin: 0 });
  await ed.enterSimulation();

  await ed.stepSimulation(frameTicks * (LAP_FRAMES + START_FRAME));
  // The rows above the pins, which light at the sampling tick by design.
  const display = { ...matrices, height: matrices.height - 2 };
  const finished = await render(display, 0.5);
  await ed.stepSimulation(SAMPLE_PHASE);
  if (!(await render(display, 0.5)).equals(finished)) {
    throw new Error(
      `the display is redrawing ${SAMPLE_PHASE} ticks past a frame boundary ` +
        '— find SAMPLE_PHASE again for the edited circuit'
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
 * export. The still is the loop's first frame, for reduced motion and for
 * crawlers.
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
      return { frames, delay: FRAME_DELAY };
    }
  }
];
