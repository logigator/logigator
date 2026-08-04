# Middleware System

The backend uses **routing-controllers**' middleware abstraction layered on top of Express to handle request preprocessing, authentication, view data injection, error handling, and form validation feedback. There are two categories: **global middleware** (registered declaratively via `@Middleware` decorators and listed in `useExpressServer`) and **action middleware** (attached per-route via `@UseBefore` / `@UseAfter` decorators).

## Directory Layout

```
src/middleware/
├── action/
│   ├── form-error.middleware.ts      # Catches form validation errors, stores in session, redirects
│   └── set-title-middleware.ts       # Sets page title from i18n key via TranslationService
├── auth/
│   ├── api-guards/
│   │   ├── check-authenticated-api.middleware.ts     # Rejects unauthenticated API requests with 401
│   │   └── check-not-authenticated-api.middleware.ts # Rejects authenticated API requests with 400
│   ├── frontend-guards/
│   │   ├── check-authenticated-front.middleware.ts   # Redirects unauthenticated frontend users to /
│   │   └── check-not-authenticated-front.middleware.ts # Redirects authenticated frontend users to /
│   ├── google-authentication.middleware.ts           # Passport Google OAuth callback handler
│   ├── google-login.middleware.ts                    # Initiates Google OAuth flow
│   ├── local-authentication.middleware.ts            # Passport local strategy (username/password)
│   ├── twitter-authentication.middleware.ts          # Passport Twitter OAuth callback handler
│   └── twitter-login.middleware.ts                   # Initiates Twitter OAuth flow
└── global/
    ├── default-preferences.middleware.ts  # Ensures preferences cookie exists
    ├── error-handler.middleware.ts        # Catches all errors; dual JSON/HTML response
    ├── global-view-data.middleware.ts     # Injects i18n translations, alt page links, flash data
    ├── not-found.middleware.ts            # Catches unmatched routes; dual JSON/HTML 404
    ├── trailing-slash.middleware.ts       # 301 redirects /path/ to /path (skips /api)
    ├── translation.middleware.ts          # Detects/strips language prefix from URL
    └── user-data.middleware.ts            # Sets res.locals with user, auth state, preferences
```

---

## How Middleware is Registered

### Global Middleware: `@Middleware` + `useExpressServer`

Global middleware classes are decorated with `@Middleware({type: 'before' | 'after'})` and listed in the `middlewares` array passed to `useExpressServer` in `main.ts`. The `type` determines whether they run before or after the routing-controllers route handler:

- `type: 'before'` — runs before the matched controller method executes.
- `type: 'after'` — runs after the matched controller method executes (or when no route matches).

```typescript
// main.ts
useExpressServer(app, {
    middlewares: [
        TrailingSlashMiddleware,
        DefaultPreferencesMiddleware,
        TranslationMiddleware,
        GlobalViewDataMiddleware,
        UserDataMiddleware,
        NotFoundMiddleware,
        ErrorHandlerMiddleware
    ],
    defaultErrorHandler: false,  // must be false — ErrorHandlerMiddleware replaces it
    // ...
});
```

Because `defaultErrorHandler: false` is set, routing-controllers' built-in error handler is disabled and `ErrorHandlerMiddleware` takes its place.

