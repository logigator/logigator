# Server-Side Rendering

The backend uses **express-handlebars** for server-side HTML rendering. All public-facing pages (home, community, my projects, auth pages, etc.) are server-rendered Handlebars templates. The editor SPA at the editor subdomain is a separate static build and is not part of this system.

The full request-to-response pipeline is: routing-controllers `@Render` decorator selects a view, the view is injected into `default.hbs` via `{{{body}}}`, and the assembled HTML is sent to the client.

---

## Engine Setup

Engine configuration happens in `logigator-backend/src/main.ts` (lines 117-127):

```typescript
app.engine('hbs', exphbs.create({
    extname: '.hbs',
    layoutsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'layouts'),
    partialsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'partials'),
    defaultLayout: 'default',
    helpers: handlebarsHelpers
}).engine);

app.set('views', path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'views'));
app.set('view engine', 'hbs');
```

| Option | Value | Notes |
|---|---|---|
| `extname` | `.hbs` | File extension for all templates |
| `layoutsDir` | `resources/private/templates/layouts/` | Only one layout: `default.hbs` |
| `partialsDir` | `resources/private/templates/partials/` | 35 partials for forms, popups, navigation, UI components |
| `defaultLayout` | `'default'` | All full-page renders use this layout (can be overridden with `{ layout: false }`) |
| `helpers` | `handlebarsHelpers` | 17 registered helpers (see below) |

In production (`NODE_ENV === 'production'`), Express view caching is enabled via `app.set('view cache', true)`. In development, templates are reloaded from disk on every render.

---

## The `default.hbs` Layout

File: `resources/private/templates/layouts/default.hbs`

### HTML5 Shell

```html
<!doctype html>
<html lang="{{preferences.lang}}">
```

The `<html lang>` attribute is set from `preferences.lang`, which is the user's selected language (defaulting to browser-accepted language).

### SEO Metadata

The layout includes standard meta tags: `description`, `keywords`, Open Graph (`og:title`, `og:url`, `og:image`, `og:description`), Twitter Card (`twitter:card`, `twitter:image`, `twitter:title`, `twitter:description`), `apple-mobile-web-app-title`, `application-name`, `msapplication-TileColor`, `theme-color`, and favicon links for all platforms.

### Hreflang Alternates (altPages)

```handlebars
{{#each altPages}}
    <link rel="alternate" hreflang="{{lang}}" href="{{href}}">
{{/each}}
```

`altPages` is an array set by `GlobalViewDataMiddleware` containing one entry per supported language plus an `x-default` entry. Each entry links to the same page path prefixed with the language code (e.g., `/en/features`, `/de/features`).

### Theme-Aware Body Class

```handlebars
<body class="{{#if (expr preferences.theme '===' 'dark') }}theme-dark{{else}}theme-light{{/if}}">
```

The body class is set based on the user's theme preference (stored in the `preferences` cookie). All CSS is written against these two top-level classes.

### CSS Loading via `{{styleTag}}`

```handlebars
{{styleTag url='/css/layouts/default.css' }}
{{styleTag url=(concat '/css/views/' @exphbs.view '.css') }}
{{#if additionalCss}}
    {{styleTag url=additionalCss }}
{{/if}}
```

- **Global stylesheet** (`default.css`) is always loaded.
- **View-specific stylesheet** is loaded based on the `@exphbs.view` variable (the view name passed to `res.render()`), following the convention `/css/views/<view-name>.css`.
- **Additional CSS** can be injected by controllers via `response.locals.additionalCss`.

All `{{styleTag}}` calls produce `<link rel="stylesheet" type="text/css" href="...?<md5-hash>">` with MD5 cache-busting in all environments.

### JS Loading via `{{scriptTag}}` (Module/NoModule Pattern)

```handlebars
{{scriptTag url='/js/global-es2015.js' type='module' }}
{{scriptTag url='/js/global-es5.js' type='nomodule' }}
{{#if additionalScript}}
    {{scriptTag url=additionalScript }}
{{/if}}
{{#if viewScript}}
    {{scriptTag url=(concat '/js/views/' viewScript '-es2015.js') type='module' }}
    {{scriptTag url=(concat '/js/views/' viewScript '-es5.js') type='nomodule' }}
{{/if}}
```

