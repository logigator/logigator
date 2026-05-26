# Build System

The backend's build pipeline has two independent stages: **TypeScript compilation** (server-side code via `tsc`) and a **Gulp asset pipeline** (client-side SCSS and JavaScript). The production build runs both; development runs them concurrently.

## Directory Layout

```
logigator-backend/
├── gulpfile.js                    # Gulp task definitions
├── tsconfig.json                  # TypeScript compiler options
├── package.json                   # Scripts and dependencies
├── dist/                          # Compiled JS output (tsc)
├── src/                           # TypeScript source
│   ├── main.ts                    # Server entry point
│   ├── controller/                # Routing-controllers
│   ├── services/                  # Business logic
│   ├── database/                  # TypeORM entities/repositories
│   ├── middleware/                # Express middleware
│   ├── handlebars-helper/         # Custom Handlebars helpers
│   └── ...
└── resources/
    ├── private/
    │   ├── scss/                  # SCSS source files
    │   │   ├── config/            # Variables, breakpoints, themes, BEM mixins
    │   │   ├── layouts/           # Layout-level SCSS (one per layout)
    │   │   ├── partials/          # Reusable component partials (34 files)
    │   │   ├── shared/            # Shared SCSS imported by multiple views
    │   │   ├── shared-views/      # View-level SCSS used by popup fragments
    │   │   ├── views/             # View-level SCSS (26 files)
    │   │   ├── global.scss        # Root stylesheet
    │   │   ├── buttons.scss       # Button component styles
    │   │   └── cookieconsent.scss # Cookie consent overrides
    │   ├── js/                    # JavaScript source files
    │   │   ├── bem.js             # BEM DOM utility
    │   │   ├── global-functions.js# Shared utility functions
    │   │   ├── global.js          # Global page behavior
    │   │   └── views/             # View-specific JS (5 files)
    │   └── templates/             # Handlebars templates
    │       ├── layouts/
    │       │   └── default.hbs    # Default layout with script/style includes
    │       ├── views/             # Per-page templates (30 files)
    │       └── partials/          # Reusable template partials
    └── public/                    # Compiled output served to clients
        ├── css/
        │   ├── layouts/
        │   │   └── default.css    # Compiled layout CSS
        │   └── views/             # Compiled view-specific CSS
        ├── js/
        │   ├── global-es2015.js   # Modern bundle
        │   ├── global-es5.js      # Legacy bundle
        │   └── views/             # View-specific JS bundles
        └── ...
```

---

## 1. TypeScript Compilation

The server is written in TypeScript and compiled with `tsc`. Configuration is in `tsconfig.json`:

| Option | Value | Purpose |
|---|---|---|
| `module` | `"commonjs"` | Node.js uses CommonJS modules |
| `target` | `"es2021"` | Modern Node.js versions support ES2021 natively |
| `emitDecoratorMetadata` | `true` | Required by TypeORM and routing-controllers for DI |
| `experimentalDecorators` | `true` | Required by decorator-based frameworks |
| `esModuleInterop` | `true` | Enables default imports from CJS modules |
| `sourceMap` | `true` | Debugging in production |
| `outDir` | `"./dist"` | Compiled output |
| `baseUrl` | `"./src"` | Allows non-relative imports from `src/` |
| `incremental` | `true` | Faster recompilation via `.tsbuildinfo` cache |

### Build Command

```bash
rm -fr dist && tsc -p tsconfig.json && gulp dist-for-prod
```

This removes the previous `dist/`, compiles all TypeScript to CommonJS, then runs the full Gulp asset pipeline in parallel (SCSS + JS-modern + JS-legacy).

### Dev Command

```bash
concurrently "tsc -p tsconfig.json -w" "nodemon -i resources/public/ -i resources/private/components -i resources/private/projects dist/main.js"
```

`tsc -w` watches for TypeScript changes and recompiles. `nodemon` restarts the server when `dist/` changes. The Gulp watch task (`yarn gulp watch`) must be run separately for SCSS/JS.

---

## 2. Gulp Asset Pipeline Overview

The `gulpfile.js` defines three parallel pipelines that produce static assets served to the browser:

```
                    ┌─────────────────┐
                    │   dist-for-prod  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌────▼────┐   ┌─────▼─────┐
         │  scss   │   │js-modern│   │ js-legacy  │
         └────┬────┘   └────┬────┘   └─────┬─────┘
    ┌─────────┼────────┐    │              │
┌───▼────┐ ┌──▼─────┐  │    │              │
│layouts │ │ views  │  │    │              │
└────────┘ └────────┘  │    │              │
                  ┌────▼────┐        ┌─────▼──────┐
                  │ global  │        │   global    │
                  │ views/  │        │   views/    │
                  │ ES2015  │        │   ES5       │
                  └─────────┘        └─────────────┘
```

---

## 3. SCSS Tasks

### Compilation Pipeline

Two Gulp tasks compile SCSS, each processing a different source directory:

- **`scss:layouts`** -- compiles `resources/private/scss/layouts/**/*.scss` to `resources/public/css/layouts/`
- **`scss:views`** -- compiles `resources/private/scss/views/**/*.scss` to `resources/public/css/views/`
- **`scss`** -- runs both in parallel via `gulp.parallel(['scss:layouts', 'scss:views'])`

Each file goes through:

1. **`gulp-sass`** (using the `sass` Dart Sass compiler) -- compiles SCSS to CSS
2. **`gulp-clean-css`** with `{level: 2}` -- aggressive minification (merges selectors, optimizes properties, removes overrides)

### How View-Specific CSS Is Loaded

In `default.hbs`, the layout template dynamically loads view-specific CSS using the `@exphbs.view` built-in variable provided by express-handlebars:

```handlebars
{{styleTag url=(concat '/css/views/' @exphbs.view '.css') }}
```

The `styleTag` helper (see `src/handlebars-helper/styleTag.helper.ts`) generates `<link rel="stylesheet" type="text/css" href="...">` with a cache-busting MD5 hash query parameter. When a view template is named `home.hbs`, `@exphbs.view` is `"home"`, so the generated tag becomes `<link href="/css/views/home.css?<md5hash>">`.

### Additional CSS

Controllers can pass `additionalCss` in their render data, which the layout appends:

```handlebars
{{#if additionalCss}}
    {{styleTag url=additionalCss }}
{{/if}}
```

---

## 4. SCSS Architecture

### Config Layer (`resources/private/scss/config/`)

The `config.scss` file imports all five config partials in dependency order:

1. **`_breakpoints.scss`** -- defines `$grid-breakpoints` map (xs/sm/md/lg/xl) and responsive mixins: `media-breakpoint-up`, `media-breakpoint-down`, `media-breakpoint-between`
2. **`_bemify.scss`** -- BEM methodology mixins (see section below)
3. **`_variables.scss`** -- layout constants: `$header-height: 3rem`, `$footer-height: 10rem`, `$container-max-width: 1500px`
4. **`_themes.scss`** -- theme system (see section below)
5. **`_mixins.scss`** -- `scrollbar`, `scrollbarInverted` (WebKit/Firefox scrollbar styling), `section` (responsive section container with padding)

### Theme System (`_themes.scss`)

Light and dark themes are defined as SCSS maps:

```scss
$themes: (
    light: (
        background: #F5F5F5,
        primary: #27AE60,
        accent1: #FFFFFF,
        accent2: #d1d1d1,
        text-primary: #000000,
        text-secondary: #F5F5F5,
        error: #AD2F26,
        button-text: #F5F5F5
    ),
    dark: (
        background: #262a2b,
        primary: #27AE60,
        accent1: #1A1A1A,
        accent2: #3a4042,
        text-primary: #cccccc,
        text-secondary: #000000,
        error: #CC392F,
        button-text: #000000
    )
);
```

The `themify()` mixin iterates over both themes and generates `.theme-light & { ... }` / `.theme-dark & { ... }` rules. Inside the mixin, `themed('key')` returns the current theme's value. Theme is set on `<body>` via Handlebars:

```handlebars
<body class="{{#if (expr preferences.theme '===' 'dark') }}theme-dark{{else}}theme-light{{/if}}">
```

A helper `isTheme('dark')` function is available for theme-conditional logic (used in `buttons.scss` for the `secondaryButtonBgColor` function).

### BEM Methodology (`_bemify.scss`)

The project uses a custom BEM (Block-Element-Modifier) mixin library rather than a naming convention. The key mixins are:

| Mixin | Output | Example |
|---|---|---|
| `block('name') { }` | `.name { }` | Defines a BEM block |
| `element('foo', 'bar') { }` | `.block__foo { }`, `.block__bar { }` | Elements within a block |
| `modifier('name') { }` | `.block.modifier--name` | Modifier variant |
| `state('open') { }` | `.is-open { }` | Boolean state |
| `state('open', 'custom') { }` | `.custom-open { }` | State with custom prefix |
| `pseudo('hover') { }` | `:hover { }` | Pseudo-class with proper nesting |
| `partial('name') { }` | `.partial-name { }` | Reusable component partial block |
| `view('name') { }` | `.view-name { }` | Page-specific view block |

