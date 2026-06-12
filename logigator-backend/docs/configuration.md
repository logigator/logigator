# Configuration

The backend uses a straightforward file-based configuration system: JSON files in a dedicated `config/` directory, loaded at startup by a central `ConfigService` singleton. There are no environment variables, `.env` files, or external configuration stores — every setting lives in a committed-or-copied JSON file.

---

## File Convention: `.json` vs `.json.example`

Every config file has two forms:

- **`<name>.json.example`** — Committed to git. Contains a template with placeholder values and inline documentation comments. Serves as a reference for what keys are expected.
- **`<name>.json`** — Ignored by git (via `.gitignore: /config/*.json`). Created by copying the `.example` file and filling in real values. This is the file the application actually reads.

Deploying a new instance means copying each `.json.example` to `.json` and populating it with the correct secrets and URLs for the target environment.

---

## Directory Layout

```
config/
├── domains.json             # rootUrl + editor mount path
├── environment.json         # context (dev/prod), port, error-report settings
├── nodemailer.json          # SMTP transport per account alias
├── ormconfig.json           # TypeORM connection options (MySQL)
├── passport.json            # OAuth client IDs/secrets (Google, Twitter)
├── redis.json               # Redis connection URL
└── session.json             # Session secret + maxAge
```

All seven files are required — the application will crash at startup if any is missing.

---

## ConfigService

**File:** `src/services/config.service.ts`

`ConfigService` is a TypedI `@Service()` singleton that reads all JSON config files from the `config/` directory at construction time and exposes them through a typed accessor.

### Initialization

```typescript
@Service()
export class ConfigService {
    private _config = new Map<string, any>();

    constructor() {
        this.initialize(path.join(__dirname, '..', '..'));
    }

    public initialize(projectRootPath: string) {
        this._config.set('projectRootPath', projectRootPath);

        const configPath = path.join(this.projectRootPath, 'config');
        fs.readdirSync(configPath).forEach(configFile => {
            if (configFile.endsWith('.json.example') || !configFile.endsWith('.json')) {
                return;
            }
            const config = fs.readFileSync(path.join(configPath, configFile)).toString();
            this._config.set(path.parse(configFile).name, JSON.parse(config));
        });
    }
}
```

Key behavior:

- The constructor resolves the project root as the parent of `src/services/`, so relative paths are calculated from the package root.
- `initialize()` iterates over every file in `config/` synchronously at construction time. It **skips** any file ending with `.json.example` (or that does not end with `.json`).
- Each real `.json` file is read and parsed. The result is stored in a `Map<string, any>` keyed by the filename stem (e.g., `environment.json` becomes key `environment`).

### Public API

| Method/Property | Signature | Returns |
|---|---|---|
| `getConfig<T>(key)` | `(key: string) => T \| undefined` | Typed config object, or `undefined` if the key is not found |
| `projectRootPath` | property getter | Absolute path to the project root, used for resolving relative paths to static files and templates |

### Access Pattern

Inside TypedI-managed classes (services, controllers, middleware decorated with `@Service()`, `@Controller()`, or `@Middleware()`), `ConfigService` is injected via the constructor:

```typescript
constructor(private configService: ConfigService) {}
```

Outside TypedI's container (handlebars helpers, standalone utility functions, middleware registered inline), it is fetched directly:

```typescript
import { Container } from 'typedi';
const configService = Container.get(ConfigService);
```

This dual-access pattern is used in:
- `linkHref.helper.ts` — reads `domains.editor` for URL prefixing
- `scriptTag.helper.ts` / `styleTag.helper.ts` — reads `environment.context` to decide asset cache strategy
- `twitter-login.middleware.ts` — reads `passport.twitter.callbackURL` to override the dynamic callback URL
- `update-authenticated-cookie.ts` — reads `session.maxAge` to set cookie expiry

### Bootstrap Usage

In `src/main.ts`, `ConfigService` is the very first thing retrieved from the container:

```typescript
const configService = Container.get(ConfigService);

const environment = configService.getConfig<any>('environment');
process.env.NODE_ENV = environment.context;

await createConnection(configService.getConfig<ConnectionOptions>('ormconfig'));
```

The `environment.context` value is promoted to `process.env.NODE_ENV` before anything else runs, because several downstream libraries (Express, TypeORM, routing-controllers) inspect this environment variable.

---

## Config Files in Detail

### environment.json

Controls the runtime context and server behavior.

