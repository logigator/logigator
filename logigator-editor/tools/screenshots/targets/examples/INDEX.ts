import { DESKTOP_VIEWPORT, THEMES } from '../../lib/config.ts';
import type { Shot, Target } from '../../lib/target.ts';
import { TARGET, exampleDocument, exampleSlugs, fileName } from './config.ts';

/**
 * One shot per seeded document: the document imported as it is stored, and
 * the preview the editor would have uploaded for it.
 */
const SHOTS: Shot[] = exampleSlugs().map((slug) => ({
  name: slug,
  async run(ed) {
    await ed.importProject(exampleDocument(slug));
    return { frames: [await ed.renderPreview()] };
  }
}));

/**
 * The previews of the seed account's examples, beside their documents under
 * `logigator-api/examples/`, so seeding a document never needs an editor to
 * open and save it. A preview carries no interface text, so English is the
 * only pass; the seed reads each pair by its fixed name, so there is no
 * registry to write.
 */
export default {
  locales: ['en'],
  themes: THEMES,
  viewport: DESKTOP_VIEWPORT,
  ...TARGET,
  shots: SHOTS,
  fileName
} satisfies Target;
