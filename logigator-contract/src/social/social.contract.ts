import * as z from 'zod';
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from '@logigator/core';

/**
 * A profile's links, in the two shapes they take: what a member submits and
 * what a reader is shown.
 *
 * The difference is the whole point. A request carries **URLs only** — a client
 * is never asked for a platform, because a classification it produced would be
 * one the server could not verify and would have to store. A response carries
 * `{ url, platform }`, and the platform is derived on the server from the host,
 * on every read. So growing the table in `@logigator/core` reclassifies every
 * profile that exists without a migration, which a stored classification could
 * not do.
 */

/**
 * The most links a profile may carry. Three, so the row stays a row: the links
 * sit under the name beside the website, and a list long enough to wrap is one
 * nobody reads.
 */
export const MAX_SOCIAL_LINKS = 3;

/**
 * The platform a link was recognised as. The enum is built from the table
 * rather than written out, so a platform added to `@logigator/core` is one the
 * API may answer with and a client accepts — and the website's icon map, which
 * is total over the table, fails its type-check until it has a glyph for it.
 */
export const socialPlatformSchema = z.enum(
  SOCIAL_PLATFORMS.map((platform) => platform.id)
);

/**
 * The longest a link may be, as typed and as stored. Both are measured: the
 * parser percent-encodes and punycodes, so a URL that fits when it is pasted
 * can be several times longer once normalized, and the column it is written to
 * is `varchar(2048)`.
 */
const MAX_SOCIAL_URL_LENGTH = 2048;

/**
 * A link a profile may carry, **normalized on the way in**: the value this
 * schema produces is the clean form, and the form a member submits is the
 * request schema's `safeParse` output — so the URL the API stores is the URL
 * the form redraws, with the tracking parameters the normalizer removed gone
 * from the field too.
 *
 * One producing check rather than a `refine` beside an `overwrite`: the
 * normalizer then runs once per parse, and the length the result is held to is
 * the length of the result.
 *
 * `max` first, so an oversized paste is refused as too long rather than as a
 * bad URL. Deliberately not `z.string().url()`, which accepts `javascript:` and
 * `data:` URLs; the normalizer's protocol check is the allowlist, and
 * `@logigator/core`'s spec holds every case that matters.
 */
export const socialUrlSchema = z
  .string()
  .max(MAX_SOCIAL_URL_LENGTH)
  .transform((raw, ctx) => {
    const url = normalizeSocialUrl(raw);
    if (url === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'must be an absolute http or https URL'
      });
      return z.NEVER;
    }
    if (url.length > MAX_SOCIAL_URL_LENGTH) {
      // The paste fit; its canonical form does not. Refused here rather than by
      // the column, which answers a 500.
      ctx.addIssue({
        code: 'too_big',
        origin: 'string',
        maximum: MAX_SOCIAL_URL_LENGTH,
        inclusive: true,
        message: `must be at most ${MAX_SOCIAL_URL_LENGTH} characters`
      });
      return z.NEVER;
    }
    return url;
  });

export type SocialUrl = z.infer<typeof socialUrlSchema>;

/**
 * One link as a read answers it: the stored URL and the platform its host
 * classified as, `'other'` for a host the table does not know.
 */
export const socialLinkSchema = z
  .object({
    url: z.string(),
    platform: socialPlatformSchema
  })
  .loose();

export type SocialLink = z.infer<typeof socialLinkSchema>;
