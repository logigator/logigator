import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express from 'express';
import { join, sep } from 'node:path';
import { isAvailableLanguage } from '@logigator/core';
import { isDocPageId, stripHeadingIds } from '@logigator/docs';
import { resolveMarkdownUrls } from '@logigator/ui/internal/markdown-urls';
import { docDestinations } from './app/pages/docs/doc-destinations';
import { loadDocPage } from './app/pages/docs/doc-content';
import { loadChangelog } from './app/pages/changelog/changelog-content';
import { renderChangelogFeed } from './app/pages/changelog/changelog-feed';
import {
  CONTENT_SECURITY_POLICY_HEADER,
  createCspNonce,
  reportingEndpoints,
  siteContentSecurityPolicy,
  type RenderContext
} from './content-security-policy';
import { requestOrigin } from './request-origin';
import { createErrorHandler, logProcessFailures } from './server-errors';
import { pathInLanguage } from './app/translation/language-url';
import { negotiateRequestLanguage } from './app/translation/language-negotiation';
import {
  NOT_FOUND,
  redirectHeaders,
  requestRedirect
} from './request-redirect';
import { renderRobotsTxt } from './robots';
import { communityPages } from './community-sitemap';
import {
  renderSitemap,
  renderSitemapIndex,
  SITEMAP_FILE_PATH,
  sitemapFiles,
  STATIC_PAGES,
  type SitemapFile
} from './sitemap';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Where the build stamps a content hash: everything the loader emits, under
 * `media/`, plus the bundles at the output root and the source maps beside
 * them, which carry the bundle's own hashed name.
 *
 * Matched by position rather than by the shape of a name, because a hash is not
 * recognizable — a `public/` file called `feature-overview.png` ends in eight
 * characters after a dash too, and pinning one of those forever is a mistake
 * only a rename can undo. Nothing copied from `public/` can match this: its
 * files sit in subdirectories, and the three at the root are neither JS nor
 * CSS.
 */
const IMMUTABLE_PATH =
  /^\/media\/|^\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)(?:\.map)?$/;

/** How long a file that can be republished under its own name may be held. */
const MUTABLE_ASSET_MAX_AGE = 300;

const app = express();
// Names the framework to every response for no reader's benefit.
app.disable('x-powered-by');
const angularApp = new AngularNodeAppEngine();

/** The served path of a file, as {@link IMMUTABLE_PATH} expects to see it. */
function toUrlPath(absolutePath: string): string {
  return absolutePath.slice(browserDistFolder.length).replaceAll(sep, '/');
}

/**
 * The built browser assets, including the icons the editor and the legacy pages
 * link to by absolute path. Served before the language redirect, so a file
 * request is never rewritten.
 *
 * Only a hashed name may be held forever. `public/` is copied verbatim, so its
 * files expire instead, which is what lets a changed icon or manifest reach a
 * visitor who has been here before. `ETag` and `Last-Modified` then make the
 * re-check a `304`, not a transfer.
 */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'Cache-Control',
        IMMUTABLE_PATH.test(toUrlPath(path))
          ? 'public, max-age=31536000, immutable'
          : `public, max-age=${MUTABLE_ASSET_MAX_AGE}`
      );
    }
  })
);

/**
 * A URL that is not the address of what it names is redirected to the one that
 * is, in a single hop, before anything reads a segment out of it — and a file
 * the static handler did not have ends here as a bare `404`.
 *
 * Every page lives under a language segment, so a URL without one goes to the
 * visitor's language: their `preferences` cookie, then `Accept-Language`. A
 * real redirect rather than a client-side one: the browser (and a crawler)
 * should be told the URL that names a language.
 *
 * A URL the legacy app answered goes to whatever answers it now: no address
 * that was ever in an inbox or a bookmark stops resolving.
 */
