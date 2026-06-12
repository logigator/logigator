# Backend Architecture

## Overview

Logigator's backend is a Node.js Express server that serves two distinct audiences: a **JSON REST API** consumed by the SPA editor (`logigator-editor-v2`), and **server-rendered HTML pages** (Handlebars) for the public-facing website (home, community, auth, account management, etc.).

The stack is assembled from decorator-driven libraries that eliminate boilerplate:

| Concern | Library | Role |
|---|---|---|
| HTTP routing | `routing-controllers` | Class + decorator-based controllers (`@Controller`, `@JsonController`, `@Get`, `@Post`, etc.) |
| Dependency injection | `typedi` | `@Service()` / `@Container` — singleton container shared by the whole app |
| ORM | `typeorm` v0.2 | `@Entity()` + `@EntityRepository()` — MySQL via `mysql2` |
| Request validation | `class-validator` + `class-transformer` | Decorator-based DTO validation (`@IsEmail()`, `@Length()`, etc.) |
| Authentication | `passport` | Local (email/password), Google OAuth2, Twitter OAuth1a |
| Session storage | `express-session` + `connect-redis` + `redis` v4 | Server-side sessions in Redis |
| Templating | `express-handlebars` v6 | `.hbs` views, partials, layouts |
| Asset pipeline | `gulp` v4 | SCSS compilation, JS bundling (modern + legacy), minification |

---

## Directory Layout