- **Global JS** is always loaded with the ES2015/ES5 module/nomodule pattern.
- **View-specific JS** is loaded when a controller sets `viewScript` in its return data. The convention is `/js/views/<viewScript>-es2015.js` (module) and `/js/views/<viewScript>-es5.js` (nomodule).
- **Additional scripts** can be injected via `response.locals.additionalScript`.

All `{{scriptTag}}` calls produce `<script defer src="...?<md5-hash>"></script>` with MD5 cache-busting. This uses `fs.readFileSync` to compute the hash on first request (with in-memory caching in production).

### The `{{{body}}}` Insertion Point

The view content renders into the `{{{body}}}` triple-stash (raw HTML, not escaped) inside `<div class="main-content">`.

### Rendering Order in Body

```
{{> site-header }}
{{> burger-menu }}
<div class="main-content">{{{body}}}</div>
{{> footer }}
{{> info-popups }}
```

The layout renders site header, burger menu (off-canvas nav), the main content, footer, and info popups in that order. The info-popups partial renders all one-shot flash messages (registration success, password changed, etc.).

---

## The `response.locals` Contract

Multiple middleware layers populate `response.locals` with data that is available to every view. Controllers then merge their own data by returning an object from the handler.

### Middleware Execution Order

1. **`TrailingSlashMiddleware`** (`before`, priority default) — redirects `/foo/` to `/foo` (301), except for `/api` routes.
2. **`DefaultPreferencesMiddleware`** (`before`, priority default) — ensures the `preferences` cookie exists with valid `lang` and `theme` values. Sets defaults if absent.
3. **`TranslationMiddleware`** (`before`, priority default) — extracts language prefix from URL (e.g., `/en/features` -> `/features`) and updates the `lang` preference. Skips `/api` routes.
4. **`GlobalViewDataMiddleware`** (`before`, priority -1 — runs before default-priority middlewares) — sets `i18n`, `altPages`, clears flash data (`formErrors`, `infoPopup`).
5. **`UserDataMiddleware`** (`before`, priority default) — sets authentication state, user info, preferences, and acceptedCookies cookie.

### Fields Set by Middleware

#### `GlobalViewDataMiddleware`

| Field | Type | Source | Notes |
|---|---|---|---|
| `i18n` | object | `TranslationService.getTranslations()` | Nested translation keys based on `request.cookies.preferences.lang` |
| `altPages` | array | Computed from `availableLanguages` | Each entry: `{ lang: string, href: string }` |
| `formErrors` | object or undefined | `request.session.formErrors` | **One-shot flash** — read from session then cleared |
| `infoPopup` | object or undefined | `request.session.infoPopup` | **One-shot flash** — read from session then cleared |

#### `UserDataMiddleware`

| Field | Type | Notes |
|---|---|---|
| `isAuthenticated` | boolean | `request.isAuthenticated()` |
| `user` | object or undefined | Only set when authenticated — `{ username, email, image }` |
| `preferences` | object | From `request.cookies.preferences` — always has `{ lang, theme }` |
| `acceptedCookies` | string or undefined | From `request.cookies.acceptedCookies` |

### Fields Set by Controllers

Controllers return data from their `@Render`-decorated methods. This data is merged into the template context on top of `response.locals`. Common fields include:

| Field | Type | Purpose |
|---|---|---|
| `pageTitle` | string | Set via `setTitleMiddleware` (see page title flow below) |
| `viewScript` | string | Enables view-specific JS loading in the layout |
| `additionalCss` | string | URL to an extra stylesheet |
| `additionalScript` | string | URL to an extra script |
| `layout` | boolean | Set to `false` to render the view without a layout (AJAX fragments) |
| `editorUrl` | string | The editor subdomain URL |

### View Name Availability

The built-in express-handlebars variable `@exphbs.view` (accessed as `@exphbs.view` in the layout) contains the view name string passed to `res.render()`. This drives the automatic view-specific CSS loading in `default.hbs`.

---

## The 17 Handlebars Helpers

All helpers are registered via `handlebarsHelpers` in `src/handlebars-helper/helpers.ts` and passed to the engine at startup.

### Link Href — Language Prefixing

**File:** `linkHref.helper.ts`  
**Registration name:** `linkHref`  
**Signature:** `{{linkHref url}}`

