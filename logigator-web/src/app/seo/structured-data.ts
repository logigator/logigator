import { LanguageId } from '@logigator/core';
import { TranslationService } from '../translation/translation.service';

/**
 * The page's JSON-LD graph: what a search engine and an LLM crawler read
 * instead of inferring the page's meaning from its markup.
 *
 * One `<script>` holding a `@graph` rather than a script per node, so the nodes
 * can reference one another by `@id` — the site and the editor are named once
 * per page and everything else points at them, which is what makes the set read
 * as one description rather than several unrelated ones.
 *
 * The types here are deliberately narrow: only the properties the site emits,
 * rather than a model of schema.org. A generated vocabulary would be far more
 * surface than four node kinds, and the constraint worth enforcing is not "is
 * this a real schema.org property" but "did this page fill in the ones that
 * make its node useful".
 */

/** A reference to another node in the same graph. */
export interface JsonLdRef {
  '@id': string;
}

/** The shape every node shares; the graph is a heterogeneous list of them. */
export interface JsonLdNode {
  readonly '@type': string | readonly string[];
}

/** The site itself, named once so pages can say they are part of it. */
export interface WebSiteNode extends JsonLdNode {
  '@type': 'WebSite';
  '@id': string;
  name: string;
  url: string;
  description: string;
  inLanguage: LanguageId;
  publisher?: JsonLdRef;
}

/**
 * Who publishes the site. No `logo`: the wordmark is a two-tone SVG on a
 * transparent ground and the social card is 1200×630, and Google's logo result
 * wants neither — a raster of at least 112px on a solid ground. The node still
 * earns its place without one, `sameAs` being what ties the site to the project
 * it is the front of.
 */
export interface OrganizationNode extends JsonLdNode {
  '@type': 'Organization';
  '@id': string;
  name: string;
  url: string;
  sameAs: string[];
}

/**
 * The editor, which is the product the site advertises — so its `url` is the
 * editor's own, not the page naming it.
 *
 * Both types: `WebApplication` is the accurate one and `SoftwareApplication`
 * is the one consumers look for, and a node may hold several.
 */
export interface SoftwareApplicationNode extends JsonLdNode {
  '@type': readonly ['SoftwareApplication', 'WebApplication'];
  '@id': string;
  name: string;
  url: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  inLanguage: LanguageId;
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  /**
   * A render of a circuit rather than a capture of the application, so `image`
   * and not `screenshot` — the distinction a crawler acts on is whether the
   * picture shows the software's interface.
   */
  image?: string;
  isPartOf?: JsonLdRef;
}

/**
 * A video the page embeds. `uploadDate` is optional because it is data the site
 * does not hold: Google's video result wants it, and it has to be read off
 * YouTube the way the durations were rather than guessed. A property with
 * nothing behind it is left out rather than emitted empty, which is also why
 * `duration` can be absent.
 */
export interface VideoObjectNode extends JsonLdNode {
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string;
  embedUrl: string;
  /** ISO 8601, e.g. `PT3M34S`. */
  duration?: string;
  uploadDate?: string;
  inLanguage: LanguageId;
}

/** Where the page sits, for the trail a result shows above its title. */
export interface BreadcrumbListNode extends JsonLdNode {
  '@type': 'BreadcrumbList';
  itemListElement: {
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }[];
}

/**
 * What a page's node factory is handed. Everything it needs is derived from the
 * URL being rendered rather than read from a service, so the graph describes
 * the page it is emitted for even mid-navigation.
 */
export interface JsonLdContext {
  /** The site's origin, without a trailing slash. */
  readonly origin: string;
  /** The language the URL names. */
  readonly lang: LanguageId;
  /** The page's own canonical, absolute URL. */
  readonly url: string;
  /** The `@id` of the {@link WebSiteNode} every page emits. */
  readonly siteId: string;
  /** An absolute URL for a hashed asset import. */
  absolute(url: string): string;
  /** A translated string, in the page's language. */
  readonly translate: TranslationService['translate'];
}

/** The `@id` values nodes reference each other by, per origin. */
export function jsonLdIds(origin: string) {
  return {
    site: `${origin}/#website`,
    publisher: `${origin}/#organization`,
    editor: `${origin}/#editor`
  };
}

/**
 * An absolute URL for an asset the build hashed. The imports resolve to
 * `./media/<name>-<hash>.<ext>` — correct in markup, where `<base href="/">`
 * settles them, and useless in JSON-LD, which a crawler reads with no document
 * to resolve against.
 */
export function absoluteAssetUrl(origin: string, assetUrl: string): string {
  if (/^[a-z]+:/i.test(assetUrl)) {
    return assetUrl;
  }
  const path = assetUrl.replace(/^\.+/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * `3:34` as `PT3M34S`. The durations are authored the way they read on YouTube;
 * schema.org wants ISO 8601, and one of the two has to be derived from the
 * other rather than maintained twice.
 */
export function isoDuration(clock: string): string {
  const parts = clock.split(':').map(Number);
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !Number.isFinite(part))
  ) {
    return '';
  }
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
  const time = [
    hours ? `${hours}H` : '',
    minutes ? `${minutes}M` : '',
    seconds ? `${seconds}S` : ''
  ].join('');
  return time ? `PT${time}` : 'PT0S';
}

/** The nodes every page carries: the site and who publishes it. */
export function siteNodes(
  context: JsonLdContext,
  repositoryUrl: string
): JsonLdNode[] {
  const ids = jsonLdIds(context.origin);
  const name = context.translate('site.name');

  const site: WebSiteNode = {
    '@type': 'WebSite',
    '@id': ids.site,
    name,
    url: `${context.origin}/${context.lang}`,
    description: context.translate('site.description'),
    inLanguage: context.lang,
    publisher: { '@id': ids.publisher }
  };

  const publisher: OrganizationNode = {
    '@type': 'Organization',
    '@id': ids.publisher,
    name,
    url: context.origin,
    sameAs: [repositoryUrl]
  };

  return [site, publisher];
}

/**
 * Serializes a graph for a `<script type="application/ld+json">`.
 *
 * Every `<` is written as its unicode escape, which keeps the JSON valid and
 * identical in meaning while making a closing script tag unwritable — the one
 * way a translated string or, once the community pages land, a circuit name or
 * a username could end the block early and turn stored text into markup.
 */
export function serializeJsonLd(graph: readonly JsonLdNode[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  }).replace(/</g, '\\u003c');
}
