import { DocPageId } from '@logigator/docs';

/** What a documentation route tells the guard and the page which page it is. */
export interface DocsRouteData {
  docPage: DocPageId;
}