Prepends the user's language code to URLs so that `/features` becomes `/en/features` or `/de/features`. Special cases:
- `'/'` returns `'/<lang>'` (the root path becomes the language root).
- URLs starting with the editor domain are returned unchanged (the editor SPA is language-independent).
- Otherwise, prepends `/<lang>` to the URL path.

### Script Tag — MD5 Cache-Busting

**File:** `scriptTag.helper.ts`  
**Registration name:** `scriptTag`  
**Signature:** `{{scriptTag url='/js/foo.js'}}` or `{{scriptTag url='/js/foo.js' type='module'}}` or `{{scriptTag url='/js/foo.js' type='nomodule'}}`

Produces a `<script>` tag with an MD5 hash query parameter for cache-busting. Reads the file from `resources/public/` to compute the hash. In production, results are cached in an in-memory `Map<string, string>`. Supports `type="module"` and `nomodule` attributes.

### Style Tag — MD5 Cache-Busting

**File:** `styleTag.helper.ts`  
**Registration name:** `styleTag`  
**Signature:** `{{styleTag url='/css/foo.css'}}`

Produces a `<link rel="stylesheet">` tag with MD5 cache-busting. Same pattern as `{{scriptTag}}` but for CSS files. Uses an in-memory cache in production.

### Expression Evaluator

**File:** `expr.helper.ts`  
**Registration name:** `expr`  
**Signature:** `{{expr value1 'operator' value2}}`

Evaluates a binary expression and returns a boolean. Supports operators: `==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=`. Used extensively in templates for conditional rendering:

```handlebars
{{#if (expr preferences.theme '===' 'dark')}}...{{/if}}
{{#if (expr type '===' 'projects')}}...{{/if}}
```

### Ternary

**File:** `ternary.helper.ts`  
**Registration name:** `ternary`  
**Signature:** `{{ternary condition trueValue falseValue}}`

Standard ternary conditional (inline if/else). Used for simple value selection:

```handlebars
{{ternary (expr @root.preferences.theme '===' 'dark') this.previewDark this.previewLight}}
```

### SI Unit Formatting

**File:** `si.helper.ts`  
**Registration name:** `si`  
**Signature:** `{{si value}}` or `{{si value decimals}}`

Formats a number with SI prefix symbols (k, M, G, T, P, E, Z, Y for large numbers; m, u, n, p, f, a, z, y for small numbers). Defaults to 2 decimal places.

### Date Formatting

**File:** `date.helper.ts`  
**Registration name:** `date`  
**Signature:** `{{date value}}`

Formats a date string using `TranslationService.dateFormatDate()` which provides locale-aware formatting. The language parameter comes from `options.data.root.preferences.lang`.

### String Concatenation

**File:** `concat.helper.ts`  
**Registration name:** `concat`  
**Signature:** `{{concat part1 part2 part3 ...}}`

Concatenates any number of string arguments, skipping objects (which are internal Handlebars metadata like options). Used to build paths:

```handlebars
{{concat '/css/views/' @exphbs.view '.css'}}
{{concat @formName '_' name}}
```

### Print If (Conditional Rendering)

**File:** `printif.helper.ts`  
**Registration name:** `printIf`  
**Signature:** `{{printIf condition value}}`

Renders the value if the condition is truthy, otherwise renders nothing. Used for optional class names and attributes.

### Safe String (Unescaped HTML)

**File:** `safeString.helper.ts`  
**Registration name:** `safeString`  
**Signature:** `{{safeString text}}`

Wraps a string in a Handlebars `SafeString` so it is rendered as raw HTML (not escaped). Used in the features view where translation strings contain HTML tags.

### Handle New Lines

**File:** `handleNewLines.ts`  
**Registration name:** `handleNewLines`  
**Signature:** `{{handleNewLines text}}`

Escapes HTML in the text using `Handlebars.Utils.escapeExpression`, then converts `\r\n` and `\n` to `&#10;` HTML entities. Used for multi-line descriptions in community listings and examples. Note: the escape-then-replace order means the HTML-safe entities pass through without being double-escaped.

### Form Name Scope

**File:** `form-name-scope.helper.ts`  
**Registration name:** `formNameScope`  
**Signature:** `{{#formNameScope action namePrefix}}...{{/formNameScope}}`

A block helper that derives a form name from the form's action URL by replacing `/` with `_` and stripping the leading `_`. Sets `@formName` in the Handlebars data frame for use by form field helpers. An optional `namePrefix` allows disambiguating multiple forms with the same action on one page:

```
action = '/auth/local-login' -> formName = 'auth_local-login'
action = '/preferences/set-lang' with namePrefix 'burger' -> formName = 'burger_preferences_set-lang'
```

### Form Field Name Scope

**File:** `form-field-name-scope.helper.ts`  
**Registration name:** `formFieldNameScope`  
**Signature:** `{{#formFieldNameScope fieldName}}...{{/formFieldNameScope}}`

A block helper that sets `@fieldName` in the data frame for use by `formFieldError` and other error helpers. Wraps the per-field error block in `form-input.hbs`.

### Form Field Value

**File:** `form-field-value.helper.ts`  
**Registration name:** `formFieldValue`  
**Signature:** `{{formFieldValue fieldName}}` or `{{formFieldValue fieldName defaultValue}}`

Looks up the submitted value for a field from `this.formErrors[formName][fieldName].value`. Falls back to the optional `defaultValue`. Used to repopulate form inputs after a failed submission:

```handlebars
<input ... value="{{formFieldValue name value}}">
```

### Form Field Has Errors

**File:** `form-field-has-errors.helper.ts`  
**Registration name:** `formFieldHasErrors`  
**Signature:** `{{#formFieldHasErrors fieldName}}...{{/formFieldHasErrors}}`

A block helper that renders its content only if `this.formErrors[formName][fieldName].errors` is non-empty. Used to add the `is-invalid` CSS class to form inputs.

### Form Field Error

**File:** `form-field-error.helper.ts`  
**Registration name:** `formFieldError`  
**Signature:** `{{#formFieldError errorName}}...{{/formFieldError}}`

A block helper that renders its content only if a specific error string is present in `this.formErrors[formName][fieldName].errors`. Used to show/hide individual validation error messages:

```handlebars
{{#formFieldError 'invalid'}}Invalid value{{/formFieldError}}
{{#formFieldError 'required'}}This field is required{{/formFieldError}}
```

### Info Popup Data Scope

**File:** `info-popup-data-scope.helper.ts`  
**Registration name:** `infoPopupDataScope`  
**Signature:** `{{#infoPopupDataScope}}...{{/infoPopupDataScope}}`

A block helper that creates a new data frame with `infoPopupData` set to `this.infoPopup.data`. Used inside the `info-popup.hbs` partial to make popup-specific data available to the popup content.

---

## Partials System

35 partials live in `resources/private/templates/partials/`. They are organized into functional groups.

### Form System

The form system consists of several interconnected partials and helpers that work together for form rendering and validation error display.

| Partial | Purpose |
|---|---|
| `form.hbs` | Wraps a `<form>` element. Calls `{{#formNameScope}}` to derive the form name from the action URL. Passes `action`, `method`, and `class` as parameters. |
| `form-input.hbs` | A floating-label text input. Shows validation errors via `formFieldHasErrors`. Repopulates value via `formFieldValue`. Supports `tooltip`, `autocomplete`. |
| `form-input-standalone.hbs` | A simpler text input without the form-scoping or error display. Used for search boxes and inputs outside of a form. |
| `form-switch.hbs` | A toggle switch input (checkbox with slider styling). Uses `@formName` for the `id` attribute. Supports `onchange` JS. |
| `form-error.hbs` | A single validation error message div. Uses `{{#formFieldError}}` to conditionally show/hide. Supports `clientValData` for client-side validation attributes. |
| `form-general-errors.hbs` | A container for general (non-field-specific) form errors, scoped under the special field name `__general__`. |

**Usage pattern** — a form with its field and error partials declared inline:

```handlebars
{{#> form action='/auth/local-login' }}
    {{> form-input name='email' type='email' label=(i18n ...) }}
    {{> form-input name='password' type='password' label=(i18n ...) }}
    <div class="partial-form-general-errors">
        {{#formFieldNameScope '__general__'}}
            {{#formFieldError 'noUser'}}{{i18n ...}}{{/formFieldError}}
        {{/formFieldNameScope}}
    </div>
{{/form}}
```

### Popup / Modal System

