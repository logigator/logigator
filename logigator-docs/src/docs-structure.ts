/**
 * The documentation tree, in display order: which pages exist and how they are
 * grouped. Ids only — a title is a translation key, and each app has its own
 * typed key union, so the two viewers map an id to their own key rather than
 * sharing one the other's locale files do not have.
 *
 * To add a page: drop `<id>.md` under `pages/<lang>/`, list its id here, and
 * add the import and the title key in both apps — {@link DocPageId} makes each
 * of those a compile error until it is done. In-page cross links use the id,
 * `[label](docs:<page-id>)`.
 */
export interface DocSection {
  id: string;
  pages: readonly string[];
}

export const DOC_SECTIONS = [
  {
    id: 'basics',
    pages: ['getting-started', 'board-and-tools', 'shortcuts', 'settings']
  },
  {
    id: 'building',
    pages: [
      'components-and-options',
      'wires-and-connections',
      'custom-components'
    ]
  },
  {
    id: 'simulation',
    pages: ['simulation', 'inspection']
  },
  {
    id: 'projects',
    pages: ['saving-and-files', 'cloud']
  }
] as const satisfies readonly DocSection[];

/** Ids of all navigation groups. */
export type DocSectionId = (typeof DOC_SECTIONS)[number]['id'];

/** Ids of all documentation pages — a viewer's targets are compile-checked. */
export type DocPageId = (typeof DOC_SECTIONS)[number]['pages'][number];

/** Every page id, in the order the tree shows them. */
export const DOC_PAGE_IDS: readonly DocPageId[] = DOC_SECTIONS.flatMap(
  (section) => section.pages
);

export const DEFAULT_DOC_PAGE: DocPageId = 'getting-started';

const PAGE_IDS: ReadonlySet<string> = new Set(DOC_PAGE_IDS);

/** Whether an arbitrary string (e.g. from a markdown link) is a page id. */
export function isDocPageId(id: string): id is DocPageId {
  return PAGE_IDS.has(id);
}