```json
{
    "context": "development",
    "port": 3000,
    "editor": "resources/editor",
    "enableErrorReportsFile": true,
    "sendErrorReportsAsEmail": true,
    "reportErrorLogFile": "report-error-log.txt",
    "adminEmailAddresses": [
        "admin@example.com"
    ]
}
```

| Key | Type | Purpose |
|---|---|---|
| `context` | `string` | Set to `"development"` or `"production"`. Promoted to `process.env.NODE_ENV` at startup. Drives template caching, error verbosity, and asset cache-busting strategy. |
| `port` | `number` | HTTP listen port. |
| `editor` | `string` | Relative path (from project root) to the built editor SPA directory. Served as static files at the editor mount path. |
| `enableErrorReportsFile` | `boolean` | When true, client-submitted error reports are appended to a local log file. |
| `sendErrorReportsAsEmail` | `boolean` | When true, client-submitted error reports are emailed to admin addresses. |
| `reportErrorLogFile` | `string` | Filename for the error report log (relative to the working directory, or absolute). |
| `adminEmailAddresses` | `string[]` | Recipients for emailed error reports. |

**Consumers:**
- `main.ts` — sets `process.env.NODE_ENV`, configures Express `view cache`, passes to `useExpressServer({ development })`
- `ErrorHandlerMiddleware` — checks `context !== 'production'` to include/exclude stack traces in error responses
- `ReportErrorController` — checks `enableErrorReportsFile` and `sendErrorReportsAsEmail` to decide which reporting channels to use
- `scriptTag.helper.ts` / `styleTag.helper.ts` — cache MD5-hashed asset URLs in production, recompute on every request in development

### domains.json

Defines the public-facing URLs used for link generation, CORS, and cookie domains.

```json
{
    "rootUrl": "https://logigator.test",
    "editor": "/editor"
}
```

| Key | Type | Purpose |
|---|---|---|
| `rootUrl` | `string` | The base URL of the entire application (protocol + host, no trailing slash). Used to construct absolute links in emails and hreflang alternates. |
| `editor` | `string` | The URL path prefix where the SPA editor is mounted. Used as the route prefix for editor static files, SPA fallback, and editor share links. |

**Consumers:**
- `main.ts` — mounts editor static files at `domains.editor`, creates a redirect from `/editor/index.html` to `/editor/`, serves the SPA `index.html` as a fallback
- `GlobalViewDataMiddleware` — uses `rootUrl` to construct hreflang alternate links
- `HomeController` — uses `editor` to link to example projects in the editor
- `CommunityController` — uses `editor` to generate `editorUrl` share links for community projects and components
- `UserService` — uses `rootUrl` to construct absolute verification and password-reset links in emails
- `linkHref.helper.ts` — editor URLs are excluded from the language prefix

### ormconfig.json

MySQL connection configuration, passed directly to TypeORM's `createConnection()`.

```json
{
    "type": "mysql",
    "host": "mysql",
    "port": 3306,
    "username": "root",
    "password": "root",
    "database": "logigator",
    "entities": [
        "dist/database/entities/**/*.entity{.ts,.js}"
    ],
    "synchronize": true,
    "logging": true
}
```

| Key | Type | Purpose |
|---|---|---|
| `type` | `string` | Must be `"mysql"`. The TypeORM driver type. |
| `host` | `string` | MySQL hostname. In Docker Compose, this is the service name `mysql`. |
| `port` | `number` | MySQL port (default 3306). |
| `username` | `string` | MySQL user. |
| `password` | `string` | MySQL password. |
| `database` | `string` | MySQL database name. |
| `entities` | `string[]` | Glob patterns for TypeORM entity files. Points to compiled `.js` in `dist/`, with a `.ts` fallback for type-stripping loaders. |
| `synchronize` | `boolean` | When `true`, TypeORM auto-creates database tables on startup. **Should be `false` in production** — use migrations instead. |
| `logging` | `boolean` | When `true`, TypeORM logs all SQL queries. |

Note: The `.example` template includes a `cli.migrationsDir` key for TypeORM's CLI tool, but it is not needed at runtime and is absent from the development config.

**Consumers:**
- `main.ts` — `createConnection(configService.getConfig<ConnectionOptions>('ormconfig'))`

### redis.json

Redis connection URL for session storage.

```json
{
    "url": "redis://redis:6379"
}
```