| Partial | Purpose |
|---|---|
| `popup.hbs` | Generic modal popup with header (title + close icon), body area, and `data-triggers` attribute for JS activation. Supports `defaultOpen` and `jsFunction`. |
| `info-popup.hbs` | A conditional variant of `popup` that only renders when `infoPopup.show === name`. Uses `{{#infoPopupDataScope}}` to scope popup data. |
| `info-popups.hbs` | Registry of all info popup types — each wrapped in `{{#> info-popup name='...' title=i18n...}}`. Currently includes: `local-register`, `email-updated`, `password-changed`, `account-deleted`, `password-reset-mail-sent`, `password-reset`. |
| `login-popup.hbs` | Login form in a popup (for inline login from any page). |
| `register-popup.hbs` | Registration form in a popup. |
| `change-image-popup.hbs` | Profile picture upload popup. |
| `delete-account-popup.hbs` | Account deletion confirmation popup. |
| `delete-image-popup.hbs` | Profile picture deletion popup. |

### Navigation

| Partial | Purpose |
|---|---|
| `site-header.hbs` | Top navigation bar with logo, main links (Features, Community, Download, Projects, Components), user dropdown or login/register buttons. Includes `settings-dropdown.hbs`, `login-popup.hbs`, and `register-popup.hbs`. |
| `burger-menu.hbs` | Mobile off-canvas navigation menu with language selector, theme toggle, and page links. Uses `{{#form}}` for the language and theme preference forms. |
| `settings-dropdown.hbs` | Desktop settings dropdown with dark mode toggle, language selector, and authenticated links (Projects, Components, Account, Logout). |
| `footer.hbs` | Page footer with privacy policy, imprint, and contributing links. |
| `account-nav.hbs` | Account settings sidebar navigation. |
| `account-mobile-nav.hbs` | Account settings mobile navigation. |
| `user-space-nav.hbs` | User space (my projects/components) navigation. |

### Project and Component Cards

| Partial | Purpose |
|---|---|
| `project-teasers.hbs` | Grid of project/component cards with image, name, and "View" button. Handles light/dark theme-aware image selection. |
| `project-comp-list.hbs` | Detailed tile list for "My Projects" and "My Components" pages. Tiles show name, preview image, hover actions (open, share, edit, delete, info), and a "new" tile. |
| `community-list.hbs` | Community project/component list items with description, star/unstar, stargazers count, user info, and open/view buttons. |
| `community-user-list.hbs` | Community user list items. |
| `community-proj-comp-star-list.hbs` | Stargazers list for a project or component. |

### Icon System

| Partial | Purpose |
|---|---|
| `icon.hbs` | Renders an SVG icon with theme-specific path lookup: `/assets/icons/<theme>/<icon>.svg`. The theme is read from `@root.preferences.theme`. |

```handlebars
{{> icon icon='close' alt='Close' class='partial-popup__close' }}
```

### Other UI Components

| Partial | Purpose |
|---|---|
| `login-form.hbs` | Login form (used in both the login page and login popup). |
| `register-form.hbs` | Registration form. |
| `request-password-reset.hbs` | Password reset request form. |
| `reset-password.hbs` | Password reset form (with token). |
| `youtube-overlay.hbs` | YouTube video embed with a click-to-play overlay (GDPR-friendly — no tracking until user interacts). |
| `half-adder-svg.hbs` | SVG illustration of a half-adder circuit, used on the home page. |
| `form-area.hbs` | A `<textarea>` form-field variant. |

---

## Views

Views live in `resources/private/templates/views/`. Each corresponds to one or more routes via the `@Render('view-name')` decorator.

### Full-Page vs. AJAX Fragment

The system supports two rendering modes:

**Full-page views** use the default layout. The controller returns data, and express-handlebars wraps the view in `default.hbs`.

**AJAX fragments** skip the layout entirely. The controller returns `{ layout: false }` in its data, and the view is rendered as a standalone HTML fragment. These are used for paginated list updates in the community and user space pages.

For example, in `CommunityController`:
- `GET /community/projects` renders the full `community` view with `viewScript: 'community'` for JS bootstrapping.
- `GET /community/projects/page` renders the `community-page` fragment with `layout: false` — the client-side JS replaces the list content via AJAX.

The same pattern exists for `/community/components`, `/my/projects`, and `/my/components`.

### ViewScript Convention

Controllers set `viewScript` in their return data to load view-specific JavaScript. The layout loads both ES2015 (module) and ES5 (nomodule) bundles for the named script:

```
/js/views/<viewScript>-es2015.js    (type="module")
/js/views/<viewScript>-es5.js       (type="nomodule")
```

### Representative Views

| View | Route(s) | Key Features |
|---|---|---|
| `home` | `GET /` | Sections: intro with logo, features grid, example projects, video, shared projects/components. Passes `editorUrl`, `examples`, `sharedProjects`, `sharedComps`. |
| `features` | `GET /features` | Feature sections with YouTube videos and localized descriptions. Uses `{{safeString}}` for HTML-rich translation strings. |
| `community` | `GET /community/projects`, `GET /community/components` | Community listing with pagination, search, and order-by-popularity/latest. Sets `viewScript: 'community'` for client-side interactivity. |
| `community-page` | `GET /community/projects/page`, `GET /community/components/page` | AJAX fragment — used for paginated content replacement. |
| `my-projects` | `GET /my/projects` | User's projects with search, pagination, tile grid, and inline popups for share/edit/delete. |
| `my-components` | `GET /my/components` | Same as my-projects but for components. |
| `login-page` | `GET /auth/login` | Standalone login page (alternative to the login popup). |
| `register-page` | `GET /auth/register` | Standalone registration page. |
| `not-found` | (404 fallback) | Simple 404 page with back link. |
| `imprint` | `GET /imprint` | Legal imprint with multi-language support. |
| `privacy-policy` | `GET /privacy-policy` | Privacy policy page. |
| `examples` | `GET /examples` | Example projects with View and Clone buttons. |
| `download` | `GET /download` | Download page for the desktop app. |
| `verify-email` | `GET /verify-email/:code` | Email verification result page. |
| `my-account` | `GET /my/account/profile` | Account settings (profile, security, delete). |
| `my-account-security` | `GET /my/account/security` | Password change form. |
| `my-account-delete` | `GET /my/account/delete` | Account deletion confirmation. |
| `login-electron` | Desktop app login (Electron-specific) | |

### Controller Rendering Pattern Example

From `HomeController`:

```typescript
@Get('/')
@Render('home')
@UseBefore(setTitleMiddleware('TITLE.HOME'))
public async index() {
    // ... data loading ...
    return {
        editorUrl: this.configService.getConfig('domains').editor,
        examples,
        sharedProjects,
        sharedComps
    };
}
```

The returned object is merged into the Handlebars context on top of `response.locals`.

---

## StandaloneViewService

**File:** `src/services/standalone-view.service.ts`

This service bypasses Express entirely and uses raw `Handlebars.compile()` for cases where a full Express response is not needed. It is used for **email generation**.

### Implementation

```typescript
@Service()
export class StandaloneViewService {
    private readonly VIEW_DIR: string;
    private _viewCache = new Map<string, HandlebarsTemplateDelegate>();

    public async renderView(view: string, data: any, lang: LanguageCode = 'en'): Promise<string> {
        // Cache lookup or compile
        const viewFile = (await fs.readFile(path.join(this.VIEW_DIR, `${view}.hbs`))).toString();
        template = compile(viewFile);
        // ...
        return template({ ...data, i18n: ... }, { helpers: handlebarsHelpers });
    }
}
```

Key differences from the Express rendering path:
- **No layout** — templates are compiled directly and rendered as standalone documents.
- **In-memory template cache** — compiled templates are cached in a `Map<string, HandlebarsTemplateDelegate>`. In the Express path, this caching is handled by express-handlebars itself.
- **Explicit `i18n` injection** — translations are looked up and merged into the template data. The Express middleware sets `response.locals.i18n` automatically.
- **Supports all helpers** — `handlebarsHelpers` are passed as runtime options to `compile()`.

### Standalone Templates

Four templates live in `resources/private/templates/standalone/`:

| Template | Used By | Purpose |
|---|---|---|
| `verification-mail-register.hbs` | `UserService.sendRegisterVerificationMail()` | Welcome email with email verification link |
| `verification-mail-email-update.hbs` | `UserService.sendEmailUpdateVerificationMail()` | Email change verification |
| `reset-password-mail.hbs` | `UserService.sendResetPasswordMail()` | Password reset link email |
| `admin-email-error-report.hbs` | `ReportErrorController.reportError()` | Error report notification to admins |

### Template Structure