app.use((req, res, next) => {
  const answer =
    req.method === 'GET' || req.method === 'HEAD'
      ? requestRedirect(req.path, req.originalUrl.slice(req.path.length), () =>
          negotiateRequestLanguage({
            cookie: req.headers.cookie,
            acceptLanguage: req.headers['accept-language']
          })
        )
      : null;
  if (answer === null) {
    next();
    return;
  }
  if (answer === NOT_FOUND) {
    res.sendStatus(404);
    return;
  }
  res.set(redirectHeaders(answer));
  res.redirect(answer.status, answer.location);
});

/**
 * What a crawler may walk. Answered here rather than copied into `public/`
 * because the `Sitemap:` line names an absolute URL, which only the request
 * knows.
 *
 * It never fails. A `5xx` on this path is read as "crawl nothing", so a host
 * {@link requestOrigin} will not vouch for gets the file without the sitemap
 * line rather than an error — the rules are the same for every host either way.
 */
app.get('/robots.txt', (req, res) => {
  const origin = requestOrigin(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${MUTABLE_ASSET_MAX_AGE}`);
  res.send(renderRobotsTxt(origin && `${origin}/sitemap.xml`));
});

/**
 * Every file of the sitemap set: the site's own pages, then what the community
 * published that is worth indexing, each cut to a crawler's limits.
 *
 * The community half is read through the same public listings the browse pages
 * use, so the set is a view of the database rather than a list somebody
 * maintains. The legacy sitemap was hand-written and never named a single
 * document.
 */
async function sitemapSet(): Promise<SitemapFile[]> {
  const published = await communityPages();
  return [
    ...sitemapFiles('static', STATIC_PAGES),
    ...sitemapFiles('projects', published.projects),
    ...sitemapFiles('components', published.components)
  ];
}

/** Answers one rendering of the set, as XML a crawler may hold briefly. */
function sendSitemapXml(res: express.Response, xml: string): void {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${MUTABLE_ASSET_MAX_AGE}`);
  res.send(xml);
}

/**
 * The sitemap index, naming each file of the set — the URL `robots.txt` names.
 *
 * A read that fails takes the whole response with it rather than answering the
 * static half: a sitemap that stops naming every document says those URLs are
 * gone, which is worse than not answering at all. `robots.txt` is the opposite
 * case, and is written the opposite way.
 */
app.get('/sitemap.xml', (req, res, next) => {
  const origin = requestOrigin(req);
  if (origin === null) {
    next();
    return;
  }
  sitemapSet()
    .then((files) => sendSitemapXml(res, renderSitemapIndex(origin, files)))
    .catch(next);
});

/**
 * One file of the set, read from the same walk the index was — it is held for
 * as long as either response may be, so a crawler following the index within
 * that window reads the files it was told about.
 *
 * A name the set does not have is a plain `404` rather than a page: a file the
 * set no longer needs is one a crawler should drop.
 */
app.use((req, res, next) => {
  const match =
    req.method === 'GET' || req.method === 'HEAD'
      ? SITEMAP_FILE_PATH.exec(req.path)
      : null;
  const origin = match && requestOrigin(req);
  if (!match || !origin) {
    next();
    return;
  }
  sitemapSet()
    .then((files) => {
      const file = files.find(({ name }) => name === match[1]);
      if (!file) {
        res.sendStatus(404);
        return;
      }
      sendSitemapXml(res, renderSitemap(origin, file.pages));
    })
    .catch(next);
});

/** `/<lang>/docs/<page>.md`, the raw-markdown twin of a documentation page. */
const DOC_TWIN_PATH = /^\/([a-z]{2})\/docs\/([a-z0-9-]+)\.md$/;

/**
 * A documentation page as the markdown it is written in, beside the page that
 * renders it. A reader that would rather have the source — an agent, a script,
 * anyone reading in a terminal — gets the document itself rather than the
 * prose dug back out of an Angular render, and the page's head names this URL.
 *
 * The destinations are rewritten the way the renderer rewrites them, so a
 * screenshot resolves to the file the build emitted and a cross link to the
 * twin of the page it names. Rooted, unlike the rendered page's: markdown
 * carries no `<base>`, so a relative `media/…` would resolve under this URL's
 * own folder. The headings' `{#id}`s come off: they are the renderer's syntax,
 * not markdown, and would read as part of the heading.
 *
 * Its `Link` header names the rendered page as canonical, so what a search
 * engine learns from the twin is credited to the page.
 */
app.use((req, res, next) => {
  const match =
    req.method === 'GET' || req.method === 'HEAD'
      ? DOC_TWIN_PATH.exec(req.path)
      : null;
  if (!match) {
    next();
    return;
  }
  const [, lang, page] = match;
  if (!isAvailableLanguage(lang) || !isDocPageId(page)) {
    next();
    return;
  }
  loadDocPage(page, lang)
    .then((markdown) => {
      const destinations = docDestinations(
        lang,
        (target) => pathInLanguage(lang, `/docs/${target}.md`),
        rootRelative
      );
      const origin = requestOrigin(req);
      if (origin) {
        res.setHeader(
          'Link',
          `<${origin}${pathInLanguage(lang, `/docs/${page}`)}>; rel="canonical"`
        );
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        `public, max-age=${MUTABLE_ASSET_MAX_AGE}`
      );
      res.send(resolveMarkdownUrls(stripHeadingIds(markdown), destinations));
    })
    .catch(next);
});

/**
 * Every release as an Atom feed, one per language, the entries carrying the
 * same notes the page draws. Answered here rather than by a render: it is XML,
 * and a feed reader is the one visitor this site has that never runs the app.
 *
 * A feed names absolute URLs, so this is the one response whose content depends
 * on the host it was asked for — hence {@link requestOrigin}, which refuses one
 * the deployment does not answer for and leaves it to the render's own check to
 * say so.
 */
app.get('/:lang/changelog.atom', (req, res, next) => {
  const { lang } = req.params;
  if (!isAvailableLanguage(lang)) {
    next();
    return;
  }
  const origin = requestOrigin(req);
  if (origin === null) {
    next();
    return;
  }
  loadChangelog(lang)
    .then((changelog) => {
      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
      res.setHeader(
        'Cache-Control',
        `public, max-age=${MUTABLE_ASSET_MAX_AGE}`
      );
      res.send(renderChangelogFeed(changelog, { origin, lang }));
    })
    .catch(next);
});

/** An emitted asset's URL as a path from the root, which `<base>` is not here. */
function rootRelative(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/')) {
    return url;
  }
  return `/${url.replace(/^\.\//, '')}`;
}