| Key | Type | Purpose |
|---|---|---|
| `url` | `string` | Redis connection URL (protocol + host + port). In Docker Compose, the host is the service name `redis`. |

**Consumers:**
- `RedisService` — passed directly to `createClient()` (along with `legacyMode: true` for compatibility)
- Session middleware (via `RedisService.redisClient`) — plugged into `connect-redis` as the session store

### session.json

Express session configuration.

```json
{
    "secret": "secret",
    "maxAge": 2592000000
}
```

| Key | Type | Purpose |
|---|---|---|
| `secret` | `string` | Session signing secret. Also used by `cookie-parser` for signed cookies. |
| `maxAge` | `number` | Session max age in milliseconds. `2592000000` = 30 days. Also used as the `isAuthenticated` cookie lifespan. |

**Consumers:**
- `main.ts` — `cookieParser(secret)`, `session({ secret, maxAge })` configuration
- `update-authenticated-cookie.ts` — reads `maxAge` to set the same expiry on the non-HTTP-only `isAuthenticated` cookie (so the client-side JS knows the session state)

### passport.json

OAuth provider credentials for social login.

```json
{
    "google": {
        "clientID": "...",
        "clientSecret": "...",
        "callbackURL": "https://logigator.test/auth/google-authenticate"
    },
    "twitter": {
        "consumerKey": "...",
        "consumerSecret": "...",
        "callbackURL": "https://logigator.test/auth/twitter-authenticate"
    }
}
```

| Key | Sub-keys | Purpose |
|---|---|---|
| `google` | `clientID`, `clientSecret`, `callbackURL` | Google OAuth2 credentials. Passed directly to `new OAuth2Strategy()`. |
| `twitter` | `consumerKey`, `consumerSecret`, `callbackURL` | Twitter OAuth1a credentials. Passed directly to `new TwitterStrategy()`. The `callbackURL` is overridden at request time by `TwitterLoginMiddleware` to preserve the OAuth state parameter. |

**Consumers:**
- `PassportConfigService` — spread via `...this.configService.getConfig('passport').google` and `...this.configService.getConfig('passport').twitter` into their respective strategy constructors

### nodemailer.json

SMTP transport configurations for sending transactional emails. The file uses named account keys, allowing multiple email identities.

```json
{
    "noreply": {
        "from": "Logigator noreply@logigator.com",
        "transport": {
            "host": "mail.smtp2go.com",
            "port": 2525,
            "requireTLS": true,
            "auth": {
                "user": "noreply@logigator.com",
                "pass": "..."
            }
        }
    }
}
```

| Key | Purpose |
|---|---|
| `<account-name>` | Each top-level key is a logical account name. Account `noreply` is the only one used in production. |
| `<account>.from` | The `From` header for emails sent from this account. |
| `<account>.transport` | Nodemailer transport options (host, port, secure/requireTLS, auth). |

**Consumers:**
- `EmailService` — `configService.getConfig('nodemailer')?.[account]` selects the account config, then `createTransport(config.transport)` creates the mailer
- `ReportErrorController` — sends admin error reports via the `noreply` account
- `UserService` — sends verification and password-reset emails via the `noreply` account

---

## Configuration Flow to Framework Setup

### Database (`ormconfig.json`)

```typescript
// main.ts line 59
await createConnection(configService.getConfig<ConnectionOptions>('ormconfig'));
```

The entire `ormconfig.json` object is passed as the `ConnectionOptions` argument to TypeORM's `createConnection()`. TypeORM resolves entity paths, migration paths, and connection parameters from this object.

### Redis (`redis.json`)

```typescript
// RedisService.init() line 14-17
this._redisClient = createClient({
    legacyMode: true,
    ...this.configService.getConfig('redis')
});
```

The `redis.json` content is spread into the `createClient()` options (alongside `legacyMode: true`). The resulting client is used for session storage and for ephemeral data (email verification codes, password reset tokens).

### Session (`session.json`)

```typescript
// main.ts lines 94-104
app.use(cookieParser(configService.getConfig('session').secret));
app.use(session({
    secret: configService.getConfig('session').secret,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy',
    store: new (connectRedis(session))({ client: Container.get(RedisService).redisClient }),
    cookie: {
        maxAge: configService.getConfig('session').maxAge
    }
}));
```

The `secret` signs both Express session cookies and the cookie-parser middleware. `maxAge` controls how long the session persists in Redis. The session store is `connect-redis` backed by `RedisService.redisClient`.

