/**
 * Rewrites markdown link/image destinations to their mapped URLs. Only the
 * destination matches, verbatim; an optional title is carried over and
 * unmapped destinations stay untouched.
 *
 * Its own file, away from the renderer, because a consumer serving the raw
 * markdown beside the rendered page applies the same rule outside Angular —
 * `logigator-web`'s docs twins do, from its SSR host.
 */
export function resolveMarkdownUrls(
  data: string | undefined,
  urls: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (data === undefined || urls === undefined) {
    return data;
  }
  return data.replace(
    /\]\(([^)\s]+)([^)]*)\)/g,
    (match, destination: string, title: string) =>
      Object.hasOwn(urls, destination)
        ? `](${urls[destination]}${title})`
        : match
  );
}