```
logigator-backend/
├── config/                          # JSON config files (gitignored; .example copies committed)
│   ├── domains.json                 # rootUrl + editor mount path
│   ├── environment.json             # context (dev/prod), port, editor path, error-report settings
│   ├── nodemailer.json              # SMTP transport per account alias
│   ├── ormconfig.json               # TypeORM connection options (MySQL host, credentials, entities)
│   ├── passport.json                # OAuth client IDs/secrets for Google + Twitter
│   ├── redis.json                   # Redis host/port
│   └── session.json                 # Session secret + maxAge
│
├── migration/                       # TypeORM migration SQL files (generated, committed)
│
├── resources/
│   ├── public/                      # Static files served at root
│   │   ├── assets/                  # Icons, fonts, default preview images
│   │   ├── css/                     # Compiled SCSS (layouts/ + views/)
│   │   ├── js/                      # Compiled JS (global-es2015, global-es5, view scripts)
│   │   ├── preview/                 # Generated project/component preview PNGs
│   │   ├── profile/                 # Uploaded profile pictures
│   │   ├── persisted/               # File-backed entity data (circuit JSON blobs)
│   │   ├── vendor/                  # Third-party static assets (CodeMirror, etc.)
│   │   ├── sitemap.xml
│   │   └── robots.txt
│   │
│   └── private/                     # Author-only source files (not served directly)
│       ├── components/              # Old reserved directory
│       ├── js/                      # Unminified JS source (BEM helpers, view scripts)
│       ├── projects/                # Old reserved directory
│       ├── scss/                    # SCSS source (layouts/ + views/)
│       └── templates/
│           ├── layouts/
│           │   └── default.hbs      # Shell layout (<head>, header, footer)
│           ├── partials/            # Reusable .hbs fragments (forms, nav, popups)
│           └── views/               # Page-level .hbs templates (home, community, auth, my-*)
│               ├── home.hbs
│               ├── community*.hbs
│               ├── my-projects.hbs, my-components.hbs, my-account*.hbs
│               ├── login-page.hbs, register-page.hbs, reset-password.hbs
│               ├── features.hbs, download.hbs, examples.hbs
│               ├── imprint.hbs, privacy-policy.hbs, not-found.hbs
│               └── project-component-*.hbs      # Create/edit/info/share/delete popups
│           └── standalone/          # Email body templates (handlebars, no layout)
│
├── src/
│   ├── main.ts                      # Entry point: bootstrap()
│   │
│   ├── controller/
│   │   ├── api/                     # @JsonController — JSON REST endpoints
│   │   │   ├── project.controller.ts
│   │   │   ├── component.controller.ts
│   │   │   ├── share.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   └── report-error.controller.ts
│   │   │
│   │   └── frontend/                # @Controller — server-rendered HTML
│   │       ├── home.controller.ts
│   │       ├── auth.controller.ts
│   │       ├── auth-pages.controller.ts
│   │       ├── verify-email.controller.ts
│   │       ├── preferences.controller.ts
│   │       ├── features.controller.ts
│   │       ├── download.controller.ts
│   │       ├── examples.controller.ts
│   │       ├── imprint.controller.ts
│   │       ├── privacy-policy.controller.ts
│   │       ├── my/
│   │       │   ├── my-projects.controller.ts
│   │       │   ├── my-components.controller.ts
│   │       │   └── my-account.controller.ts
│   │       └── community/
│   │           ├── community.controller.ts
│   │           ├── community-proj-comp.controller.ts
│   │           ├── community-clone.controller.ts
│   │           └── community-user.controller.ts
│   │
│   ├── database/
│   │   ├── entities/                # TypeORM @Entity classes
│   │   │   ├── user.entity.ts
│   │   │   ├── project.entity.ts
│   │   │   ├── project-file.entity.ts          # Extends PersistedResource
│   │   │   ├── project-preview-dark.entity.ts
│   │   │   ├── project-preview-light.entity.ts
│   │   │   ├── project-dependency.entity.ts
│   │   │   ├── component.entity.ts
│   │   │   ├── component-file.entity.ts         # Extends PersistedResource
│   │   │   ├── component-preview-dark.entity.ts
│   │   │   ├── component-preview-light.entity.ts
│   │   │   ├── component-dependency.entity.ts
│   │   │   ├── persisted-resource.entity.ts     # Abstract base for file-backed entities
│   │   │   ├── profile-picture.entity.ts
│   │   │   └── shortcut.entity.ts
│   │   │
│   │   └── repositories/            # TypeORM @EntityRepository custom repos
│   │       ├── pageable.repository.ts           # Abstract base — paginated findAndCount
│   │       ├── project.repository.ts
│   │       ├── project-file.repository.ts
│   │       ├── project-dependency.repository.ts
│   │       ├── component.repository.ts
│   │       ├── component-file.repository.ts
│   │       ├── component-dependency.repository.ts
│   │       ├── user.repository.ts
│   │       ├── profile-picture.repository.ts
│   │       └── shortcut.repository.ts
│   │
│   ├── services/                    # Typedi @Service classes
│   │   ├── config.service.ts         # Reads config/ directory into a Map
│   │   ├── redis.service.ts          # Redis client wrapper
│   │   ├── caching.service.ts        # Namespaced cache-key wrapper over Redis
│   │   ├── passport-config.service.ts# Passport strategy + session setup
│   │   ├── user.service.ts           # User creation, auth, email verification, password reset
│   │   ├── email.service.ts          # Nodemailer transport
│   │   ├── translation.service.ts    # i18n key lookup + date formatting
│   │   ├── share-cloning.service.ts  # Deep-copy projects/components with dependencies
│   │   └── standalone-view.service.ts# Handlebars render for email bodies
│   │
│   ├── middleware/
│   │   ├── global/                  # Applied globally via routing-controllers middlewares array
│   │   │   ├── trailing-slash.middleware.ts      # 301 redirect trailing slashes (except /api)
│   │   │   ├── default-preferences.middleware.ts # Set lang/theme cookie on first visit
│   │   │   ├── translation.middleware.ts          # Rewrite /en/foo -> /foo, persist lang pref
│   │   │   ├── global-view-data.middleware.ts     # Inject i18n, alt-lang links, form errors into res.locals
│   │   │   ├── user-data.middleware.ts            # Inject user, isAuthenticated into res.locals
│   │   │   ├── error-handler.middleware.ts        # Catch-all: JSON for /api, HTML otherwise
│   │   │   └── not-found.middleware.ts            # 404: JSON for /api, HTML render otherwise
│   │   │
│   │   ├── action/                  # Applied per-route via @UseBefore
│   │   │   ├── set-title-middleware.ts
│   │   │   └── form-error.middleware.ts
│   │   │
│   │   └── auth/                    # Applied per-route via @UseBefore
│   │       ├── frontend-guards/
│   │       │   ├── check-authenticated-front.middleware.ts
│   │       │   └── check-not-authenticated-front.middleware.ts
│   │       ├── api-guards/
│   │       │   ├── check-authenticated-api.middleware.ts
│   │       │   └── check-not-authenticated-api.middleware.ts
│   │       ├── local-authentication.middleware.ts
│   │       ├── google-authentication.middleware.ts
│   │       ├── google-login.middleware.ts
│   │       ├── twitter-authentication.middleware.ts
│   │       └── twitter-login.middleware.ts
│   │
│   ├── interceptors/
│   │   └── api.interceptor.ts        # Wraps API JSON responses in { status, data }
│   │
│   ├── decorators/                  # Custom routing-controllers parameter decorators
│   │   ├── redirect.decorator.ts     # @Redirect() — inject a redirect helper into controller method
│   │   ├── preferences.decorator.ts  # @Preferences() — inject parsed user preferences
│   │   └── referer.decorator.ts      # @Referer() — inject HTTP Referer header
│   │
│   ├── models/                      # DTOs / request shapes
│   │   ├── user-preferences.ts       # { lang, theme } interface
│   │   ├── request/
│   │   │   ├── shared/              # Used by both frontend and API controllers
│   │   │   │   ├── create-project.ts
│   │   │   │   └── create-component.ts
│   │   │   ├── api/                 # Validated request bodies for JSON API
│   │   │   │   ├── project/
│   │   │   │   │   ├── save-project.ts
│   │   │   │   │   └── update-project.ts
│   │   │   │   ├── component/
│   │   │   │   │   ├── save-component.ts
│   │   │   │   │   └── update-component.ts
│   │   │   │   ├── user/
│   │   │   │   │   ├── update-user.ts
│   │   │   │   │   └── shortcut.ts
│   │   │   │   ├── report-error/
│   │   │   │   │   ├── report-error.ts
│   │   │   │   │   └── report-project.ts
│   │   │   │   ├── project-element.ts
│   │   │   │   └── project-mapping.ts
│   │   │   └── frontend/            # Validated request bodies for HTML forms
│   │   │       ├── auth/
│   │   │       │   ├── local-login.ts
│   │   │       │   ├── local-register.ts
│   │   │       │   ├── resend-verification-mail.ts
│   │   │       │   ├── reset-password.ts
│   │   │       │   └── send-password-reset-mail.ts
│   │   │       ├── my-projects/
│   │   │       │   ├── edit-project.ts
│   │   │       │   └── share-project.ts
│   │   │       ├── my-components/
│   │   │       │   └── edit-component.ts
│   │   │       ├── my-account/
│   │   │       │   ├── profile-update-email.ts
│   │   │       │   ├── profile-update-username.ts
│   │   │       │   ├── security-update-password.ts
│   │   │       │   └── delete-delete.ts
│   │   │       ├── preferences/
│   │   │       │   ├── set-language.ts
│   │   │       │   └── set-theme.ts
│   │   │       └── community/user/
│   │   │           └── user-tab.ts
│   │   │
│   │   ├── errors/
│   │   │   └── form-data.error.ts   # BadRequestError subclass carrying form field metadata
│   │   │
│   │   ├── functions/               # Pure helper functions
│   │   │   ├── redirect.ts
│   │   │   ├── generate-token.ts
│   │   │   ├── get-path-name-without-lang.ts
│   │   │   ├── get-uploaded-file-options.ts
│   │   │   ├── set-title.ts
│   │   │   ├── update-authenticated-cookie.ts
│   │   │   └── update-preferences.ts
│   │   │
│   │   ├── handlebars-helper/       # Custom Handlebars helpers registered in the engine
│   │   │   ├── helpers.ts           # Aggregator export
│   │   │   └── *.helper.ts          # One file per helper (ternary, date, concat, expr, scriptTag, etc.)
│   │   │
│   │   ├── i18n/                    # Translation dictionaries (nested key-value objects)
│   │   │   ├── index.ts             # Aggregator, types, defaults
│   │   │   ├── en.ts
│   │   │   ├── de.ts
│   │   │   ├── es.ts
│   │   │   └── fr.ts
│   │   │
│   │   └── validators/              # Custom class-validator decorators
│   │       ├── unique-property.validator.ts
│   │       └── matches-property.validator.ts
│   │
│   ├── .eslintrc.js
│   └── typings/                     # Ambient type declarations (express-handlebars, etc.)
│
├── gulpfile.js                      # SCSS compilation, JS bundling (ES2015 + ES5 legacy)
├── tsconfig.json
└── package.json
```