### Authentication (`passport.json`)

```typescript
// PassportConfigService.setupPassport()
this.setupGoogle();  // new OAuth2Strategy({...configService.getConfig('passport').google, ...})
this.setupTwitter(); // new TwitterStrategy({...configService.getConfig('passport').twitter, ...})
this.setupLocal();
this.setupSessions();
```

Both OAuth strategy constructors spread their respective config sections. The `callbackURL` fields must match the URLs registered in the Google Cloud Console and Twitter Developer Portal respectively.

### Email (`nodemailer.json`)

```typescript
// EmailService.sendMail()
const config = this.configService.getConfig('nodemailer')?.[account];
const mailTransport = createTransport({ ...config.transport, ... });
```

The account key (e.g., `noreply`) selects which transport configuration to use. The transport object is passed directly to nodemailer's `createTransport()`.

### Environment-Determined Behavior

The `environment.context` value (either `"development"` or `"production"`) drives several behavioral differences throughout the application:

| Behavior | Development | Production |
|---|---|---|
| `process.env.NODE_ENV` | `"development"` | `"production"` |
| Express view cache | `false` (templates re-read from disk on every render) | `true` (templates cached in memory) |
| Error handler stack traces | Included in JSON and HTML error responses | Stripped |
| Error handler JSON formatting | Pretty-printed with `JSON.stringify(value, null, 2)` | Compact `JSON.stringify(value)` |
| Asset cache-busting | MD5 hash computed on every request | MD5 hash computed once and cached |
| `routing-controllers` development mode | `true` (verbose internal error details) | `false` |

This is set in `main.ts` lines 63-66:

```typescript
if (environment.context === 'production') {
    app.set('env', 'production');
    app.set('view cache', true);
}
```

And checked in several places:

```typescript
// ErrorHandlerMiddleware
if (this._appContext !== 'production') {
    errorResponse.error.stack = error.stack;
}

// scriptTag.helper.ts
if (appContext === 'production') {
    // read from cache
} else {
    // compute MD5 every time
}
```

---

## How to Add a New Config File

1. Create the config interface or a simple inline type annotation where the config will be consumed.
2. Create `<name>.json.example` with placeholder values and commit it to git.
3. Add `<name>.json` to the real config directory (it is already covered by the `/config/*.json` gitignore pattern).
4. Read it in code via `configService.getConfig('<name>')`.
5. No registration step is needed — `ConfigService.initialize()` automatically picks up any `.json` file in the `config/` directory (skipping `.example` files).

---

## Non-Obvious Patterns

- **Config is loaded synchronously at construction time.** `fs.readdirSync` and `fs.readFileSync` are used in the constructor, so all config is available before any async initialization runs. If a config file is missing or contains invalid JSON, the process crashes immediately with a clear error.

- **`getConfig<T>` returns `undefined` for missing keys**, not throws. Callers should handle this (or ensure the config exists). The `PassportConfigService` would crash with a confusing `Cannot read properties of undefined` if `passport.json` were missing.

- **`Container.get(ConfigService)` at module load time** is used in handlebars helpers and standalone functions. This works because `ConfigService` is loaded and initialized during `main.ts`'s synchronous bootstrap phase, before any module-level code in those helpers runs. However, if the helpers were imported before `ConfigService` was constructed, the `Container.get()` call would fail — this ordering dependency is managed by the single entry-point in `main.ts`.

- **`environment.json` is read twice conceptually** — once to set `process.env.NODE_ENV`, and thereafter via `configService.getConfig('environment')` throughout the codebase. The `process.env` value is used by Express and TypeORM internals; the `configService` value is used by application code.

- **`session.json.example` contains a `//` comment.** JSON does not support comments. This comment is safe because `.example` files are never parsed — only real `.json` files are. If a deployer accidentally removes `.example` from the filename without removing the comment, the application will crash with a `JSON.parse` error.

- **The `domains.editor` path is both a URL path prefix and a filesystem path prefix.** It is used as an Express route mount path (e.g., `app.use('/editor', expressStatic(...))`) and appended to `projectRootPath` to locate the editor build directory. The same value appears in both contexts, so it must not contain a trailing slash or double-slashes will result.

- **`projectRootPath` is stored as a string in the `_config` map** (keyed as `'projectRootPath'`), not as a separate field. The `get projectRootPath()` getter retrieves it from the map, keeping the internal data structure uniform.
