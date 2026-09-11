import { join } from 'node:path';

/**
 * The share card is the only thing this server draws type into, and it draws it
 * through the fontconfig compiled into sharp's own libvips — never the host's,
 * which is why no image needs a font package. What that fontconfig finds is
 * still whatever the machine happens to carry, and a substituted face is
 * silent: the card ships in the wrong type with no error anywhere.
 *
 * So the faces travel with the source. `fonts/` holds the four TTFs the plates
 * name and a `fonts.conf` pointing at its own directory, and the build copies
 * both beside the bundle, so `import.meta.dirname` resolves to them from the
 * source tree and from `dist/` alike.
 *
 * TTF and not the `@fontsource-variable` packages the editor and the site use:
 * fontconfig scans no woff2, and librsvg ignores an `@font-face` whose `src` is
 * a data URI — both verified against this libvips, and both fail by silently
 * rendering the fallback face rather than by complaining.
 *
 * Assigned at module scope rather than before the first card: fontconfig reads
 * the variable once, when libvips first initialises it, and the decode of an
 * uploaded avatar may well be what does that first.
 */
process.env['FONTCONFIG_FILE'] ??= join(
  import.meta.dirname,
  'fonts',
  'fonts.conf'
);

/** The two families `fonts/` carries, in fontconfig's spelling. */
export const CARD_SANS = 'Roboto';
export const CARD_MONO = 'Roboto Mono';

/**
 * Roboto Mono's advance, in ems. Every glyph has it — which is what lets the
 * stat strip lay itself out, SVG having no flexbox and no way to ask how wide a
 * string came out. Nothing set in the proportional face is measured; those
 * boxes are clipped instead.
 */
const MONO_ADVANCE = 0.6;

/** How wide `text` sets in the mono face at `size`. */
export function monoWidth(text: string, size: number): number {
  return text.length * size * MONO_ADVANCE;
}
