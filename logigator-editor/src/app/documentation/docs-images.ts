import introBannerEn from '@assets/docs/en/images/intro-banner.png';

/**
 * Documentation screenshots, keyed by the destination string authored in the
 * page markdown (paths under `images/`, relative to the page's folder). Each
 * import resolves to the build's cache-busted URL for that file — the `.png`
 * file loader, the same scheme the page markdown in `DOC_SECTIONS` uses — so
 * rendering swaps the authored destination for the hashed URL. Adding a
 * screenshot = drop the file under `src/assets/docs/<lang>/images/`, import
 * it, and register it here under the destination the markdown uses.
 */
export const DOC_IMAGES: Readonly<Record<string, string>> = {
  'images/intro-banner.png': introBannerEn
};