/**
 * Everything left is a page: render it.
 *
 * `no-store` because every render is personalized — the visitor's language,
 * theme and, for a signed-in one, their account, which the shell puts in the
 * markup and the transfer state. None of that may be held by a shared cache,
 * and there is nothing to gain from holding it: the page is rendered per
 * request either way.
 *
 * The policy's nonce is new per response, and the render stamps it on the
 * inline scripts it writes. Its reports go to the Reporting API group only
 * where {@link requestOrigin} vouches for the host the endpoint is named on.
 */
app.use((req, res, next) => {
  const cspNonce = createCspNonce();
  const origin = requestOrigin(req);
  res.setHeader('Cache-Control', 'no-store');
  if (origin) res.setHeader('Reporting-Endpoints', reportingEndpoints(origin));
  res.setHeader(
    CONTENT_SECURITY_POLICY_HEADER,
    siteContentSecurityPolicy(cspNonce, { reportTo: origin !== null })
  );
  angularApp
    .handle(req, { cspNonce } satisfies RenderContext)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/** A failed render or read: one log line and a plain `500`. */
app.use(createErrorHandler());

/**
 * Start the server when this module is the entry point. The CLI's dev server
 * imports `reqHandler` instead and runs the same middleware chain, so a
 * redirect or a static path behaves the same in development.
 *
 * A stop signal closes the listener and lets the requests in flight finish
 * before the process exits. Without a handler of its own the process ignores
 * the signal — it runs as PID 1 in its container — and is killed only once
 * the runtime's grace period has run out.
 */
if (isMainModule(import.meta.url)) {
  logProcessFailures();
  const port = Number(process.env['PORT'] ?? 4000);
  const server = app.listen(port, () => undefined);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}

export const reqHandler = createNodeRequestHandler(app);
