import { DocPageId, DocSectionId } from '@logigator/docs';
import { TranslationKey } from '../../translation/translation-key.model';

/**
 * A page's title, as this app's own translation key. The shared member holds
 * ids alone — the editor's viewer names the same pages through keys of its own
 * — and the record is total, so a page added there is a compile error here
 * until it is named.
 *
 * The title is a key rather than the markdown's own `# …`: both viewers build
 * their navigation before any body is loaded, and a label may not depend on
 * having the document it labels.
 */
export const DOC_PAGE_TITLES: Record<DocPageId, TranslationKey> = {
  'getting-started': 'pages.docs.pages.gettingStarted',
  'board-and-tools': 'pages.docs.pages.boardAndTools',
  shortcuts: 'pages.docs.pages.shortcuts',
  settings: 'pages.docs.pages.settings',
  'components-and-options': 'pages.docs.pages.componentsAndOptions',
  'wires-and-connections': 'pages.docs.pages.wiresAndConnections',
  'custom-components': 'pages.docs.pages.customComponents',
  simulation: 'pages.docs.pages.simulation',
  inspection: 'pages.docs.pages.inspection',
  'saving-and-files': 'pages.docs.pages.savingAndFiles',
  cloud: 'pages.docs.pages.cloud'
};

/** A navigation group's title, the same way. */
export const DOC_SECTION_TITLES: Record<DocSectionId, TranslationKey> = {
  basics: 'pages.docs.sections.basics',
  building: 'pages.docs.sections.building',
  simulation: 'pages.docs.sections.simulation',
  projects: 'pages.docs.sections.projects'
};