**Partial convention**: Reusable components are scoped as `partial-<name>`. For example, `partial('site-header')` generates `.partial-site-header { }`. Handlebars partials share the same naming: the template `site-header.hbs` renders into `.partial-site-header` elements.

**View convention**: Each page is scoped as `view-<name>`. The view template wraps content in `<div class="view-<name>">`. For example, `home.hbs` starts with `<div class="view-home">`, and its SCSS uses `@include view('home') { ... }`.

### Global SCSS (`global.scss`)

Imports `config/config`, `buttons`, and `cookieconsent` in that order. Defines:

- Roboto font-face (woff2, with local fallback and `font-display: swap`)
- Universal box-sizing reset
- Default text color via `themify()`

### Layout SCSS (`layouts/default.scss`)

Imports `global.scss` and then lists all partial SCSS files used on every page:

- `site-header`, `burger-menu`, `settings-dropdown`, `footer`
- `popup`, `form-input`, `form-error`, `form-general-errors`, `form-switch`, `form-area`
- `login-register-form`, `register-popup`

Defines `.main-content` with responsive min-height (`calc(100vh - footer - header)`) and themed background/color.

### Partial SCSS Files (34 files)

Each partial is a reusable component. They use the `partial()` mixin consistently. A typical structure:

```scss
@include partial('site-header') {
    height: $header-height;
    @include themify() { background-color: themed('primary'); }

    @include element('left') { ... }
    @include element('burger-menu') {
        @include state('open') { ... }
    }
    @include element('links') { ... }
    @include element('right') {
        @include modifier('logged-in') { ... }
    }
}
```

This generates selectors like `.partial-site-header__left`, `.partial-site-header__burger-menu.is-open`, `.partial-site-header__right--logged-in`.

### View SCSS Files (26 files)

Each view SCSS file typically:

1. Imports `config/config` at minimum
2. Imports any partial SCSS needed by the view
3. Wraps everything in `@include view('name') { ... }`

For example, `home.scss`:
```scss
@import "../config/config";
@import "../partials/project-teasers";
@import "../partials/half-adder-svg";
@import "../partials/youtube-overlay";

@include view('home') { ... }
```

### Shared SCSS (`shared/` and `shared-views/`)

- **`shared/`** -- SCSS that is imported by multiple view SCSS files via `@import`. Example: `my-projects-comps.scss` is imported by both `my-projects.scss` and `my-components.scss`.
- **`shared-views/`** -- SCSS for popup fragments that are rendered without the enclosing layout (`layout: false`). These are imported by view SCSS files and compile into the view's output CSS. Example: `my-projects.scss` imports `project-component-create-popup`, `project-component-edit-popup`, etc.

### Buttons (`buttons.scss`)

Defines three button variant classes under the `themify()` mixin:

- `.btn-outline` -- subtle, no fill
- `.btn-raised` -- filled with shadow
- `.btn-normal` -- flat text style

Each variant supports `.primary`, `.secondary`, and `.danger` modifier classes with hover, active, and disabled states. Uses the `isTheme()` function to compute `secondaryButtonBgColor()` differently per theme.

---

## 5. JavaScript Build Tasks

The JS build produces two parallel sets of bundles: **ES2015** (modern browsers via `<script type="module">`) and **ES5** (legacy browsers via `<script nomodule>`).

### Source Files

The global JS bundle concatenates these files in order:

1. `vanilla-cookieconsent/dist/cookieconsent.umd.js` (from `node_modules`)
2. `resources/private/js/bem.js`
3. `resources/private/js/global-functions.js`
4. `resources/private/js/global.js`

View-specific JS files (5 total) are compiled individually from `resources/private/js/views/`:

- `my-projects-comps.js`
- `community.js`
- `community-proj-comp-star.js`
- `community-user.js`
- `my-account-profile.js`

### ES2015 (Modern) Pipeline -- `js:global-modern` / `js:views-modern`

1. **Source maps** initialized (`gulp-sourcemaps`)
2. **Concat** sources into a single file (`gulp-concat`)
3. **Babel** transpilation with `@babel/preset-env` targeting:
   - Edge 17, Firefox 60, Chrome 67, Safari 11.1
   - These targets correspond to browsers that support ES modules natively