---

## The DI Container Triple-Registration Pattern

The `bootstrap()` entry point begins with three static calls that wire typedi's single `Container` instance into three separate libraries:

```typescript
import {useContainer as useContainerRC} from 'routing-controllers';
import {useContainer as typeOrmUseContainer} from 'typeorm';
import {useContainer as classValidatorUseContainer} from 'class-validator';
import {Container} from 'typedi';

useContainerRC(Container);
typeOrmUseContainer(Container);
classValidatorUseContainer(Container);
```

This means **one DI container** serves every framework in the stack:

- **routing-controllers** resolves controller and middleware constructor dependencies from the container, so `@InjectRepository()` and `private service: SomeService` both pull from typedi.
- **TypeORM** resolves its `@EntityRepository()` classes from the container, which is how `@InjectRepository()` (via `typeorm-typedi-extensions`) can inject custom repositories into controllers and services.
- **class-validator** resolves custom validator classes (e.g., `UniquePropertyValidator`) from the container, allowing validators to inject services like `ConfigService`.

The bridge library `typeorm-typedi-extensions` provides the `@InjectRepository()` decorator that tells routing-controllers "resolve this repository from typedi" — but TypeORM itself must also be configured to use typedi so that the repository instances are created by the container in the first place. The triple-registration is therefore:

```
routing-controllers ──useContainer──> typedi Container
TypeORM              ──useContainer──> typedi Container  (so @EntityRepository classes are container-managed)
class-validator      ──useContainer──> typedi Container  (so custom validators can inject services)
```

### How injection flows

```
Controller constructor
  ├── @InjectRepository() ProjectRepo  →  typedi resolves ProjectRepository
  │                                         (which is also an @EntityRepository,
  │                                          registered with TypeORM via typedi)
  └── private shareCloningService       →  typedi resolves ShareCloningService
                                           (which itself uses @InjectRepository)
```

Every `@Service()` and `@EntityRepository()` decorator registers its class with the typedi container. No explicit wiring or module system is needed.

---

## The `bootstrap()` Sequence Step by Step

The `bootstrap()` async function in `src/main.ts` is the entire application lifecycle. Here is the exact order of operations:

### 1. Config loading
```
Container.get(ConfigService)
```
`ConfigService.initialize()` reads `projectRootPath/config/*.json` (every file ending in `.json` that does not end in `.json.example`) and stores the parsed contents keyed by filename sans extension. This is the only synchronous boot step — the rest of the app reads config via `configService.getConfig<T>(key)`.

### 2. Environment variable
```typescript
process.env.NODE_ENV = environment.context;
```

### 3. Database connection
```typescript
await createConnection(configService.getConfig<ConnectionOptions>('ormconfig'));
```
Connects to MySQL and loads all `@Entity()` decorated classes.

### 4. Express app creation + production tuning
```typescript
const app = express();
if (environment.context === 'production') {
    app.set('view cache', true);
}
```

### 5. Global compression
```typescript
app.use(compression());
```

### 6. Editor SPA mount (static files + fallback)
```typescript
// Redirect /editor/index.html → /editor/
// Serve static files from the editor build directory
// Fallback: serve index.html for any unmatched route under /editor/ (SPA catch-all)
```
This is how the backend hosts the `logigator-editor-v2` Angular SPA. See "How the Three Packages Relate" below for details.

