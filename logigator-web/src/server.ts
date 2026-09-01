import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express from 'express';
import { join, sep } from 'node:path';
import {
  languageFromPath,
  pathInLanguage
} from './app/translation/language-url';
import { negotiateRequestLanguage } from './app/translation/language-negotiation';

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
const angularApp = new AngularNodeAppEngine();

/** The served path of a file, as {@link IMMUTABLE_PATH} expects to see it. */
function toUrlPath(absolutePath: string): string {
  return absolutePath.slice(browserDistFolder.length).replaceAll(sep, '/');
}

/**
 * The built browser assets, including the consent bundle and the icons the
 * editor and the legacy pages link to by absolute path. Served before the
 * language redirect, so a file request is never rewritten.
 *
 * Only a hashed name may be held forever. `public/` is copied verbatim and the
 * consent bundle keeps its own name — that URL is a contract with the editor —
 * so those expire instead, which is what lets a change to the consent text or
 * the analytics snippet reach a visitor who has been here before. `ETag` and
 * `Last-Modified` then make the re-check a `304`, not a transfer.
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
 * The consent bundle, at the URL the editor injects. `@angular/build` cannot
 * emit a bundle into a subdirectory — a bundle name may not contain a slash —
 * and the path is a contract with the editor rather than a build detail, so it
 * is answered here rather than by changing the editor.
 *
 * A redirect rather than serving the file: in development the bundle never
 * reaches disk, the CLI's own server holds it, so anything reading
 * `browserDistFolder` would work in production only.
 */
app.get('/js/cookieconsent.js', (_req, res) => {
  res.redirect(302, '/cookieconsent.js');
});

/**
 * Every page lives under a language segment, so a URL without one is redirected
 * to the visitor's language — their `preferences` cookie, then
 * `Accept-Language`. The legacy middleware did the same, except it stripped the
 * segment before routing rather than redirecting to it.
 *
 * A real redirect rather than a client-side one: it is the answer to a request
 * that named no language, so the browser (and a crawler) should be told the
 * URL that does. It is `302`, not `301`, because the target depends on who is
 * asking.
 */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  if (languageFromPath(req.path)) {
    next();
    return;
  }

  const lang = negotiateRequestLanguage({
    cookie: req.headers.cookie,
    acceptLanguage: req.headers['accept-language']
  });
  const query = req.originalUrl.slice(req.path.length);
  res.redirect(302, pathInLanguage(lang, req.path) + query);
});

/**
 * Everything left is a page: render it.
 *
 * `no-store` because every render is personalized — the visitor's language,
 * theme and, for a signed-in one, their account, which the shell puts in the
 * markup and the transfer state. None of that may be held by a shared cache,
 * and there is nothing to gain from holding it: the page is rendered per
 * request either way.
 */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/**
 * Start the server when this module is the entry point. The CLI's dev server
 * imports `reqHandler` instead and runs the same middleware chain, so a
 * redirect or a static path behaves the same in development.
 */
if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 4000);
  app.listen(port, () => undefined);
}

export const reqHandler = createNodeRequestHandler(app);