4. **Terser** minification with `ecma: 2015` (preserves ES2015 syntax)
5. **Source maps** written alongside
6. Output: `global-es2015.js` / `<name>-es2015.js`

### ES5 (Legacy) Pipeline -- `js:global-legacy` / `js:views-legacy`

1. **Source maps** initialized
2. For the global bundle: concatenate **regenerator-runtime** first (for async/await support) followed by the same four sources
3. **Babel** transpilation with `@babel/env` targeting `> 0.5%` browserlist (broad coverage)
4. **Prepend polyfills** using `gulp-add-src`: `core-js-bundle/minified.js` and `element-closest-polyfill/index.js` are added at the very start
5. **Concat** everything into `global-es5.js`
6. **Terser** minification with `ecma: 5` and `safari10: true` (safe ES5 output)
7. **Source maps** written
8. Output: `global-es5.js` / `<name>-es5.js`

### Why Both Bundles Exist

The `<script type="module">` / `<script nomodule>` pattern enables progressive enhancement:

- Modern browsers load the ES2015 bundle (smaller, faster, no polyfills)
- Legacy browsers (IE11, older Safari, older Chrome) load the ES5 bundle with full polyfills

This is implemented in `default.hbs`:

```handlebars
{{scriptTag url='/js/global-es2015.js' type='module' }}
{{scriptTag url='/js/global-es5.js' type='nomodule' }}
```

### View-Specific JavaScript

Each controller that needs custom JS passes a `viewScript` property in its render data:

```typescript
return {
    ...pageData,
    viewScript: 'community'   // loads /js/views/community-es2015.js and community-es5.js
};
```

The layout template conditionally includes both bundles:

```handlebars
{{#if viewScript}}
    {{scriptTag url=(concat '/js/views/' viewScript '-es2015.js') type='module' }}
    {{scriptTag url=(concat '/js/views/' viewScript '-es5.js') type='nomodule' }}
{{/if}}
```

All view-specific JS files follow an IIFE pattern: they declare a named function, call it immediately, and manage pagination via `fetch()` + `pushState()` for seamless page transitions without full reloads.

---

## 6. Client-Side JavaScript Overview

### `bem.js` -- BEM DOM Utility

A `window.Bem` object with methods for BEM-aware DOM manipulation:

| Method | Purpose |
|---|---|
| `bemClass(node)` | Returns the block class (first non-modifier class) |
| `element(node, name)` | Finds first child matching `.block__name` |
| `elements(node, name)` | Finds all children matching `.block__name` |
| `setState(node, state, active)` | Toggles `.is-<state>` class |
| `hasState(node, state)` | Checks `.is-<state>` class |
| `toggleState(node, state)` | Toggles `.is-<state>` class |
| `hasModifier(node, modifier)` | Checks `.block--<modifier>` class |
| `data(node, key)` | Reads `data-<key>` attribute |

### `global-functions.js` -- Shared Utilities

Exported as `window.*` functions:

- **`setBurgerMenuState(open)`** -- Toggles the mobile burger menu open/closed using BEM state classes on burger menu, background, and button elements
- **`debounceFunction(func, ms)`** -- Standard debounce wrapper
- **`startFormValidation(formElement)`** -- Client-side form validation using `data-error` attributes on error message elements. Validates on input events, disables submit until all valid.
- **`openDynamicPopup(url, container)`** -- Fetches popup HTML from the server, inserts it, wires up form submission with `fetch()` and redirect handling
- **`autoAdjustFontSize(context)`** -- Adjusts `font-size` on elements with `[auto-font-size]` attribute to fit text within a desired pixel width

### `global.js` -- Page Behavior

Initializes on DOM load by querying for known partial elements:

- **`siteHeaderPartial`** -- Click handler for the settings dropdown trigger and burger menu toggle
- **`popupPartial`** -- Opens/closes popups based on `data-triggers` attribute. Dispatches `popup-opened` / `popup-closed` custom events for downstream listeners (e.g., image cropper initialization)
- **YouTube overlay** -- Lazy-loads YouTube iframes on first click (once, passive)
- **Form validation** -- Initializes `startFormValidation` for every `<form>` with a submit button
- **CookieConsent** -- Initializes `vanilla-cookieconsent` with 4 languages (en/de/es/fr), two categories (necessary + analytics), bar layout, 365-day expiry