### 7. Root-level static files
```typescript
app.use(expressStatic(path.join(projectRoot, 'resources', 'public'), ...));
```
Serves `/assets/*`, `/css/*`, `/js/*`, `/preview/*`, `/profile/*`, `/persisted/*`, etc.

### 8. Redis initialization
```typescript
await Container.get(RedisService).init();
```
Creates a Redis client (in legacy mode for connect-redis compatibility) and connects.

### 9. Session middleware stack
```typescript
app.use(cookieParser(...));
app.use(session({ store: new RedisStore(...), ... }));
```
Signed cookies, Redis-backed sessions.

### 10. Passport bootstrap
```typescript
Container.get(PassportConfigService).setupPassport();
app.use(passport.initialize());
app.use(passport.session());
```
Registers Google OAuth2, Twitter OAuth1a, and Local (email/password) strategies. Serialization stores user ID in the session; deserialization loads from the `UserRepository`.

### 11. Body parsing
```typescript
app.use(bodyParser.urlencoded({ extended: false }));  // HTML forms
app.use(bodyParser.json({ limit: '10mb' }));           // API requests (circuit data can be large)
```

### 12. Cache-control header
Every response gets `Cache-Control: no-cache, max-age=0, must-revalidate`.

### 13. Handlebars engine registration
```typescript
app.engine('hbs', exphbs.create({
    extname: '.hbs',
    layoutsDir: 'resources/private/templates/layouts',
    partialsDir: 'resources/private/templates/partials',
    defaultLayout: 'default',
    helpers: handlebarsHelpers
}).engine);
app.set('view engine', 'hbs');
```
18 custom helpers are registered (ternary, date formatting, form-field-error, script/style tag helpers, etc.).

### 14. routing-controllers bootstrap
```typescript
useExpressServer(app, {
    controllers: [/* 21 controllers */],
    middlewares: [/* 7 middlewares */],
    validation: { whitelist: true, forbidNonWhitelisted: true },
    development: environment.context === 'development',
    cors: false,
    defaultErrorHandler: false,
    currentUserChecker: action => (action.request as Request).user
});
```
This is where routing-controllers scans the registered controllers and middlewares, registers Express routes from the decorators, and sets up its own request pipeline (middleware order is: before-global → controller → after-global).

### 15. HTTP server start
```typescript
const server = app.listen(environment.port, () => {
    console.log('App started successfully');
});
```

### 16. Graceful shutdown
```typescript
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}
```

---

## The Dual Response Architecture

The backend operates two parallel response systems distinguished by URL prefix:

### JSON API (`/api/*`)

Controllers use `@JsonController` and return plain objects or Promises. An `ApiInterceptor` wraps every response:

```typescript
intercept(action: Action, result: any): any {
    return {
        status: (action.response as Response).statusCode,
        data: result || {}
    };
}
```

So every API response shape is `{ status: 200, data: { ... } }`.

Features:
- Auth guards: `@UseBefore(CheckAuthenticatedApiMiddleware)` / `CheckNotAuthenticatedApiMiddleware`
- Request validation via `class-validator` DTOs in `@Body()` — `whitelist: true` strips unknown properties, `forbidNonWhitelisted: true` rejects them
- Entity serialization via `@Expose()` / `@Exclude()` from `class-transformer`, with group-based views (`'showShareLinks'`, `'detailed'`, `'privateUserData'`)
- File uploads via `@UploadedFiles()` with multer under the hood
- `@CurrentUser()` parameter decorator injects the authenticated user from Passport (or undefined)

### Server-Rendered HTML (all other routes)

Controllers use `@Controller` and return objects that are passed to `@Render('view-name')`. The Handlebars engine renders the named view inside the `default.hbs` layout (unless `layout: false` is returned).

Features:
- Middleware injects data into `res.locals` for every template:
  - `GlobalViewDataMiddleware`: translation dictionary (`i18n`), `altPages` (hreflang links), session flash data (`formErrors`, `infoPopup`)
  - `UserDataMiddleware`: `isAuthenticated`, `user` object (username, email, image), `preferences` from cookie, `acceptedCookies`
