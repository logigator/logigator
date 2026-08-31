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
import gettingStartedDe from '@assets/docs/de/getting-started.md';
import boardAndToolsDe from '@assets/docs/de/board-and-tools.md';
import shortcutsDe from '@assets/docs/de/shortcuts.md';
import settingsDe from '@assets/docs/de/settings.md';
import componentsAndOptionsDe from '@assets/docs/de/components-and-options.md';
import wiresAndConnectionsDe from '@assets/docs/de/wires-and-connections.md';
import customComponentsDe from '@assets/docs/de/custom-components.md';
import simulationDe from '@assets/docs/de/simulation.md';
import inspectionDe from '@assets/docs/de/inspection.md';
import savingAndFilesDe from '@assets/docs/de/saving-and-files.md';
import cloudDe from '@assets/docs/de/cloud.md';
import gettingStartedFr from '@assets/docs/fr/getting-started.md';
import boardAndToolsFr from '@assets/docs/fr/board-and-tools.md';
import shortcutsFr from '@assets/docs/fr/shortcuts.md';
import settingsFr from '@assets/docs/fr/settings.md';
import componentsAndOptionsFr from '@assets/docs/fr/components-and-options.md';
import wiresAndConnectionsFr from '@assets/docs/fr/wires-and-connections.md';
import customComponentsFr from '@assets/docs/fr/custom-components.md';
import simulationFr from '@assets/docs/fr/simulation.md';
import inspectionFr from '@assets/docs/fr/inspection.md';
import savingAndFilesFr from '@assets/docs/fr/saving-and-files.md';
import cloudFr from '@assets/docs/fr/cloud.md';
import gettingStartedEs from '@assets/docs/es/getting-started.md';
import boardAndToolsEs from '@assets/docs/es/board-and-tools.md';
import shortcutsEs from '@assets/docs/es/shortcuts.md';
import settingsEs from '@assets/docs/es/settings.md';
import componentsAndOptionsEs from '@assets/docs/es/components-and-options.md';
import wiresAndConnectionsEs from '@assets/docs/es/wires-and-connections.md';
import customComponentsEs from '@assets/docs/es/custom-components.md';
import simulationEs from '@assets/docs/es/simulation.md';
import inspectionEs from '@assets/docs/es/inspection.md';
import savingAndFilesEs from '@assets/docs/es/saving-and-files.md';
import cloudEs from '@assets/docs/es/cloud.md';

/**
 * One documentation page. `urls` maps a language to the build-time hashed URL
 * of that language's markdown, English being the fallback. Bodies are fetched
 * only when shown; titles are translation keys, so the navigation is localized
 * even while a body is English-only.
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
 * The documentation tree, in display order. To add a page: drop a markdown file
 * under `src/assets/docs/<lang>/`, import it, list it here and add its title
 * key to the locale files — {@link DocPageId} picks the id up. In-page cross
 * links use that id, `[label](docs:<page-id>)`.
 */
export const DOC_SECTIONS = [
  {
    id: 'basics',
    titleKey: 'documentation.sections.basics',
    pages: [
      {
        id: 'getting-started',
        titleKey: 'documentation.pages.gettingStarted',
        urls: {
          en: gettingStartedEn,
          de: gettingStartedDe,
          fr: gettingStartedFr,
          es: gettingStartedEs
        }
      },
      {
        id: 'board-and-tools',
        titleKey: 'documentation.pages.boardAndTools',
        urls: {
          en: boardAndToolsEn,
          de: boardAndToolsDe,
          fr: boardAndToolsFr,
          es: boardAndToolsEs
        }
      },
      {
        id: 'shortcuts',
        titleKey: 'documentation.pages.shortcuts',
        urls: {
          en: shortcutsEn,
          de: shortcutsDe,
          fr: shortcutsFr,
          es: shortcutsEs
        }
      },
      {
        id: 'settings',
        titleKey: 'documentation.pages.settings',
        urls: {
          en: settingsEn,
          de: settingsDe,
          fr: settingsFr,
          es: settingsEs
        }
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
        urls: {
          en: componentsAndOptionsEn,
          de: componentsAndOptionsDe,
          fr: componentsAndOptionsFr,
          es: componentsAndOptionsEs
        }
      },
      {
        id: 'wires-and-connections',
        titleKey: 'documentation.pages.wiresAndConnections',
        urls: {
          en: wiresAndConnectionsEn,
          de: wiresAndConnectionsDe,
          fr: wiresAndConnectionsFr,
          es: wiresAndConnectionsEs
        }
      },
      {
        id: 'custom-components',
        titleKey: 'documentation.pages.customComponents',
        urls: {
          en: customComponentsEn,
          de: customComponentsDe,
          fr: customComponentsFr,
          es: customComponentsEs
        }
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
        urls: {
          en: simulationEn,
          de: simulationDe,
          fr: simulationFr,
          es: simulationEs
        }
      },
      {
        id: 'inspection',
        titleKey: 'documentation.pages.inspection',
        urls: {
          en: inspectionEn,
          de: inspectionDe,
          fr: inspectionFr,
          es: inspectionEs
        }
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
        urls: {
          en: savingAndFilesEn,
          de: savingAndFilesDe,
          fr: savingAndFilesFr,
          es: savingAndFilesEs
        }
      },
      {
        id: 'cloud',
        titleKey: 'documentation.pages.cloud',
        urls: {
          en: cloudEn,
          de: cloudDe,
          fr: cloudFr,
          es: cloudEs
        }
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
