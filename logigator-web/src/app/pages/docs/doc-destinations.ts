import { DocPageId, docImages, DOC_PAGE_IDS } from '@logigator/docs';
import type { LgMarkdownAsset } from '@logigator/ui';

/**
 * Every destination a documentation page authors, mapped to the URL it means
 * here: `./images/…` to the build's hashed picture, and `docs:<page>` to the
 * route that page is served at.
 *
 * The cross links are rewritten rather than intercepted so the rendered anchor
 * carries a real `href` — a crawler following it is the reason these pages
 * exist on the site at all. The click is still claimed, so following one is an
 * in-app navigation.
 *
 * `image` is how a picture's URL is written: the rendered page keeps the
 * build's own relative URL, which `<base href="/">` resolves; the raw markdown
 * twin has no base and roots it instead. A picture keeps its size, so the
 * rendered page reserves its box before the file arrives.
 */
export function docDestinations(
  lang: string,
  href: (page: DocPageId) => string,
  image: (url: string) => string = (url) => url
): Record<string, LgMarkdownAsset> {
  const destinations: Record<string, LgMarkdownAsset> = {};
  for (const [authored, picture] of Object.entries(docImages(lang))) {
    destinations[authored] = { ...picture, url: image(picture.url) };
  }
  for (const page of DOC_PAGE_IDS) {
    destinations[`docs:${page}`] = href(page);
  }
  return destinations;
}
