/**
 * A picture's URL with its size in pixels, which lets the renderer give it its
 * box before the file arrives.
 */
export interface LgMarkdownImage {
  url: string;
  width: number;
  height: number;
}

/** What an authored destination maps to: a URL, or a picture with its size. */
export type LgMarkdownAsset = string | LgMarkdownImage;

export function assetUrl(asset: LgMarkdownAsset): string {
  return typeof asset === 'string' ? asset : asset.url;
}

/**
 * Rewrites markdown link/image destinations to their mapped URLs. Only the
 * destination matches, verbatim up to an optional `#fragment`, which is kept
 * on the mapped URL; an optional title is carried over and unmapped
 * destinations stay untouched.
 *
 * Its own file, away from the renderer, because a consumer serving the raw
 * markdown beside the rendered page applies the same rule outside Angular —
 * `logigator-web`'s docs twins do, from its SSR host.
 */
export function resolveMarkdownUrls(
  data: string | undefined,
  urls: Readonly<Record<string, LgMarkdownAsset>> | undefined
): string | undefined {
  if (data === undefined || urls === undefined) {
    return data;
  }
  return data.replace(
    /\]\(([^)\s]+)([^)]*)\)/g,
    (match, destination: string, title: string) => {
      const hash = destination.indexOf('#');
      const base = hash < 0 ? destination : destination.slice(0, hash);
      return base && Object.hasOwn(urls, base)
        ? `](${assetUrl(urls[base])}${destination.slice(base.length)}${title})`
        : match;
    }
  );
}
