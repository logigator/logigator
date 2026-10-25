import { DESKTOP_VIEWPORT, THEMES } from '../../lib/config.ts';
import type { Target } from '../../lib/target.ts';
import { TARGET, fileName } from './config.ts';
import { SHOTS } from './shots.ts';

/**
 * The website home page's hero board, under `logigator-web/src/assets/`: a
 * still and its animation, in both schemes. The board carries no interface
 * text, so English is the only pass; and the site imports the files by their
 * fixed names, so there is no registry to write.
 */
export default {
  locales: ['en'],
  themes: THEMES,
  viewport: DESKTOP_VIEWPORT,
  ...TARGET,
  shots: SHOTS,
  fileName
} satisfies Target;