- Language prefix routing: `/en/community/projects` rewrites to `/community/projects` and persists the language preference to a cookie
- Trailing slashes: `/about/` → `301 /about` (redirect, not rendered)
- Form errors survive redirects via session flash (`request.session.formErrors`)
- Info popups survive redirects via session flash (`request.session.infoPopup`)

### Error handling

The `ErrorHandlerMiddleware` (type `'after'`) branches on the request path:

```typescript
if (request.originalUrl.startsWith('/api')) {
    response.status(errorResponse.status);
    response.json(errorResponse);  // { status, error: { name, description?, stack?, errors? } }
} else {
    if (error instanceof NotFoundError) {
        response.render('not-found');  // HTML 404 page
    } else {
        response.send(`<h1>${status} ${name}</h1><hr><pre>${stack}</pre>`);
    }
}
```

In production, stack traces and error details are omitted from the response.

---

## Key Architectural Decisions and Non-obvious Patterns

### `PersistedResource` — files as database columns

Circuit data (project elements JSON, component definitions) and binary files (preview images, profile pictures) are stored on the **filesystem** but referenced through TypeORM entities. The abstract `PersistedResource` entity class manages this:

```typescript
export abstract class PersistedResource {
    @PrimaryGeneratedColumn('uuid')  id: string;
    @Generated('uuid')               _filename: string;     // unique filename on disk
    @Column()                        mimeType: string;
    @Column({type: 'char', length: 32}) _hash: string;      // md5 of content

    // TypeORM lifecycle hooks:
    @AfterInsert()   private async createFile() { /* write _fileContent to disk */ }
    @BeforeUpdate()  private async updateFile() { /* re-write on hash change */ }
    @BeforeRemove()  private async deleteFile() { /* unlink */ }

    get filePath(): string {
        return path.join(projectRoot, 'resources', this._path, `${this._filename}.${ext}`);
    }
}
```

Subclasses (`ProjectFile`, `ComponentFile`, `PreviewDark/Light`, `ProfilePicture`) specify `_path` (e.g., `'private/projects'`, `'public/preview'`) and are otherwise identical. The `_dirty` flag ensures files are only rewritten when content actually changes.

This means the MySQL database stores only metadata (IDs, filenames, hashes, relationships) while the actual circuit data lives in `resources/persisted/` as JSON files.

### Entity serialization with dual naming

Some entities declare a TypeORM relation property and a *separate* public-facing property with the same name but different exposure rules. This is a workaround for limitations in `class-transformer`'s handling of Promise-based TypeORM relations:

```typescript
// The real TypeORM relation (private, excludes from serialization)
@ManyToOne(() => User, ...)
user: Promise<User>;

// The "fake" getter for serialization (publicly exposed with group control)
@Expose({name: 'user', groups: ['detailed']})
private __user__: User;  // typeorm-typedi-extensions populates this eagerly
```

The `private __property__` naming convention appears throughout every entity that has relations. The `@Expose({name: 'user'})` decorator tells class-transformer to serialize `__user__` under the key `user`. Relations excluded from the current serialization group simply disappear from API output.

### Pagination through `PageableRepository`

Every custom repository extends `PageableRepository<T>` rather than TypeORM's `Repository<T>`. It provides a `getPage(page, pageSize, findOptions)` method that normalizes bounds (max 1000 per page, default 20) and returns a consistent shape:

```typescript
interface Page<T> {
    page: number;
    total: number;     // total pages
    count: number;     // entries on this page
    entries: T[];
}
```

### Language prefix as URL middleware

Languages are not part of the routing-controllers decorators. Instead, `TranslationMiddleware` intercepts every non-API request, checks if the URL starts with a known language code (`/en/`, `/de/`, `/es/`, `/fr/`), strips the prefix, and stores the language preference in a cookie. Controllers never see the language prefix — they read the preference from `request.cookies.preferences.lang` or via the `@Preferences()` decorator.

### Form errors survive redirects

