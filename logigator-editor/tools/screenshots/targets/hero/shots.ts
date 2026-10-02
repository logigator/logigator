import type { Editor } from '../../lib/editor.ts';
import type { Shot } from '../../lib/target.ts';

/**
 * The scene, from `circuits/`: "LOGIGATOR" scrolling across three 16×16 LED
 * matrices, driven by a counter, a font ROM and a RAM holding the picture.
 */
const CIRCUIT = 'hero-marquee';

/** Output px per grid unit over the grid size — 16 px a cell. */
const MULTIPLIER = 1;
/** Cells of board kept around the circuit, so the page's crop has room. */
const MARGIN = 3;

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
 * Samples per displayed frame. One would show only finished pictures, with
 * every bus feeding the matrices in the same state each time; two also catch
 * a frame half-written.
 */
const SAMPLES_PER_FRAME = 2;
/** How long each sample is held: a column of scroll every 100 ms. */
const SAMPLE_DELAY = 100 / SAMPLES_PER_FRAME;

/**
 * A fixed pseudo-random offset in `[0, range)` for sample `n` of the loop,
 * and none for its first: the still is that sample, and the loop's closing
 * sample has to land exactly a lap after it. Fibonacci hashing reads the
 * product's high bits, which spread consecutive indices evenly; the low bits
 * would step through the range in a fixed stride. The same on every run, so
 * an unchanged circuit captures to the same bytes.
 */
function jitter(n: number, range: number): number {
  if (n === 0) return 0;
  const hash = Math.imul(n, 0x9e3779b1) >>> 0;
  return Math.floor((hash / 2 ** 32) * range);
}

/**
 * `count` consecutive samples of the running marquee, from {@link START_FRAME}
 * of its second lap: the first lap scrolls out of an empty RAM, so it is not
 * part of the loop. The clock's speed is read off the circuit, so retiming the
 * clock moves the sampling with it.
 *
 * Evenly spaced samples would catch the circuit in the same phase every time:
 * each counter bit faster than the spacing, the one-tick clock pulse and every
 * clock gated from it would read the same in every frame and look idle, and
 * the display would always be caught redrawing the same row. So each sample is
 * pushed later by an amount that differs from sample to sample and may reach
 * the whole gap to the next — less than the gap, so the samples stay in order
 * and the scroll averages one column a frame. Sample 0 is on the frame
 * boundary, where the display holds a finished frame.
 */
async function marqueeSamples(ed: Editor, count: number): Promise<Buffer[]> {
  await ed.load(CIRCUIT);
  const [clock] = await ed.componentsOfType('clk');
  const period = Number(clock.options['speed']) + 1;
  const frameTicks = PULSES_PER_FRAME * period;
  const gap = Math.floor(frameTicks / SAMPLES_PER_FRAME);
  const loop = LAP_FRAMES * SAMPLES_PER_FRAME;
  await ed.enterSimulation();

  const start = frameTicks * (LAP_FRAMES + START_FRAME);
  let tick = 0;
  const samples: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const target =
      start +
      Math.floor((i * frameTicks) / SAMPLES_PER_FRAME) +
      jitter(i % loop, gap);
    await ed.stepSimulation(target - tick);
    tick = target;
    samples.push(
      await ed.renderImage({ multiplier: MULTIPLIER, margin: MARGIN })
    );
  }
  return samples;
}

/**
 * The board behind the home page's headline: the whole circuit through the
 * editor's own image export, so the picture is the circuit at a fixed scale
 * rather than whatever a window frames of it.
 */
export const SHOTS: Shot[] = [
  {
    // The first frame of the animation, so the page can stand one in for the
    // other: under reduced motion, and wherever only a still is read.
    name: 'hero-board',
    async run(ed) {
      return { frames: await marqueeSamples(ed, 1) };
    }
  },
  {
    name: 'hero-board-animated',
    async run(ed) {
      const loop = LAP_FRAMES * SAMPLES_PER_FRAME;
      // One more sample than the loop holds: the lap has to come back to where
      // it started, or the constants above no longer describe the circuit and
      // the loop would jump on every repeat.
      const frames = await marqueeSamples(ed, loop + 1);
      const next = frames.pop()!;
      if (!next.equals(frames[0])) {
        throw new Error(
          `the marquee is not back at its first frame after ${loop} samples ` +
            '— update PULSES_PER_FRAME or LAP_FRAMES for the edited circuit'
        );
      }
      return { frames, delay: SAMPLE_DELAY };
    }
  }
];
