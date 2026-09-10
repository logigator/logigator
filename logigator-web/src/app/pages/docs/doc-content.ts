import { LanguageId } from '@logigator/core';
import { DocPageId } from '@logigator/docs';

/**
 * Every documentation page's markdown, one dynamic import per language.
 *
 * The text is not in the locale table, for the reason the legal documents are
 * not: that table is loaded for every page and travels in each document's
 * first byte, where eleven pages in four languages would dwarf the interface's
 * own strings. `.md` is a `text` loader here, so each import compiles into a
 * chunk of its own — the server render reads the one it draws off disk and the
 * browser downloads exactly that language's page, hashed and cached past the
 * visit.
 *
 * The imports are written out rather than assembled from a template literal:
 * the record then makes a page or a language with no file a compile error
 * instead of a route that 404s in it. The editor keeps a map of its own, and
 * has to — its loader emits a `.md` as a file, so what it holds is URLs.
 */
const CONTENT: Record<
  DocPageId,
  Record<LanguageId, () => Promise<{ default: string }>>
> = {
  'getting-started': {
    en: () => import('@logigator/docs/pages/en/getting-started.md'),
    de: () => import('@logigator/docs/pages/de/getting-started.md'),
    fr: () => import('@logigator/docs/pages/fr/getting-started.md'),
    es: () => import('@logigator/docs/pages/es/getting-started.md')
  },
  'board-and-tools': {
    en: () => import('@logigator/docs/pages/en/board-and-tools.md'),
    de: () => import('@logigator/docs/pages/de/board-and-tools.md'),
    fr: () => import('@logigator/docs/pages/fr/board-and-tools.md'),
    es: () => import('@logigator/docs/pages/es/board-and-tools.md')
  },
  shortcuts: {
    en: () => import('@logigator/docs/pages/en/shortcuts.md'),
    de: () => import('@logigator/docs/pages/de/shortcuts.md'),
    fr: () => import('@logigator/docs/pages/fr/shortcuts.md'),
    es: () => import('@logigator/docs/pages/es/shortcuts.md')
  },
  settings: {
    en: () => import('@logigator/docs/pages/en/settings.md'),
    de: () => import('@logigator/docs/pages/de/settings.md'),
    fr: () => import('@logigator/docs/pages/fr/settings.md'),
    es: () => import('@logigator/docs/pages/es/settings.md')
  },
  'components-and-options': {
    en: () => import('@logigator/docs/pages/en/components-and-options.md'),
    de: () => import('@logigator/docs/pages/de/components-and-options.md'),
    fr: () => import('@logigator/docs/pages/fr/components-and-options.md'),
    es: () => import('@logigator/docs/pages/es/components-and-options.md')
  },
  'wires-and-connections': {
    en: () => import('@logigator/docs/pages/en/wires-and-connections.md'),
    de: () => import('@logigator/docs/pages/de/wires-and-connections.md'),
    fr: () => import('@logigator/docs/pages/fr/wires-and-connections.md'),
    es: () => import('@logigator/docs/pages/es/wires-and-connections.md')
  },
  'custom-components': {
    en: () => import('@logigator/docs/pages/en/custom-components.md'),
    de: () => import('@logigator/docs/pages/de/custom-components.md'),
    fr: () => import('@logigator/docs/pages/fr/custom-components.md'),
    es: () => import('@logigator/docs/pages/es/custom-components.md')
  },
  simulation: {
    en: () => import('@logigator/docs/pages/en/simulation.md'),
    de: () => import('@logigator/docs/pages/de/simulation.md'),
    fr: () => import('@logigator/docs/pages/fr/simulation.md'),
    es: () => import('@logigator/docs/pages/es/simulation.md')
  },
  inspection: {
    en: () => import('@logigator/docs/pages/en/inspection.md'),
    de: () => import('@logigator/docs/pages/de/inspection.md'),
    fr: () => import('@logigator/docs/pages/fr/inspection.md'),
    es: () => import('@logigator/docs/pages/es/inspection.md')
  },
  'saving-and-files': {
    en: () => import('@logigator/docs/pages/en/saving-and-files.md'),
    de: () => import('@logigator/docs/pages/de/saving-and-files.md'),
    fr: () => import('@logigator/docs/pages/fr/saving-and-files.md'),
    es: () => import('@logigator/docs/pages/es/saving-and-files.md')
  },
  cloud: {
    en: () => import('@logigator/docs/pages/en/cloud.md'),
    de: () => import('@logigator/docs/pages/de/cloud.md'),
    fr: () => import('@logigator/docs/pages/fr/cloud.md'),
    es: () => import('@logigator/docs/pages/es/cloud.md')
  }
};

/** One documentation page's markdown, in one language. */
export async function loadDocPage(
  page: DocPageId,
  lang: LanguageId
): Promise<string> {
  return (await CONTENT[page][lang]()).default;
}
