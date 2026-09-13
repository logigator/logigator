import { DESKTOP_VIEWPORT, LOCALES, THEMES } from '../../lib/config.mjs';
import { TARGET, fileName } from './config.mjs';
import { writeRegistry } from './registry.mjs';
import { SHOTS } from './shots.mjs';

/**
 * The website's tour figures, under `logigator-web/src/assets/tour/` — the
 * features page's rows, one capability each. Two schemes and four languages,
 * because the page shows a figure in the reader's own; English is the fallback,
 * per scheme.
 *
 * The editor beside the site is what is driven, which is what the target's base
 * names: the media is of the product, framed the way the page shows it.
 */
export default {
  locales: LOCALES,
  themes: THEMES,
  viewport: DESKTOP_VIEWPORT,
  ...TARGET,
  shots: SHOTS,
  fileName,
  writeRegistry
};
