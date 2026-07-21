import { TranslationKey } from '../translation/translation-key.model';
import gettingStartedEn from '@assets/docs/en/getting-started.md';
import boardAndToolsEn from '@assets/docs/en/board-and-tools.md';
import shortcutsEn from '@assets/docs/en/shortcuts.md';
import settingsEn from '@assets/docs/en/settings.md';
import componentsAndOptionsEn from '@assets/docs/en/components-and-options.md';
import wiresAndConnectionsEn from '@assets/docs/en/wires-and-connections.md';
import customComponentsEn from '@assets/docs/en/custom-components.md';
import simulationEn from '@assets/docs/en/simulation.md';
import inspectionEn from '@assets/docs/en/inspection.md';
import savingAndFilesEn from '@assets/docs/en/saving-and-files.md';
import cloudEn from '@assets/docs/en/cloud.md';

/**
 * One documentation page. `urls` maps a language to the build-time hashed URL
 * of that language's markdown (the `.md` file loader emits a cache-busted copy
 * per import), with English as the fallback for languages without an entry —
 * the same scheme the changelog uses. The page body is fetched only when the
 * page is shown; titles are regular translation keys so the navigation is
 * localized even while a body is English-only.
 */
export interface DocPage {
  id: string;
  titleKey: TranslationKey;
  urls: Readonly<Record<string, string>>;
}

/** A group of pages under one navigation header. */
export interface DocSection {
  id: string;
  titleKey: TranslationKey;
  pages: readonly DocPage[];
}

/**
 * The documentation tree, in display order. Adding a page = drop a markdown
 * file under `src/assets/docs/<lang>/`, import it, list it here, and add its
 * title key to the locale files; {@link DocPageId} picks the id up
 * automatically. In-page cross links use the id: `[label](docs:<page-id>)`.
 * Screenshots register in `docs-images.ts` under the path the markdown uses.
 */
export const DOC_SECTIONS = [
  {
    id: 'basics',
    titleKey: 'documentation.sections.basics',
    pages: [
      {
        id: 'getting-started',
        titleKey: 'documentation.pages.gettingStarted',
        urls: { en: gettingStartedEn }
      },
      {
        id: 'board-and-tools',
        titleKey: 'documentation.pages.boardAndTools',
        urls: { en: boardAndToolsEn }
      },
      {
        id: 'shortcuts',
        titleKey: 'documentation.pages.shortcuts',
        urls: { en: shortcutsEn }
      },
      {
        id: 'settings',
        titleKey: 'documentation.pages.settings',
        urls: { en: settingsEn }
      }
    ]
  },
  {
    id: 'building',
    titleKey: 'documentation.sections.building',
    pages: [
      {
        id: 'components-and-options',
        titleKey: 'documentation.pages.componentsAndOptions',
        urls: { en: componentsAndOptionsEn }
      },
      {
        id: 'wires-and-connections',
        titleKey: 'documentation.pages.wiresAndConnections',
        urls: { en: wiresAndConnectionsEn }
      },
      {
        id: 'custom-components',
        titleKey: 'documentation.pages.customComponents',
        urls: { en: customComponentsEn }
      }
    ]
  },
  {
    id: 'simulation',
    titleKey: 'documentation.sections.simulation',
    pages: [
      {
        id: 'simulation',
        titleKey: 'documentation.pages.simulation',
        urls: { en: simulationEn }
      },
      {
        id: 'inspection',
        titleKey: 'documentation.pages.inspection',
        urls: { en: inspectionEn }
      }
    ]
  },
  {
    id: 'projects',
    titleKey: 'documentation.sections.projects',
    pages: [
      {
        id: 'saving-and-files',
        titleKey: 'documentation.pages.savingAndFiles',
        urls: { en: savingAndFilesEn }
      },
      {
        id: 'cloud',
        titleKey: 'documentation.pages.cloud',
        urls: { en: cloudEn }
      }
    ]
  }
] as const satisfies readonly DocSection[];

/** Ids of all documentation pages — `open()` targets are compile-checked. */
export type DocPageId = (typeof DOC_SECTIONS)[number]['pages'][number]['id'];

export const DEFAULT_DOC_PAGE: DocPageId = 'getting-started';

const PAGES_BY_ID: ReadonlyMap<DocPageId, DocPage> = new Map(
  DOC_SECTIONS.flatMap((section) =>
    section.pages.map((page): [DocPageId, DocPage] => [page.id, page])
  )
);

export function docPage(id: DocPageId): DocPage {
  // The map holds every member of the DocPageId union by construction.
  return PAGES_BY_ID.get(id)!;
}

/** Whether an arbitrary string (e.g. from a markdown link) is a page id. */
export function isDocPageId(id: string): id is DocPageId {
  return PAGES_BY_ID.has(id as DocPageId);
}