All standalone templates are full XHTML 1.0 Strict documents with inline CSS and table-based layout for email client compatibility:

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
```

Each template includes:
- Google Fonts link (Roboto)
- Responsive media queries for email clients (max-width 839px)
- A header section with the Logigator logo
- A main content section with user-specific data (`{{username}}`, `{{verifyLink}}`, `{{resetLink}}`, `{{data}}`)
- A footer section with an Imprint link

---

## Page Title Flow

The page title is set through a coordinated middleware/controller chain:

1. **Controller decorator** — The `@UseBefore(setTitleMiddleware('TITLE.HOME'))` decorator registers a middleware that runs before the controller handler.

2. **`setTitleMiddleware`** — This factory function in `src/middleware/action/set-title-middleware.ts` creates an Express middleware that:
   - Gets the `TranslationService` from the DI container.
   - Calls `translationService.getTranslation(title, request.cookies.preferences.lang)` to get the localized title string.
   - Calls `setTitle(response, translatedTitle)`.

3. **`setTitle()`** — This utility function in `src/functions/set-title.ts` simply sets `response.locals.pageTitle = title`.

4. **Layout** — The `default.hbs` layout renders it as `<title>{{pageTitle}}</title>`.

Translation keys follow a `TITLE.*` naming convention (e.g., `TITLE.HOME`, `TITLE.COMMUNITY`, `TITLE.FEATURES`). The `TranslationService` handles lookup and fallback.

---

## Non-Obvious Patterns

### One-Shot Session Flash

The `infoPopup` system uses a one-shot session flash pattern:

1. A controller action sets `req.session.infoPopup = { show: 'popup-name', data: { ... } }`.
2. On the next request, `GlobalViewDataMiddleware` reads `req.session.infoPopup` into `response.locals.infoPopup` and immediately clears `req.session.infoPopup = undefined`.
3. The `info-popups.hbs` partial iterates through its registered popups. Each uses `{{#if (expr infoPopup.show '===' 'popup-name')}}` to conditionally render.
4. The `{{#infoPopupDataScope}}` helper makes `infoPopup.data` available inside the popup's scope.
5. If the user refreshes the page, the popup does not reappear (the data was already consumed).

The same pattern applies to `formErrors` — `req.session.formErrors` is read into `locals.formErrors` and cleared on every request, ensuring validation errors only appear on the redirect that follows a form submission.

### Form Name Derivation from Action URL

The `{{#formNameScope action}}` helper derives a form name from the action URL path:

```
/auth/local-login  ->  auth_local-login
/preferences/set-lang  ->  preferences_set-lang
```

This derived name is used as the key in `formErrors[formName]`, linking server-side validation errors to the correct form on the page. The `formNameScope` helper can also accept an optional `namePrefix` for cases where multiple forms on the same page share the same action URL (e.g., language selector in both the desktop dropdown and the mobile burger menu).

### The `@exphbs.view` Variable

express-handlebars exposes the current view name through the built-in `@exphbs.view` variable. The layout uses this to load a view-specific CSS file at `/css/views/<view>.css`. This eliminates the need for controllers to manually specify their CSS file — it is derived automatically from the view name.

### Theme-Aware Icon Paths

The `icon.hbs` partial constructs icon URLs using the current theme:

```handlebars
<img src="/assets/icons/{{@root.preferences.theme}}/{{icon}}.svg" ...>
```

This means every icon needs two versions: `/assets/icons/dark/close.svg` and `/assets/icons/light/close.svg`. The theme preference (dark/light) is read from the user's cookie at render time.

### SafeString for Rich Translation Content

Some translation strings contain HTML (e.g., links in the features page). The `{{safeString}}` helper wraps the string in `Handlebars.SafeString` to bypass auto-escaping:

```handlebars
<div>{{safeString i18n.FEATURES.WHAT_IS.TEXT}}</div>
```

This is used only in the features view where translations contain embedded HTML formatting.

### Layout Bypass for AJAX

Adding `layout: false` to the returned data causes express-handlebars to render the view without any layout wrapper. This is used for:
- Paginated list fragments loaded via AJAX
- The body of the `community-page` view (included via `{{> community-list}}` inside the page view's own HTML)
- Popup content loaded dynamically

The controller simply returns `{ layout: false }` alongside the data, and express-handlebars renders only the view template.

---
