import { socialHost } from './social-platforms';

/**
 * The one definition of a link a profile may carry.
 *
 * Shared because two sides have to agree about it and only one of them can be
 * trusted: the contract's `socialUrlSchema` normalizes a submitted URL with
 * this, so the clean form is both what the API stores and what the form redraws
 * from the response. It is `URL` and nothing else — the parser is the only thing
 * here that knows what a URL is.
 */

/**
 * Query parameters that exist to attribute a click and mean nothing about the
 * page. Matching is case-insensitive: campaigns are authored by hand and
 * `?UTM_SOURCE=` is the same parameter.
 *
 * **A curated list, never "drop the query".** `?tab=answers`, `?v=…`, a Gist's
 * `?file=`, a forum's `?p=2` are what the link is *about*; stripping them hands
 * out a different page. Every entry here is one a visit works without.
 */
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Platform click ids
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'yclid',
  'twclid',
  'ttclid',
  'igshid',
  'igsh',
  'li_fat_id',
  'epik',
  's_kwcid',
  'wickedid',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id',
  // Mail and campaign plumbing
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  '_ga',
  '_gl',
  'sc_cid',
  's_cid',
  'spm',
  'scm',
  // Referrers the platform adds when a link is shared
  'ref_src',
  'ref_url',
  'si'
]);

/** Whether a parameter is pure attribution. `utm_*` is a family, not a list. */
function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase();
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key);
}

/**
 * A submitted link in the form that is stored and shown, or `null` to reject
 * it.
 *
 * What is accepted is deliberately narrow — an absolute `http:`/`https:` URL
 * with no credentials in it — and what comes back is the parser's own
 * canonical form: the host lower-cased and punycoded, a default port dropped,
 * the path and case kept as typed, tracking parameters removed.
 *
 * A scheme is required. `github.com/me` is a string, not a URL, and it is the
 * one rejection a member is likely to run into by hand — which is why the
 * website's field shows `https://` in its placeholder.
 *
 * Not `z.string().url()`: that accepts `javascript:alert(1)` and
 * `data:text/html,<script>…</script>`. The protocol check below is the
 * allowlist, and there is no second one to keep in step with it.
 */
export function normalizeSocialUrl(raw: string): string | null {
  let url: URL;
  try {
    // Malformed, empty, and protocol-relative (`//host/x`) all throw here: a
    // URL with no scheme has nowhere to resolve against.
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  // `https://github.com@evil.example/x` parses with `github.com` for a user
  // name and `evil.example` for a host — and renders as whichever part a
  // consumer prints. No legitimate profile link carries credentials, so the
  // whole shape goes rather than being trimmed into something that only looks
  // like the link that was typed.
  if (url.username !== '' || url.password !== '') {
    return null;
  }

  // A host that names nothing: `https://www./` parses, and every check above
  // passes it. Stored, it is a link with no text to draw and no name to read —
  // `socialHost` answers `''` for it — so there is nothing here to point a
  // reader at.
  if (socialHost(url.href) === '') {
    return null;
  }

  stripTrackingParams(url);

  // `href` and not a reassembled string: the parser has already applied the
  // canonicalizations (host case, IDN punycode, default ports) that a second
  // implementation would get subtly wrong.
  return url.href;
}

/**
 * Removes the attribution parameters from a URL in place.
 *
 * The query is rebuilt from its own text rather than through `searchParams`,
 * whose serializer re-encodes every pair it keeps — `%20` becomes `+` and `~`
 * becomes `%7E`, which is a different query to a server that reads them
 * literally, and a page the member did not paste. A pair is still *named*
 * through `URLSearchParams`, so the matching decodes exactly as the parser
 * does. A link carrying no attribution is left byte for byte as it was.
 *
 * Emptying the query takes the `?` with it, so a stripped link and a link
 * typed without one serialize identically.
 */
function stripTrackingParams(url: URL): void {
  if (url.search === '') return;

  const pairs = url.search.slice(1).split('&');
  const kept = pairs.filter((pair) => {
    const [name] = new URLSearchParams(pair).keys();
    return name === undefined || !isTrackingParam(name);
  });
  if (kept.length === pairs.length) return;

  url.search = kept.length ? `?${kept.join('&')}` : '';
}
