import type { DocPageId } from '@logigator/docs';

/**
 * A place in the documentation: a page, and on it the stable id of a heading
 * (the English heading's slug), or the page's top without one.
 */
export interface DocsTarget {
  readonly page: DocPageId;
  readonly anchor?: string;
}