HTML form validation errors cannot be sent directly because the controller issues a redirect on failure (POST-redirect-GET pattern). The `FormDataError` class extends `BadRequestError` from routing-controllers with additional metadata (`currentValues`, `property`, `errorName`, `formName`). The form-error middleware catches these during the POST, stores them in `request.session.formErrors`, and the `GlobalViewDataMiddleware` reads them back for the next GET render — then clears them from the session.

### `@Transaction()` with manual repository injection

User account deletion and project/component cloning use TypeORM's `@Transaction()` decorator, but because the repositories are not typedi-managed within the transaction scope, they must be injected as method parameters via `@TransactionRepository()`:

```typescript
@Transaction()
private async cloneProjectTransaction(
    project: Project,
    dependencies: Component[],
    user: User,
    @TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
    @TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
    ...
) { ... }
```

### Dual asset pipeline (modern + legacy JS)

The gulpfile produces two JS bundles for every script:

- **ES2015** (modern): targets Edge 17+, Firefox 60+, Chrome 67+, Safari 11.1+
- **ES5** (legacy): targets `> 0.5%` browser market share, includes `core-js-bundle` and `element-closest-polyfill`

The Handlebars layout includes both via `<script>` tags — browsers load the appropriate version through the `<script type="module">` / `<script nomodule>` pattern (or server-side feature detection).

---

## How the Three Packages Relate

```
┌─────────────────────────────────────────────────────┐
│                  Apache proxy                        │
│  logigator.test → backend:3000                      │
│  (also handles SSL termination in production)        │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│              logigator-backend (:3000)               │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │  Server-rendered HTML (Handlebars)   │           │
│  │  / → HomeController                 │           │
│  │  /community/* → CommunityController │           │
│  │  /my-projects, /my-components       │           │
│  │  /login, /register, /verify-email   │           │
│  └──────────────────────────────────────┘           │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │  JSON REST API                       │           │
│  │  /api/project/*                      │           │
│  │  /api/component/*                    │           │
│  │  /api/share/*                        │           │
│  │  /api/user/*                         │           │
│  │  /api/report-error/*                 │           │
│  │  ↔ MySQL + Redis + Filesystem       │           │
│  └──────────────────────────────────────┘           │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │  Editor SPA (static mount)           │           │
│  │  /editor/* → resources/editor/       │           │
│  │  (SPA fallback: index.html for all)  │           │
│  └──────────────────────────────────────┘           │
└─────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│         logigator-editor-v2 (Angular 21 SPA)         │
│                                                     │
│  - Built to resources/editor/ in the backend dir    │
│  - Reads/writes circuit data via /api/* endpoints   │
│  - On logigator.test/editor/*                       │
└─────────────────────────────────────────────────────┘
```

The backend serves the `logigator-editor-v2` SPA as a static mount point:

```typescript
// Mount static files
app.use(configService.getConfig('domains').editor, expressStatic(
    path.join(configService.projectRootPath, configService.getConfig('environment').editor), {
        cacheControl: true,
        immutable: true,
        maxAge: '90d',
        index: false     // Don't serve index.html automatically — handled below
    }
));

// SPA fallback — serve index.html for all sub-routes the SPA router owns
app.use(configService.getConfig('domains').editor, (req, res) => {
    res.sendFile(path.join(
        configService.projectRootPath,
        configService.getConfig('environment').editor,
        'index.html'
    ));
});
```

The editor's `index.html` URL is explicitly redirected (`/editor/index.html` → `301 /editor/`). The rest of the `/editor/*` path is handled by the Angular router on the client side. The editor SPA calls back to the JSON API at `/api/project`, `/api/component`, etc. — there is no separate API gateway or microservice layer.

### Build-time integration

During production builds, `logigator-editor-v2` compiles its Angular application into a static directory under the backend's `resources/` folder. The `environment.json` config specifies `editor: "resources/editor"` as the relative path. In `docker compose up` development mode, the editor dev server runs on a separate port and is proxied by Apache — the backend only gets involved when the editor needs to persist or load circuit data through the API.

### Non-obvious: the backend owns the editor's build output

The editor package is not independently deployable in production. Its compiled assets live inside the backend's `resources/editor/` directory, and the backend serves them. This means a production release bundles both packages together — the backend is the single deployable unit.