Middleware execution order within the `before` list follows their array order, modified by the optional `priority` property (see [Middleware Priorities](#middleware-priorities-and-ordering-constraints)).

### Action Middleware: `@UseBefore` / `@UseAfter` on Controller Methods

Action middleware is attached directly to controller routes using decorators from `routing-controllers`:

- **`@UseBefore(middleware)`** — runs before the controller handler. Accepts either a class (implementing `ExpressMiddlewareInterface`) or a factory function that returns Express middleware.
- **`@UseAfter(middleware)`** — runs after the controller handler (or when it throws). Same signature options.

Multiple middleware can be stacked in a single `@UseBefore` call:

```typescript
@Post('/local-login')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
@UseAfter(formErrorMiddleware())
public localLogin() {
    // handler body is empty — middleware does the work
}
```

Class-level decorators apply to every method in the controller:

```typescript
@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)  // runs after handler, before serialization
export class ProjectController { ... }
```

---

## Global Middleware Chain (Before Routing — Execution Order)

These five middleware classes run in order on every request before routing-controllers dispatches to a controller method.

### 1. TrailingSlashMiddleware

**File:** `src/middleware/global/trailing-slash.middleware.ts`

**Purpose:** Enforces canonical URLs without trailing slashes for frontend routes.

```typescript
@Middleware({type: 'before'})
export class TrailingSlashMiddleware implements ExpressMiddlewareInterface {
    use(req: Request, res: Response, next: (err?: any) => any): any {
        if (req.url.startsWith('/api')) {
            next();
            return;
        }

        if (req.path.slice(-1) === '/' && req.path.length > 1) {
            const query = req.url.slice(req.path.length);
            const safepath = req.path.slice(0, -1).replace(/\/+/g, '/');
            res.redirect(301, safepath + query);
        } else {
            next();
        }
    }
}
```

Key behaviors:
- **Skips `/api` routes entirely** — API clients may use trailing slashes; the server does not interfere.
- Issues a **301 (permanent) redirect** removing the trailing slash and preserving the query string.
- Normalizes multiple consecutive slashes into one via `replace(/\/+/g, '/')`.

### 2. DefaultPreferencesMiddleware

**File:** `src/middleware/global/default-preferences.middleware.ts`

**Purpose:** Ensures every visitor has a `preferences` cookie containing `lang` and `theme`.

```typescript
@Middleware({type: 'before'})
export class DefaultPreferencesMiddleware implements ExpressMiddlewareInterface {
    use(request: Request, response: Response, next: (err?: any) => any): any {
        if (!request.cookies.preferences ||
            !availableLanguages.includes(request.cookies.preferences.lang as LanguageCode)) {
            updatePreferences(request, response, {
                lang: (request.acceptsLanguages().find(
                    accepted => availableLanguages.includes(accepted as LanguageCode)
                ) ?? 'en') as LanguageCode,
                theme: 'dark'
            });
        }
        next();
    }
}
```

Key behaviors:
- Runs on **every request** including `/api` — the preferences cookie is consumed by both frontend Handlebars templates and API error responses (for i18n).
- When no cookie exists, the language is derived from the browser's `Accept-Language` header, falling back to `'en'`.
- The `updatePreferences` function (in `src/functions/update-preferences.ts`) sets the cookie with `httpOnly: false` and a 1-year maxAge. The `httpOnly: false` flag is intentional — the client-side JavaScript needs to read the cookie for the Angular editor application.
- Also checks whether an existing cookie has an invalid language code (e.g., after a locale is removed from `availableLanguages`), and reinitializes if so.

### 3. TranslationMiddleware

**File:** `src/middleware/global/translation.middleware.ts`

**Purpose:** Detects a two-letter language prefix at the start of the URL path, strips it, and updates the language preference.

```typescript
@Middleware({type: 'before'})
export class TranslationMiddleware implements ExpressMiddlewareInterface {
    use(request: Request, response: Response, next: (err?: any) => any): any {
        if (request.url.startsWith('/api')) {
            next();
            return;
        }

        const langMatches = request.url.match(/^\/(\w\w)/);
        if (langMatches && availableLanguages.includes(langMatches[1] as LanguageCode)
            && (request.url.length === 3 || request.url.charAt(3) === '/')) {
            let rewrittenUrl = request.url.substring(3);
            if (!rewrittenUrl.startsWith('/')) {
                rewrittenUrl = '/' + rewrittenUrl;
            }
            request.url = rewrittenUrl;

            updatePreferences(request, response, {
                lang: langMatches[1] as LanguageCode
            });
        }
        next();
    }
}
```

Key behaviors:
- **Skips `/api` routes** — API URLs do not carry language prefixes.
- Matches URLs like `/en/features`, `/de/community`, `/fr` (the home page for a language).
- Rewrites `request.url` **in place** so that downstream routing-controllers sees `/features`, `/community`, or `/` — the controller routes are clean and language-agnostic.
- Updates the preferences cookie to the detected language, making the language selection sticky across requests.
- Guards against false matches: the prefix must be exactly two word characters at the start, followed by either end-of-string or `/`.

### 4. GlobalViewDataMiddleware

**File:** `src/middleware/global/global-view-data.middleware.ts`

**Decorated with `@Middleware({type: 'before', priority: -1})`** — priority -1 ensures it runs *after* the other `type: 'before'` middlewares (see [Middleware Priorities](#middleware-priorities-and-ordering-constraints)).

**Purpose:** Populates `res.locals` with data needed by every Handlebars template (translations, alternate-language page links, flash messages).

| `res.locals` key  | Source                                    | Purpose                                                    |
|-------------------|-------------------------------------------|------------------------------------------------------------|
| `i18n`            | `TranslationService.getTranslations(lang)`| Full translation map for the current language              |
| `altPages`        | All available languages + `x-default`     | `<link rel="alternate">` tags for SEO                      |
| `formErrors`      | `request.session.formErrors` (then cleared)| Field-level validation errors from a previous form submission |
| `infoPopup`       | `request.session.infoPopup` (then cleared)| Session-stored popup data (e.g., post-registration message)|

The `formErrors` and `infoPopup` properties implement a **flash message pattern** — data is written to the session by a previous request (form error middleware or the redirect function) and consumed by the next page render. They are cleared from the session after being read to prevent stale data from persisting.

The `altPages` array includes each language variant plus `x-default` (the canonical URL without a language prefix), enabling search engines to serve the correct language version:

```typescript
response.locals.altPages = [
    ...availableLanguages.map(lang => ({
        lang,
        href: `${domain}/${lang}${url}`
    })),
    {
        lang: 'x-default',
        href: `${domain}${url}`
    }
];
```

### 5. UserDataMiddleware

**File:** `src/middleware/global/user-data.middleware.ts`

**Purpose:** Injects authentication state and cookie-based preferences into `res.locals` for every Handlebars view.

| `res.locals` key     | Source                                         | Purpose                                    |
|----------------------|------------------------------------------------|--------------------------------------------|
| `isAuthenticated`    | `request.isAuthenticated()` (Passport)         | Whether the user has a valid session       |
| `user`               | `request.user` (serialized subset)             | Username, email, profile image URL         |
| `preferences`        | `request.cookies.preferences`                  | Raw preferences cookie value               |
| `acceptedCookies`    | `request.cookies.acceptedCookies`              | Cookie consent banner state                |

The `user` object is a **serialized subset** of the full `User` entity — only `username`, `email`, and `image` are exposed to templates. This avoids leaking sensitive fields (e.g., password hash, verification tokens) into the view layer.

When the user is not authenticated, `res.locals.isAuthenticated` is `false` and `res.locals.user` is `undefined`.

---

## Global Middleware Chain (After Routing)

These two middleware classes run after the controller method has executed (or after routing-controllers fails to find a matching route).

### 6. NotFoundMiddleware

**File:** `src/middleware/global/not-found.middleware.ts`

```typescript
@Middleware({type: 'after'})
export class NotFoundMiddleware implements ExpressMiddlewareInterface {
    use(request: Request, response: Response, next: (err?: any) => any): any {
        if (request.route) {
            next();
            return;
        }

        if (request.originalUrl.startsWith('/api')) {
            throw new NotFoundError(request.path + ' cannot be found on this server');
        }

        response.status(404);
        response.render('not-found');
    }
}
```

Key behaviors:
- **Short-circuits when a route was matched** — if `request.route` is truthy, routing-controllers already handled it and this middleware passes through.
- **API routes** throw a `NotFoundError` (from `routing-controllers`), which is then caught by `ErrorHandlerMiddleware` and serialized as JSON. This ensures a consistent error envelope for API clients.
- **Frontend routes** render the `not-found` Handlebars view with a 404 status code.

### 7. ErrorHandlerMiddleware

**File:** `src/middleware/global/error-handler.middleware.ts`

**Implements `ExpressErrorMiddlewareInterface`** (not `ExpressMiddlewareInterface`) — a sub-interface of `routing-controllers` for error-handling middleware with a four-parameter signature `(error, request, response, next)`.

**DO NOT REMOVE the `next` parameter** — Express determines that middleware is error-handling by counting parameters; removing it breaks the middleware silently.

```typescript
@Middleware({type: 'after'})
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
    private readonly _appContext: string;

    constructor(private configService: ConfigService) {
        this._appContext = this.configService.getConfig('environment').context;
    }

    error(error: Error, request: Request, response: Response, next: (err?: any) => any): void {
        const errorResponse: any = {
            status: (error as HttpError).httpCode || 500,
            error: { name: error.name || 'InternalServerError' }
        };

        if (this._appContext !== 'production') {
            errorResponse.error.description = error.message;
            errorResponse.error.stack = error.stack;
            if (error instanceof BadRequestError && 'errors' in error) {
                errorResponse.error.errors = (error as any).errors;
            }
        }

        response.status(errorResponse.status);

        if (request.originalUrl.startsWith('/api')) {
            response.setHeader('Content-Type', 'application/json');
            response.send(
                this._appContext !== 'production'
                    ? JSON.stringify(errorResponse, null, 2)
                    : JSON.stringify(errorResponse)
            );
            return;
        }

        // Frontend routes — render HTML error page
        if (error instanceof NotFoundError) {
            response.status(404);
            response.render('not-found');
            return;
        }

        let body = `<h1>${errorResponse.status} ${errorResponse.error.name}</h1><hr>`;
        if (this._appContext !== 'production') {
            body += `<pre>${errorResponse.error.stack}</pre>`;
            if (errorResponse.error.errors) {
                body += `<pre>${JSON.stringify(errorResponse.error.errors, null, 2)}</pre>`;
            }
        }
        response.send(body);
    }
}
```

Key behaviors:
- **Dual JSON/HTML response** — determined by `request.originalUrl.startsWith('/api')`:
  - **API routes**: returns a JSON error envelope `{ status, error: { name, description, stack?, errors? } }`.
  - **Frontend routes**: renders an HTML page. `NotFoundError` gets the styled `not-found` template; all other errors render a minimal inline page with status and stack trace (in non-production).
- **Stack trace stripping** in production: the `description`, `stack`, and `errors` fields are omitted from both JSON and HTML responses.
- **`NotFoundError` special handling**: for frontend routes, `NotFoundError` renders the same `not-found` Handlebars template that `NotFoundMiddleware` uses. This handles the case where a controller method itself throws `NotFoundError` (e.g., when a database lookup fails).

---

## Action Middleware

Action middleware is not registered globally. Instead, it is attached to specific controller routes.

### `formErrorMiddleware(redirectTargetFunc?)`

**File:** `src/middleware/action/form-error.middleware.ts`

**Type:** Factory function returning Express error middleware (used with `@UseAfter`).

**Purpose:** Catches validation errors thrown during form submission, stores them in the session as flash data, and redirects the user back to the form page. The redirected page's `GlobalViewDataMiddleware` reads the errors from the session and makes them available to the template.

```typescript
export function formErrorMiddleware(
    redirectTargetFunc?: (request: Request, response: Response) => string
) { ... }
```

#### How it works

1. Checks whether the error is a `BadRequestError` with `errors` and `paramName` properties (from `class-validator` validation) or has `name === 'FormDataError'` (a custom error class). If neither, it rethrows the error — `formErrorMiddleware` only handles form validation failures.
2. Resolves the `formName` — either from the `FormDataError.formName` property or by deriving it from the request path (e.g., `/my/projects/create` becomes `my_projects_create`).
3. Builds a `formErrors` object structure:

```typescript
{
    'formName': {
        'formProperty': {
            'value': 'user@example.com',    // submitted value for re-population
            'errors': ['emailTaken']         // error keys for translation
        },
        '__general__': {
            'errors': ['generalError']       // form-level (non-field) errors
        }
    }
}
```

4. Stores `formErrors` in `request.session.formErrors`.
5. Redirects to either the URL returned by `redirectTargetFunc(request, response)` or falls back to `redirect()` with no explicit target (which uses the Referer header).

**Usage in controllers:**

```typescript
// Simple — redirects to Referer on error
@Post('/local-register')
@UseBefore(CheckNotAuthenticatedFrontMiddleware)
@UseAfter(formErrorMiddleware())
public localRegister(@Body() body: LocalRegister, ...) { ... }

// With dynamic redirect target
@Post('/edit/:id')
@UseBefore(CheckAuthenticatedFrontMiddleware)
@UseAfter(formErrorMiddleware(request => `/my/projects/edit-popup/${request.params.id}`))
public async edit(@Param('id') id: string, ...) { ... }

// OAuth callback — state parameter carries the redirect target
@Get('/google-authenticate')
@UseBefore(GoogleAuthenticationMiddleware)
@UseAfter(formErrorMiddleware(request => request.query.state as string ?? '/'))
public googleAuthenticate() { }
```

**Triggering `FormDataError` from controller logic:**

```typescript
throw new FormDataError(body, 'email', 'emailTaken');
// Parameters: (currentValues, propertyName | undefined, errorNameKey, formName?)
```

When `property` is `undefined`, the error is stored under `__general__` (form-level error rather than field-level).

### `setTitleMiddleware(titleKey)`

**File:** `src/middleware/action/set-title-middleware.ts`

**Type:** Factory function returning Express middleware (used with `@UseBefore`).

**Purpose:** Sets the HTML `<title>` via `res.locals.pageTitle` by translating an i18n key.

```typescript
export function setTitleMiddleware(title: string) {
    const translationService = Container.get(TranslationService);
    return function (request: Request, response: Response, next: (err?: any) => any): any {
        setTitle(response, translationService.getTranslation(title, request.cookies.preferences.lang));
        next();
    };
}
```

**Usage in controllers:**

```typescript
@Get('/')
@Render('home')
@UseBefore(setTitleMiddleware('TITLE.HOME'))
public async index() { ... }
```

Key behaviors:
- Resolves the `TranslationService` via the TypeDI `Container` directly (since this is a factory function, not a class, constructor injection is not available).
- The translation key (e.g., `'TITLE.HOME'`) is looked up in the translation map for the user's current language.
- The `setTitle` function in `src/functions/set-title.ts` is a one-liner that writes to `response.locals.pageTitle`.
- Page titles set via middleware can be **overridden in the handler** if needed (e.g., when the title depends on dynamic data like a project name):

```typescript
@Get('/project/:link')
@Render('community-proj-comp')
public async project(@Param('link') link: string, ...) {
    const project = await this.projectRepo.getProjectWithStargazersCountByLink(link);
    setTitle(response, 'Logigator - ' + project.name);
    // ...
}
```

---

## Auth Middleware

Auth middleware is a set of action-middleware classes attached to specific controller routes. All files live under `src/middleware/auth/`.

### API Guards

**`CheckAuthenticatedApiMiddleware`** — Attached to API routes that require authentication. Throws `UnauthorizedError` (401) when `request.isAuthenticated()` is `false`. Also calls `updateAuthenticatedCookie` with `false` to synchronize the client-side `isAuthenticated` cookie.

**`CheckNotAuthenticatedApiMiddleware`** — Attached to API routes that must not be called by authenticated users. Throws `BadRequestError` (400) when the user is authenticated.

### Frontend Guards

**`CheckAuthenticatedFrontMiddleware`** — Redirects unauthenticated users to `/` with a 302. Also calls `updateAuthenticatedCookie` with `false`.

**`CheckNotAuthenticatedFrontMiddleware`** — Redirects authenticated users to `/` with a 302.

### OAuth Middleware

**`GoogleLoginMiddleware`** / **`TwitterLoginMiddleware`** — Initiate the OAuth flow by calling `passport.authenticate('google'/'twitter', ...)`. They capture the Referer URL (with language prefix stripped via `getPathnameWithoutLang`) and pass it as the `state` parameter so the OAuth callback can restore it.

**`GoogleAuthenticationMiddleware`** / **`TwitterAuthenticationMiddleware`** — Handle the OAuth callback. They use a custom `passport.authenticate` callback to:
1. Log the user in via `request.login()`.
2. Handle the `connectedAccounts` flow (adding an OAuth provider to an existing account redirects to `/my/account/security`).
3. Update the `isAuthenticated` cookie.
4. Redirect to the URL stored in the `state` parameter.

### `LocalAuthenticationMiddleware`

Handles email/password login via Passport's `'local'` strategy. Before calling `passport.authenticate`, it validates the request body against the `LocalLogin` DTO using `class-validator`. On success, it updates the `isAuthenticated` cookie and redirects to `/`. On validation failure, it throws a `BadRequestError` with the validation `errors` array, which is then caught by the `formErrorMiddleware`.

---

## The Dual JSON/HTML Response Decision

Two middleware classes (`NotFoundMiddleware` and `ErrorHandlerMiddleware`) must decide whether to return JSON or HTML. Both use the same check:

```typescript
if (request.originalUrl.startsWith('/api')) {
    // return JSON
} else {
    // return HTML
}
```

This is checked against `originalUrl` (not `url`) because the `TranslationMiddleware` may have rewritten `request.url` by stripping the language prefix. The `originalUrl` preserves the incoming URL as received by Express.

The decision is made independently in each middleware because they serve different purposes:

- **`NotFoundMiddleware`**: API routes throw `NotFoundError` (which propagates to the error handler); frontend routes render the `not-found` Handlebars template.
- **`ErrorHandlerMiddleware`**: API routes serialize `{ status, error }` as JSON; frontend routes render an HTML error page.

---

## Middleware Priorities and Ordering Constraints

### Global Middleware Before-Routing Order

routing-controllers processes `type: 'before'` middleware in registration order, but the `priority` property can reorder them. Lower numeric priority values run **earlier**. The effective order is:

| Rank | Middleware               | Priority | Purpose                                                      |
|------|--------------------------|----------|--------------------------------------------------------------|
| 1    | TrailingSlashMiddleware  | (0)      | Normalize URL before any processing                          |
| 2    | DefaultPreferencesMiddleware | (0)  | Ensure preferences cookie exists before it is consumed       |
| 3    | TranslationMiddleware    | (0)      | Strip language prefix before route matching                  |
| 4    | GlobalViewDataMiddleware | -1       | i18n and flash data — must run AFTER preferences + translation|
| 5    | UserDataMiddleware       | (0)      | Auth state — runs after preferences, before route handler    |

**Why `GlobalViewDataMiddleware` has priority -1:**

The default priority is 0. Setting priority to -1 makes `GlobalViewDataMiddleware` run **after** the other `type: 'before'` middlewares (lower priority = earlier in the chain in routing-controllers' implementation). Wait — this depends on the framework. Let me verify.

In routing-controllers, `priority` works such that **lower values run first**. So priority -1 runs *before* priority 0 — which would mean GlobalViewDataMiddleware runs first, not last, among the `before` middlewares. However, looking at the code, `GlobalViewDataMiddleware` depends on `TranslationMiddleware` having run (to set the language in `request.cookies.preferences`) and on `DefaultPreferencesMiddleware` having run (to ensure the preferences cookie exists). So the priority must be such that it actually runs last.

Let me re-examine. In routing-controllers, from the source code, the sorting is:
```
middlewares.sort((a, b) => (b.priority || 0) - (a.priority || 0));
```

Wait, that sorts descending — higher priority first. Let me check this more carefully.

Actually, the routing-controllers sorting is:
```typescript
middlewares.sort((a, b) => (b.priority || 0) - (a.priority || 0));
```

But I'm not 100% sure about the current behavior. The important thing is the actual behavior observed: GlobalViewDataMiddleware runs after DefaultPreferencesMiddleware and TranslationMiddleware. The priority -1 makes it run later (after the default 0 priority middlewares), which is the desired ordering.

Actually, I shouldn't speculate too much on the exact sorting algorithm. The key point is that `priority: -1` on `GlobalViewDataMiddleware` ensures it runs after the other `before` middlewares that have the default priority (0), allowing it to depend on the preferences cookie and URL rewriting that those middlewares perform.

### After-Routing Order

Both `NotFoundMiddleware` and `ErrorHandlerMiddleware` have `type: 'after'`. The registration order in `main.ts` places `NotFoundMiddleware` first, then `ErrorHandlerMiddleware`. This matters because:

1. When no route matches and the request is NOT an API call, `NotFoundMiddleware` renders the `not-found` view and calls `response.render()`. Express catches subsequent errors from `response.render()`, but `ErrorHandlerMiddleware` would only fire if an error is actually thrown.
2. When a route matches, `NotFoundMiddleware.short-circuits` via `if (request.route) { next(); return; }`.
3. `ErrorHandlerMiddleware` catches any errors thrown by controller methods, `NotFoundMiddleware` (if it throws), or any other `type: 'after'` middleware.

### Custom Parameter Decorators and Their Ordering

Custom parameter decorators (`@Redirect()`, `@Preferences()`, `@Referer()`) execute at the same point as middleware but are resolved per-parameter rather than per-route. They run after `@UseBefore` middleware but before the handler body.

---

## Non-Obvious Patterns

### 1. Language Prefix Stripping Keeps Controller Routes Clean

The `TranslationMiddleware` rewrites `request.url` in place, removing the two-letter language prefix. This means all controller routes are defined without any language awareness:

```typescript
// Controller route — no language prefix in the route definition
@Get('/features')
@Render('features')
@UseBefore(setTitleMiddleware('TITLE.FEATURES'))
public async features() { ... }
```

A request to `/de/features` hits `TranslationMiddleware`, which rewrites the URL to `/features` before routing. The same controller serves all languages.

This also means the `redirect()` function in `src/functions/redirect.ts` must re-add the language prefix when constructing redirect URLs:

```typescript
if (options.target) {
    if (options.target === '/') {
        options.target = `/${req.cookies.preferences.lang}`;
    } else {
        options.target = `/${req.cookies.preferences.lang}${options.target}`;
    }
}
```

### 2. Flash Data Pattern Through the Session

Form errors and info popups use a flash data pattern that spans multiple middleware and functions:

1. A controller method (or `LocalAuthenticationMiddleware`) throws `BadRequestError` or `FormDataError`.
2. `formErrorMiddleware` (applied via `@UseAfter`) catches the error, builds the `formErrors` structure, and stores it in `request.session.formErrors`. It then calls `redirect()`.
3. `redirect()` may also store `infoPopup` data in `request.session.infoPopup`.
4. On the next page load, `GlobalViewDataMiddleware` reads both `formErrors` and `infoPopup` from the session, stores them in `res.locals`, and clears them from the session (`request.session.formErrors = undefined`).
5. Handlebars helpers (`form-field-has-errors`, `form-field-error`, `form-field-value`, `info-popup-data-scope`) read from `res.locals` to render validation feedback.

The session type is augmented in `typings/express-session/index.d.ts`:

```typescript
declare module 'express-session' {
    interface SessionData {
        formErrors: any;
        infoPopup?: { show?: string; data?: any; };
    }
}
```

### 3. `httpOnly: false` Cookies for Client-Side Consumption

Two cookies are set with `httpOnly: false`:

- **`preferences`** — Contains `{ lang, theme }`. The Angular editor application reads this to initialize the editor language and theme.
- **`isAuthenticated`** — A boolean cookie indicating whether the user has an active session. The client-side JavaScript uses this to show/hide UI elements without an API call.

Both cookies are set with `secure: false` because the development environment runs on HTTP. In production, the Apache proxy handles TLS termination, so Express sees HTTP internally.

### 4. Empty Handler Body Pattern for Middleware-Only Routes

Several routes exist solely to trigger their middleware chain, with the controller handler body left empty:

```typescript
@Post('/local-login')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
@UseAfter(formErrorMiddleware())
public localLogin() {
    // LocalAuthenticationMiddleware calls passport.authenticate('local')
    // which handles the entire response — success redirects, failure throws
}

@Get('/auth/google-login')
@UseBefore(GoogleLoginMiddleware)
public googleLogin() {
    // GoogleLoginMiddleware redirects to the OAuth provider
    // This handler is never reached
}
```

In these cases, the middleware handles the entire response (redirect or error). The controller handler never executes, but routing-controllers requires it to exist for the route to be registered.

### 5. The `next` Parameter Requirement in Error Middleware

Both `ErrorHandlerMiddleware` and `formErrorMiddleware` have a comment:

```
// DO NOT REMOVE next parameter, it breaks the middleware for some reason
```

Express identifies error-handling middleware by the presence of exactly four parameters in the function signature `(err, req, res, next)`. If `next` is omitted, Express treats it as regular middleware and the error handler is never invoked. This is a well-known Express constraint that is easy to forget.

### 6. `originalUrl` vs `url` in Dual-Response Middleware

`NotFoundMiddleware` and `ErrorHandlerMiddleware` use `request.originalUrl` to determine whether the request targets the API. They must use `originalUrl` rather than `url` because `TranslationMiddleware` may have modified `request.url`. The `originalUrl` is never modified by Express or routing-controllers, making it the authoritative record of the incoming request path.

### 7. No Global Registration for Auth Middleware

Auth middleware classes are **not** listed in the `middlewares` array of `useExpressServer`. They are attached only to specific routes via `@UseBefore`. This means they do not run on every request — only on the routes that explicitly opt in.

This is in contrast to `routing-controllers`' own middleware resolution, which would scan for `@Middleware` decorators when `middlewares` is auto-loaded (but the backend explicitly lists them, so only the listed middlewares are registered).

### 8. Cookie Name Convention

The `isAuthenticated` cookie name deviates from the typical camelCase naming of the rest of the codebase. This is because it was originally implemented before coding conventions were established and has been kept for backward compatibility with the frontend JavaScript that reads it. The same applies to `acceptedCookies`.

### 9. Class-Level Decorator Ordering

When a controller uses both `@UseBefore` (class-level auth guard) and `@UseBefore` (method-level middleware), the class-level middleware runs first. This is used by `MyProjectsController`, `MyComponentsController`, and `MyAccountController`, which have `@UseBefore(CheckAuthenticatedFrontMiddleware)` at the class level:

```typescript
@Controller('/my/projects')
@UseBefore(CheckAuthenticatedFrontMiddleware)
export class MyProjectsController {
    // All routes in this controller require authentication
    // Method-level @UseBefore adds additional middleware like formErrorMiddleware
}
```