### View-Specific JS (5 files)

All share the same pagination pattern:

1. Read `viewScript` name from controller, which maps to the view JS filename
2. Query for the view's root element, list container, and page buttons
3. Define a `navigate(page, search, orderBy)` async function that fetches partial HTML, replaces container content, updates pagination UI, and pushes URL state
4. Attach event listeners for pagination buttons, search (debounced), and sort controls
5. Call `updatePagination()` on init

---

## 7. Cache-Busting Strategy

Both `scriptTag` and `styleTag` are custom Handlebars helpers that generate cache-busting URLs using MD5 hashes of the file content:

```handlebars
<!-- Output: <link href="/css/views/home.css?d41d8cd98f00b204e9800998ecf8427e"> -->
{{styleTag url='/css/views/home.css'}}
```

In production, the helper caches hashes in a `Map` to avoid repeated filesystem reads. File paths are resolved relative to `resources/public/`.

---

## 8. Watch Tasks

For development, the Gulp watch tasks monitor source directories and recompile on change:

- **`scss:watch`** -- watches `resources/private/scss/**/*.scss`, runs `scss` task on change
- **`js:watch`** -- watches `resources/private/js/**/*.js`, runs `js-modern` task on change (modern output only; rebuild ES5 only in production)
- **`watch`** -- runs both SCSS and JS watch in parallel

---

## 9. `dist-for-prod`

This is the task invoked by `yarn build` after `tsc` finishes:

```javascript
gulp.task('dist-for-prod', gulp.parallel(['scss', 'js-legacy', 'js-modern']));
```

All three pipelines run in parallel since they have no interdependencies.

---

## 10. Docker Integration

In the `docker-compose.yml` setup:

```bash
docker compose exec backend yarn build
```

This runs the full build pipeline (TypeScript + Gulp). The development workflow is:

```bash
docker compose up                          # starts all services
docker compose exec backend yarn start     # tsc -w + nodemon (in another terminal)
docker compose exec backend yarn gulp watch  # SCSS/JS watch (in another terminal)
```

The backend serves the compiled `resources/public/` directory via `expressStatic` at the application's root path, and also serves the editor-v2 SPA at the editor subdomain from a separate directory.

---

## 11. Non-Obvious Patterns

### Dual ES2015/ES5 Bundles

Both bundles exist because the backend targets browsers as old as IE11 (via the `> 0.5%` browserlist query). Modern browsers get the lean ES2015 bundle with native modules; legacy browsers get the full ES5 polyfill bundle. The `<script type="module">` / `<script nomodule>` pattern is supported in all relevant browsers.

### View-Specific CSS via `@exphbs.view`

express-handlebars exposes the view name as `@exphbs.view`. The layout uses this to dynamically include the correct view CSS file. There is no manual wiring -- if a `home.hbs` view template exists, its CSS file is automatically loaded as `/css/views/home.css`.

### View-Specific JS via `viewScript` Property

Unlike CSS (which is auto-detected from the view name), JavaScript requires controllers to explicitly pass `viewScript: 'community'` (or similar) in their render data. The layout then generates both the ES2015 and ES5 `<script>` tags. This is because not all views need custom JS.

### Popups Without Layouts

Many controllers return `layout: false` for AJAX-loaded content (e.g., popups and paginated page fragments). These fragments are fetched by the client-side `openDynamicPopup()` or `navigate()` functions and rendered inline without the wrapping layout -- meaning their CSS must already be included by the parent page. This is why view SCSS files import their popup SCSS from `shared-views/`.

### Theme Applied to `<body>` Class

The theme is applied at the Handlebars level by setting `theme-dark` or `theme-light` on the `<body>` element. All themed SCSS selectors use `.theme-dark &` / `.theme-light &` as parent context, scoping theme variables to their respective ancestry.

### `isTheme()` Function in SCSS

The `_themes.scss` module exposes an `isTheme($name)` function that returns `true` during theme iteration. This is used in `buttons.scss` for the `secondaryButtonBgColor()` helper that computes different colors per theme. The function works via a `$themeForTestFunction` global variable set during `themify()` iteration.

### Handlebars Partials vs. SCSS Partials

The naming convention is consistent across templates and stylesheets: `site-header` is both a Handlebars partial (in `templates/partials/site-header.hbs`) and an SCSS partial (in `scss/partials/site-header.scss`), both generating `.partial-site-header` selectors. This convention makes it easy to find the corresponding stylesheet for any template.
