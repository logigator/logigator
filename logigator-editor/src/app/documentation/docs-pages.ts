import { DocPageId, DocSectionId } from '@logigator/docs';
import { LanguageId } from '@logigator/core';
import { TranslationKey } from '../translation/translation-key.model';
import gettingStartedEn from '@logigator/docs/pages/en/getting-started.md';
import boardAndToolsEn from '@logigator/docs/pages/en/board-and-tools.md';
import shortcutsEn from '@logigator/docs/pages/en/shortcuts.md';
import settingsEn from '@logigator/docs/pages/en/settings.md';
import componentsAndOptionsEn from '@logigator/docs/pages/en/components-and-options.md';
import wiresAndConnectionsEn from '@logigator/docs/pages/en/wires-and-connections.md';
import customComponentsEn from '@logigator/docs/pages/en/custom-components.md';
import simulationEn from '@logigator/docs/pages/en/simulation.md';
import inspectionEn from '@logigator/docs/pages/en/inspection.md';
import savingAndFilesEn from '@logigator/docs/pages/en/saving-and-files.md';
import cloudEn from '@logigator/docs/pages/en/cloud.md';
import gettingStartedDe from '@logigator/docs/pages/de/getting-started.md';
import boardAndToolsDe from '@logigator/docs/pages/de/board-and-tools.md';
import shortcutsDe from '@logigator/docs/pages/de/shortcuts.md';
import settingsDe from '@logigator/docs/pages/de/settings.md';
import componentsAndOptionsDe from '@logigator/docs/pages/de/components-and-options.md';
import wiresAndConnectionsDe from '@logigator/docs/pages/de/wires-and-connections.md';
import customComponentsDe from '@logigator/docs/pages/de/custom-components.md';
import simulationDe from '@logigator/docs/pages/de/simulation.md';
import inspectionDe from '@logigator/docs/pages/de/inspection.md';
import savingAndFilesDe from '@logigator/docs/pages/de/saving-and-files.md';
import cloudDe from '@logigator/docs/pages/de/cloud.md';
import gettingStartedFr from '@logigator/docs/pages/fr/getting-started.md';
import boardAndToolsFr from '@logigator/docs/pages/fr/board-and-tools.md';
import shortcutsFr from '@logigator/docs/pages/fr/shortcuts.md';
import settingsFr from '@logigator/docs/pages/fr/settings.md';
import componentsAndOptionsFr from '@logigator/docs/pages/fr/components-and-options.md';
import wiresAndConnectionsFr from '@logigator/docs/pages/fr/wires-and-connections.md';
import customComponentsFr from '@logigator/docs/pages/fr/custom-components.md';
import simulationFr from '@logigator/docs/pages/fr/simulation.md';
import inspectionFr from '@logigator/docs/pages/fr/inspection.md';
import savingAndFilesFr from '@logigator/docs/pages/fr/saving-and-files.md';
import cloudFr from '@logigator/docs/pages/fr/cloud.md';
import gettingStartedEs from '@logigator/docs/pages/es/getting-started.md';
import boardAndToolsEs from '@logigator/docs/pages/es/board-and-tools.md';
import shortcutsEs from '@logigator/docs/pages/es/shortcuts.md';
import settingsEs from '@logigator/docs/pages/es/settings.md';
import componentsAndOptionsEs from '@logigator/docs/pages/es/components-and-options.md';
import wiresAndConnectionsEs from '@logigator/docs/pages/es/wires-and-connections.md';
import customComponentsEs from '@logigator/docs/pages/es/custom-components.md';
import simulationEs from '@logigator/docs/pages/es/simulation.md';
import inspectionEs from '@logigator/docs/pages/es/inspection.md';
import savingAndFilesEs from '@logigator/docs/pages/es/saving-and-files.md';
import cloudEs from '@logigator/docs/pages/es/cloud.md';

/**
 * Each page's markdown, one build-time hashed URL per language. The bodies are
 * fetched only when a page is shown; the editor's loader emits a `.md` as a
 * file, which is what keeps 44 documents out of the bundle.
 *
 * The imports are written out rather than assembled from a template literal:
 * the record then makes a page or a language with no file a compile error
 * instead of a viewer that 404s in it.
 */
const DOC_PAGE_URLS: Record<DocPageId, Record<LanguageId, string>> = {
  'getting-started': {
    en: gettingStartedEn,
    de: gettingStartedDe,
    fr: gettingStartedFr,
    es: gettingStartedEs
  },
  'board-and-tools': {
    en: boardAndToolsEn,
    de: boardAndToolsDe,
    fr: boardAndToolsFr,
    es: boardAndToolsEs
  },
  shortcuts: {
    en: shortcutsEn,
    de: shortcutsDe,
    fr: shortcutsFr,
    es: shortcutsEs
  },
  settings: {
    en: settingsEn,
    de: settingsDe,
    fr: settingsFr,
    es: settingsEs
  },
  'components-and-options': {
    en: componentsAndOptionsEn,
    de: componentsAndOptionsDe,
    fr: componentsAndOptionsFr,
    es: componentsAndOptionsEs
  },
  'wires-and-connections': {
    en: wiresAndConnectionsEn,
    de: wiresAndConnectionsDe,
    fr: wiresAndConnectionsFr,
    es: wiresAndConnectionsEs
  },
  'custom-components': {
    en: customComponentsEn,
    de: customComponentsDe,
    fr: customComponentsFr,
    es: customComponentsEs
  },
  simulation: {
    en: simulationEn,
    de: simulationDe,
    fr: simulationFr,
    es: simulationEs
  },
  inspection: {
    en: inspectionEn,
    de: inspectionDe,
    fr: inspectionFr,
    es: inspectionEs
  },
  'saving-and-files': {
    en: savingAndFilesEn,
    de: savingAndFilesDe,
    fr: savingAndFilesFr,
    es: savingAndFilesEs
  },
  cloud: {
    en: cloudEn,
    de: cloudDe,
    fr: cloudFr,
    es: cloudEs
  }
};

/**
 * A page's title, as this app's own translation key. The shared member holds
 * ids alone — the website names the same pages through keys of its own — and
 * the record is total, so a page added there is a compile error here until it
 * is named.
 */
export const DOC_PAGE_TITLES: Record<DocPageId, TranslationKey> = {
  'getting-started': 'documentation.pages.gettingStarted',
  'board-and-tools': 'documentation.pages.boardAndTools',
  shortcuts: 'documentation.pages.shortcuts',
  settings: 'documentation.pages.settings',
  'components-and-options': 'documentation.pages.componentsAndOptions',
  'wires-and-connections': 'documentation.pages.wiresAndConnections',
  'custom-components': 'documentation.pages.customComponents',
  simulation: 'documentation.pages.simulation',
  inspection: 'documentation.pages.inspection',
  'saving-and-files': 'documentation.pages.savingAndFiles',
  cloud: 'documentation.pages.cloud'
};

/** A navigation group's title, the same way. */
export const DOC_SECTION_TITLES: Record<DocSectionId, TranslationKey> = {
  basics: 'documentation.sections.basics',
  building: 'documentation.sections.building',
  simulation: 'documentation.sections.simulation',
  projects: 'documentation.sections.projects'
};

/** Markdown URL of a page in `lang`, English where it has no translation. */
export function docPageUrl(page: DocPageId, lang: string): string {
  const urls = DOC_PAGE_URLS[page];
  return urls[lang as LanguageId] ?? urls.en;
}
