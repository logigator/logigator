import { LgImageSource } from '../tokens/image-source';

/** One `<source>`: every width offered in a single encoding. */
export interface LgPictureGroup {
  /** `undefined` when the source named no format; nothing to negotiate. */
  type: string | undefined;
  srcset: string;
}

/** The alternative encodings, plus the `<img>` the browser falls back to. */
export interface LgPicture {
  groups: LgPictureGroup[];
  src: string;
  /** `null` for a single URL, where there is nothing to choose between. */
  srcset: string | null;
}

/**
 * `undefined` when there is nothing to draw. The last encoding goes on the
 * `<img>`: a browser matching no source falls back to it, so the caller's
 * least-preferred encoding is the one that has to work everywhere.
 */
export function pictureFor(
  image: string | readonly LgImageSource[] | null | undefined
): LgPicture | undefined {
  if (!image) return undefined;
  if (typeof image === 'string')
    return { groups: [], src: image, srcset: null };

  const groups = groupByFormat(image);
  const fallback = groups.pop();
  if (!fallback) return undefined;

  return {
    groups,
    // `src` only matters to a client that cannot read a `srcset`; the narrowest
    // rung is the cheapest thing to give it.
    src: fallback.sources[0].url,
    srcset: fallback.srcset
  };
}

/** One entry per encoding, in the order the encodings first appear. */
function groupByFormat(
  sources: readonly LgImageSource[]
): (LgPictureGroup & { sources: LgImageSource[] })[] {
  const byFormat = new Map<string | undefined, LgImageSource[]>();
  for (const source of sources) {
    const existing = byFormat.get(source.format);
    if (existing) existing.push(source);
    else byFormat.set(source.format, [source]);
  }

  return Array.from(byFormat, ([format, entries]) => ({
    type: mediaType(format),
    srcset: entries.map((s) => `${s.url} ${s.width}w`).join(', '),
    sources: entries
  }));
}

// `'jpg'` is a file extension, not a format name; there is no `image/jpg`.
function mediaType(format: string | undefined): string | undefined {
  if (!format) return undefined;
  return `image/${format === 'jpg' ? 'jpeg' : format}`;
}
