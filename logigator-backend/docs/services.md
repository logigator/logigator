# Services

The backend uses **TypeDI** (`typedi`) for dependency injection. Each service is decorated with `@Service()` and becomes a singleton in the TypeDI container. Services declare their dependencies through constructor parameters — TypeDI resolves them automatically.

## Directory Layout

```
src/services/
├── config.service.ts           # File-based config reader
├── redis.service.ts            # Redis v4 client wrapper
├── caching.service.ts          # Redis-based cache with prefixed keys
├── translation.service.ts      # i18n dot-notation lookups
├── email.service.ts            # Nodemailer transport
├── passport-config.service.ts  # Passport.js strategy setup
├── user.service.ts             # User CRUD, auth, verification
├── share-cloning.service.ts    # Atomic project/component cloning
└── standalone-view.service.ts  # Handlebars email template rendering
```

---

## `@Service()` Decorator Pattern

Every service in this directory is decorated with `@Service()` from the `typedi` package. This registers the class as a **singleton** in TypeDI's global container.

Constructor-based injection is automatic:

```typescript
@Service()
export class RedisService {
    constructor(private configService: ConfigService) {}
}
```

No manual wiring or module registration is needed. The `ConfigService` is instantiated first (it has no service dependencies), and all downstream services receive it via the constructor.

Services that need TypeORM repositories use the `@InjectRepository()` decorator from `typeorm-typedi-extensions`, which bridges TypeDI and TypeORM's repository pattern:

```typescript
@Service()
export class UserService {
    constructor(
        @InjectRepository() private userRepo: UserRepository,
        private emailService: EmailService
    ) {}
}
```

TypeDI's container is bootstrapped in `src/main.ts` before anything else runs:

```typescript
useContainerRC(Container);       // routing-controllers
typeOrmUseContainer(Container);  // TypeORM
classValidatorUseContainer(Container);  // class-validator
```

---

## ConfigService

**File:** `src/services/config.service.ts`

Reads all `.json` files from the `config/` directory at construction time and serves them by filename stem.

### Construction and Initialization

The constructor calls `this.initialize()` with the project root path, which is derived from `__dirname` (two levels up — from `src/services/` to the project root):

```typescript
constructor() {
    this.initialize(path.join(__dirname, '..', '..'));
}
```

During `initialize()`, it scans every file in `<projectRoot>/config/`. Files that end with `.json.example` are **skipped**. Any file ending in `.json` is read, parsed, and stored in an internal `Map<string, any>` keyed by its filename stem (the filename without extension):

```typescript
const configPath = path.join(this.projectRootPath, 'config');
fs.readdirSync(configPath).forEach(configFile => {
    if (configFile.endsWith('.json.example') || !configFile.endsWith('.json')) {
        return;
    }
    const config = fs.readFileSync(path.join(configPath, configFile)).toString();
    this._config.set(path.parse(configFile).name, JSON.parse(config));
});
```

The `initialize()` method is also called from tests that need to point the config reader at a different root.

### Available Config Files

The `config/` directory currently contains these non-example JSON files (each read into its own key):

| Key              | Config File            | Purpose                                        |
|------------------|------------------------|-------------------------------------------------|
| `environment`    | `environment.json`     | Runtime context, port, editor path, error settings |
| `redis`          | `redis.json`           | Redis connection URL                            |
| `ormconfig`      | `ormconfig.json`       | TypeORM connection options                      |
| `session`        | `session.json`         | Express session secret and maxAge               |
| `passport`       | `passport.json`        | OAuth client IDs/secrets (Google, Twitter)      |
| `nodemailer`     | `nodemailer.json`      | Per-account email transport configs             |
| `domains`        | `domains.json`         | Root URL and editor URL                         |

### Usage

```typescript
// Typed access
const env = configService.getConfig<any>('environment');
const redisUrl = configService.getConfig<{url: string}>('redis');

// Generic access
const someConfig = configService.getConfig('someKey'); // returns any
```

When the key does not exist in the map, `getConfig` returns `undefined`.

### NODE_ENV Side Effect

In `src/main.ts`, the environment config is read and written to `process.env.NODE_ENV` before anything else initializes:

```typescript
const environment = configService.getConfig<any>('environment');
process.env.NODE_ENV = environment.context;
```

This lets downstream code (Express, TypeORM, etc.) behave differently based on the environment. The `environment.context` value (e.g., `"development"`, `"production"`) is also used to enable view caching in production and set Express's `env` property.

### `projectRootPath` Getter

A convenience getter returns the project root path that was stored during initialization. Other services (e.g., `StandaloneViewService`) use it to locate template files relative to the project root.

---

## RedisService

**File:** `src/services/redis.service.ts`

Wraps the `redis` v4 client with typed convenience methods. Uses **legacy mode** to maintain compatibility with the `connect-redis` session store (which expects the v3/v4 lower-level API).

### Client Creation

The client is created with `legacyMode: true` and the connection options from `config/redis.json`:

```typescript
this._redisClient = createClient({
    legacyMode: true,
    ...this.configService.getConfig('redis')
});
await this._redisClient.connect();
```

### Methods

All instance methods delegate to `this.redisClient.v4` — the v4-native promise-based API that coexists alongside the legacy API when `legacyMode` is enabled:

| Method                         | Redis Command      | Notes                                        |
|--------------------------------|--------------------|----------------------------------------------|
| `has(key)`                     | `EXISTS`           | Returns `Promise<boolean>`                   |
| `delete(key)`                  | `DEL`              | Returns `Promise<void>`                      |
| `ttl(key)`                     | `TTL`              | Returns `Promise<number>` (seconds remaining)|
| `setString(key, value, expire)`| `SET EX`           | String value with TTL in seconds             |
| `getString(key)`               | `GET`              | Returns `Promise<string \| null>`            |
| `setObject(key, value, expire)`| `HSET` + `EXPIRE`  | Hash object, then sets TTL independently     |
| `getObject(key)`               | `HGETALL`          | Returns `Promise<Record<string, string>>`    |

The `redisClient` getter exposes the underlying client for direct use (e.g., by the session store in `main.ts`).

### Error Handling

The service itself does **not** wrap calls in try/catch — errors propagate to the caller. Connection-level error handling is the responsibility of the `redis` client's own event handlers or the application-level error boundary.

### Usage in Session Store

In `src/main.ts`, the underlying `redisClient` is plugged into the `connect-redis` session store:

```typescript
app.use(session({
    store: new (connectRedis(session))({ client: Container.get(RedisService).redisClient }),
    ...
}));
```

---

## CachingService

**File:** `src/services/caching.service.ts`

Wraps `RedisService` with a `cache:` key prefix. All keys are automatically prefixed with `cache:`, creating a dedicated namespace in Redis that won't collide with other Redis consumers (session data, verification tokens, password reset tokens).

### Methods

| Method                           | Delegates To     | Transformed Key          |
|----------------------------------|------------------|--------------------------|
| `has(key)`                       | `redis.has()`    | `cache:` + key           |
| `get(key)`                       | `redis.getString()`| `cache:` + key          |
| `set(key, value, expire)`        | `redis.setString()`| `cache:` + key          |
| `delete(key)`                    | `redis.delete()` | `cache:` + key           |
| `ttl(key)`                       | `redis.ttl()`    | `cache:` + key           |
| `clear()`                        | N/A              | All keys matching `cache:*` |

### `clear()` Implementation

Iterates over all keys matching the `cache:*` pattern and deletes each one individually. There is no `FLUSHDB` or `UNLINK` — it uses `DEL` per key:

```typescript
public async clear(): Promise<void> {
    const keys = await this.redis.redisClient.keys(this.PREFIX + '*');
    for (const key of keys) {
        await this.redis.delete(key);
    }
}
```

This is safe for the expected cardinality of cached keys (tens to low hundreds). It would be slow with very large numbers of keys.

---

## TranslationService

**File:** `src/services/translation.service.ts`

Provides dot-notation string lookups into a nested translation object, plus locale-aware date formatting.

### Setup

Translation data is imported from `src/i18n/index.ts`, which aggregates language modules for English, German, Spanish, and French:

```typescript
import { en } from './en';
import { es } from './es';
import { de } from './de';
import { fr } from './fr';

export const availableLanguages = ['en', 'de', 'es', 'fr'] as const;
export const defaultLanguage: LanguageCode = 'en';
export const translations: Record<LanguageCode, ILanguage> = { en, de, es, fr };
```

The `LanguageCode` type is a union of the `availableLanguages` array values (`'en' | 'de' | 'es' | 'fr'`).

### `getTranslation(key, lang)`

Walks a dot-separated path through the nested translation object. If the language is not available, it falls back to `defaultLanguage` (`en`). If any segment of the path is missing, the raw `key` string is returned as the fallback:

```typescript
getTranslation('MAILS.VERIFY_MAIL_REGISTER.SUBJECT', 'de')
// -> translations['de']['MAILS']['VERIFY_MAIL_REGISTER']['SUBJECT']
```

The return value must be a string — if the resolved path leads to an object (i.e., the caller stopped too early), the raw key is returned instead.

### `getTranslations(lang)`

Returns the entire translation object for the given language. This is used by `StandaloneViewService` to pass all translations into Handlebars templates as the `i18n` variable.

### Date Formatting Methods

Three methods provide locale-aware date formatting for the supported languages:

- **`dateFormatTime(date, lang)`** — Returns time in `HH:mm` (24-hour for German, 12-hour with AM/PM for English, locale-default for others).
- **`dateFormatDate(date, lang)`** — Returns date in the locale's short format. German gets an explicit `day: 'numeric', month: 'short', year: 'numeric'` format.
- **`dateFormatDateTime(date, lang)`** — Returns combined date+time. English gets an explicit `en` locale call with numeric day/month and 12-hour time. German gets `de` locale with explicit 24-hour time and short month name.

All three accept both `Date` objects and ISO string inputs, converting strings to `Date` via `new Date(date)`.

---

## EmailService

**File:** `src/services/email.service.ts`

Sends transactional emails using **nodemailer**. The transport configuration is read from `config/nodemailer.json`, which contains per-account configuration objects.

### Per-Account Transport

The `nodemailer.json` config is keyed by account name. The `sendMail` method receives an `account` string (e.g., `'noreply'`) and looks up the corresponding config:

```typescript
const config = this.configService.getConfig('nodemailer')?.[account];
if (!config) {
    throw new Error('No Nodemailer config found for this account!');
}
```

Each account config has:
- `transport` — the nodemailer transport options object (`host`, `port`, `auth`, etc.)
- `from` — the sender address string

### Fresh Transport Per Send

A new nodemailer transport is created for every `sendMail` call:

```typescript
const mailTransport = createTransport({
    ...config.transport,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});
await mailTransport.verify();   // throws if connection fails
await mailTransport.sendMail({...});
mailTransport.close();
```

The transport is verified before sending, then closed after. This means every email incurs a new SMTP connection — there is no connection pooling or reuse.

### Signature

```typescript
sendMail(
    account: string,
    recipients: string[] | string,
    subject: string,
    htmlContent: string,
    attachments?: Attachment[]
): Promise<void>
```

The `attachments` parameter uses the `Attachment` type from `nodemailer/lib/mailer`. The email body is HTML only — there is no plain-text fallback generation.

EmailService is consumed exclusively by `UserService` through the `StandaloneViewService` pipeline: `UserService` renders a Handlebars template via `StandaloneViewService`, then passes the resulting HTML to `EmailService.sendMail`.

---

## PassportConfigService

**File:** `src/services/passport-config.service.ts`

Configures three Passport.js authentication strategies and session serialize/deserialize. Called once during application startup:

```typescript
Container.get(PassportConfigService).setupPassport();
```

### Strategy 1: Google OAuth2

Uses `passport-google-oauth`'s `OAuth2Strategy`. The client ID, secret, and callback URL are read from `config/passport.json` under the `google` key.

The strategy callback handles two distinct flows:

**Login flow** (user is not authenticated):
- Searches for an existing user by `googleUserId` via `userService.findOrCreateGoogleUser`.
- If the Google email is already taken by another account, throws an `'emailTaken'` error.
- Creates a new user if none exists, setting `googleUserId`, `email`, `username` (from `profile.displayName`), and profile picture.

**Account-connection flow** (user is already authenticated):
- Calls `userService.connectGoogle(request.user, profile)`.
- On success passes `{connectedAccounts: true}` as the `info` parameter.
- On failure throws a `FormDataError` for the account security page.

### Strategy 2: Twitter

Uses `passport-twitter`'s `Strategy`. Configuration comes from `config/passport.json` under the `twitter` key.

Behavior is identical to the Google strategy in structure, but uses Twitter-specific profile fields and the `connectTwitter` method on `UserService`. Additional options force login re-authorization:

```typescript
forceLogin: true,
userAuthorizationURL: 'https://api.twitter.com/oauth/authenticate?force_login=true',
includeEmail: true
```

### Strategy 3: Local

Uses `passport-local`'s `Strategy` with the email field mapped to `usernameField`:

```typescript
new LocalStrategy({
    passwordField: 'password',
    usernameField: 'email'
}, async (email, password, done) => {
    const user = await this.userService.validateLocalUser(email, password);
    done(null, user);
})
```

### Session Serialize/Deserialize

```typescript
passport.serializeUser((user: User, done) => {
    done(null, user.id);   // stores only the user ID in the session
});
passport.deserializeUser(async (req: Request, id: string, done) => {
    const user = await this.userRepo.findOne(id);
    if (user === undefined) {
        // User was deleted while session was active — logout and redirect
        req.logout(err => console.error(err));
        updateAuthenticatedCookie(req, req.res, false);
        return redirect(req, req.res, {target: '/'});
    }
    done(null, user);
});
```

The `deserializeUser` callback receives the Express `Request` object (enabled by passing `passReqToCallback: true` in the strategy options). It handles the stale-session case: if the user was deleted from the database, it logs out the session and redirects to the home page.

### State Parameter for Flow Disambiguation

The OAuth strategies use the `state` query parameter (set by the initiating route, e.g., `/auth/google-login?state=/login`) to distinguish login from registration from account connection. The `getOauthErrorFormName` method maps the state value to a Handlebars template/form name for error display:

| State Value           | Form Name                       |
|-----------------------|---------------------------------|
| `/login`              | `auth_local-login-page`         |
| `/login-electron`     | `auth_local-login-electron`     |
| `/register`           | `auth_local-register-page`      |
| (anything else)       | `auth_local-login`              |

---

## UserService

**File:** `src/services/user.service.ts`

The largest service, handling user creation, authentication, email verification, password management, social account linking, and account deletion.

### Constructor Dependencies

```typescript
constructor(
    @InjectRepository() private userRepo: UserRepository,
    @InjectRepository() private profilePictureRepo: ProfilePictureRepository,
    private emailService: EmailService,
    private standaloneViewService: StandaloneViewService,
    private configService: ConfigService,
    private translationService: TranslationService,
    private redisService: RedisService
)
```

### Local User Creation (`createLocalUser`)

1. Checks for an existing user with the same email — returns `false` if found.
2. Creates a new `User` entity with `bcrypt`-hashed password (`9` salt rounds).
3. Sets `localEmailVerified = false`.
4. Generates an email verification code (stored in Redis as `verify-mail:<code>` with 1-hour TTL) containing `userId` and `email`.
5. Sends a verification email via `StandaloneViewService.renderView('verification-mail-register', ...)` + `EmailService.sendMail`.
6. If the email send fails (network error, invalid SMTP), the error is caught, logged, and re-thrown as `'verification_mail'`. The user **is** saved at this point but their email is unverified.

### Email Verification (`verifyEmail`)

1. Reads the verification data from Redis at `verify-mail:<code>`.
2. If the key does not exist (expired or invalid), throws `'verification_timeout'`.
3. Looks up the user by `userId`. If not found, throws `'no_user'`.
4. Updates the user's email, sets `localEmailVerified = true`, deletes the Redis key, and saves.

This means the email stored during verification may differ from the one originally registered — the verification code stores the `emailToVerify`, so email-change flows reuse the same mechanism.

### Password Reset (`sendResetPasswordMail` / `updatePasswordWithToken`)

The reset flow:
1. `sendResetPasswordMail(email, lang)` — looks up the user by email, generates a token stored in Redis as `reset-password:<token>` (1-hour TTL), renders the `reset-password-mail` Handlebars template, and sends it via email.
2. `updatePasswordWithToken(token, newPassword)` — reads the token from Redis, looks up the user, hashes the new password, saves, and deletes the Redis key.
3. `updatePassword(user, newPassword, currentPassword?)` — for authenticated password changes (user is already logged in). If the user has a local password, `currentPassword` is required and verified against the stored hash.

### Social Account Connection

- **`connectGoogle(user, profile)`** — sets `user.googleUserId = profile.id` and saves. Throws `'Already Connected'` if the user already has a `googleUserId`.
- **`connectTwitter(user, profile)`** — same pattern for `twitterUserId`.
- **`findOrCreateGoogleUser(profile)` / `findOrCreateTwitterUser(profile)`** — used by the OAuth login flow. Searches by the provider's user ID; if found, returns the existing user. If not found, checks if the email is already taken (throws `'emailTaken'` if so), then creates a new user with the provider's profile data (display name, email, profile picture imported via `profilePictureRepo.importFromUrl`).

### Account Deletion (`remove` / `removeTransaction`)

Account deletion is a two-step process:
1. `remove(user, password)` — verifies the password (if the user has a local password), then calls the transactional cleanup and removes the user.
2. `removeTransaction` — decorated with `@Transaction()`, receiving transaction-aware repositories. This method:
   - Finds and removes all components owned by the user.
   - Finds and removes all projects owned by the user.
   - Removes the user's profile picture (if any).

The `@Transaction()` decorator comes from TypeORM and ensures all deletions succeed or fail atomically.

### Password Validation (`validateLocalUser`)

Used by the `LocalStrategy` in `PassportConfigService`. Checks three conditions in order:
1. User exists and has a password (throws `'noUser'` form error on `email` field).
2. Password matches the bcrypt hash (throws `'invalid'` form error on `password` field).
3. Email is verified (throws `'notVerified'` form error on `email` field).

All errors are `FormDataError` instances with field-specific targeting and form names, which the `formErrorMiddleware` in controllers can catch and re-render with error messages.

---

## ShareCloningService

**File:** `src/services/share-cloning.service.ts`

Handles the atomic cloning of shared projects and components — the core of the "remix" / "fork" feature. Both cloning operations run inside `@Transaction()` boundaries.

### Dependency Collection

A shared project or component may depend on components (sub-circuits used as building blocks). Before cloning, the caller must pass pre-collected dependencies. The repositories expose `getDependencies(entity, recursive)` methods that walk the dependency graph:

```typescript
// For projects:
const dependencies = await this.projectDepRepo.getDependencies(project, true);

// For components:
const dependencies = await this.compDepRepo.getDependencies(component, true);
```

### cloneProject(link, currentUser)

1. Looks up the `Project` by its public `link`. Throws `NotFoundError` if missing.
2. Collects all component dependencies recursively.
3. Calls `cloneProjectTransaction`, which:

**Step 1 — Clone each dependency** using `compRepo.clone()`, building a `Map<oldId, clonedComponent>`:

```typescript
const map = new Map<string, Component>();
for (const dep of dependencies) {
    map.set(dep.id, await compRepo.clone(dep, user));
}
```

**Step 2 — Rewire dependencies.** For each cloned component, reads the original dependency edges and replaces old IDs with new ones from the map:

```typescript
for (const comp of map) {
    const deps = (await compDepRepo.find({ where: { dependent: comp[0] } }))
        .map(x => {
            const dep = compDepRepo.create();
            dep.dependency = map.get(x.dependency.id);
            dep.model_id = x.model_id;
            return dep;
        });
    comp[1].dependencies = Promise.resolve(deps);
    await compRepo.save(comp[1]);
}
```

**Step 3 — Create the cloned project.** Copies name, description, creation date, and the `elementsFile` (circuit data blob). Sets `forkedFrom` to the original project. Rewires project-level dependencies using the same map:

```typescript
const cloned = projRepo.create();
cloned.name = project.name;
cloned.description = project.description;
cloned.user = Promise.resolve(user);
cloned.forkedFrom = Promise.resolve(project);
cloned.createdOn = project.createdOn;
cloned.elementsFile = new ProjectFile();
if (project.elementsFile)
    cloned.elementsFile.setFileContent(await project.elementsFile.getFileContent());
```

### cloneComponent(link, currentUser)

Same pattern as `cloneProject` but returns a flat array of cloned `Component` entities (the root component plus its dependencies):

```typescript
const clonedProjects = await this.cloneComponentTransaction([component, ...dependencies], currentUser);
return Array.from(clonedProjects.values());
```

The `cloneComponentTransaction` method follows the same two steps as the project version (clone dependencies, then rewire), but does not create a `Project` entity — it only clones components.

### Dependency Rewiring

Both transaction methods share the same rewiring pattern. The dependency entities (`ProjectDependency` / `ComponentDependency`) have:
- `dependent` — the entity that depends on something
- `dependency` — the entity being depended upon
- `model_id` — identifies which "slot" in the dependent uses this dependency (relevant for multi-input sub-circuit references)

The map lookup converts each original `x.dependency.id` to the newly cloned component's ID, so the cloned project references the cloned dependencies rather than the originals.

### `forkedFrom` Chain

When a project is cloned, the `forkedFrom` relation is set to the original project (a TypeORM lazy relation: `forkedFrom: Promise<Project>`). This creates a chain: if A is cloned from the original, and B is cloned from A, then `B.forkedFrom` points to A. Currently **not** set on cloned components — only on projects.

---

## StandaloneViewService

**File:** `src/services/standalone-view.service.ts`

Renders standalone Handlebars templates (not page layouts) for use in email bodies. The rendered output is pure HTML — there is no layout wrapper, no site chrome, no header/footer.

### Template Location

Templates live in `resources/private/templates/standalone/` and are `.hbs` files. The directory path is resolved at construction time from the `ConfigService`'s `projectRootPath`:

```typescript
this.VIEW_DIR = path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'standalone');
```

### Template Compilation and Caching

Templates are compiled with `Handlebars.compile()` on first access and cached in an in-memory `Map<string, HandlebarsTemplateDelegate>`:

```typescript
if (this._viewCache.has(view)) {
    template = this._viewCache.get(view);
} else {
    const viewFile = (await fs.readFile(path.join(this.VIEW_DIR, `${view}.hbs`))).toString();
    template = compile(viewFile);
    this._viewCache.set(view, template);
}
```

The cache persists for the lifetime of the application. There is no cache invalidation or file-watching. Template files are read from disk using `fs.promises.readFile` (async).

### Data Merging with i18n

The `renderView` method merges the caller's data with the full translations object for the requested language, so all templates have access to translated strings as `{{i18n.SOME_KEY}}`:

```typescript
return template({
    ...data,
    i18n: this.translationService.getTranslations(lang)
}, {
    helpers: handlebarsHelpers
});
```

### Templates Used

Based on the codebase, the following templates are rendered through this service:

| Template Name                      | Used By                              | Data Variables                          |
|------------------------------------|--------------------------------------|----------------------------------------|
| `verification-mail-register`       | `UserService.createLocalUser`        | `username`, `verifyLink`               |
| `verification-mail-email-update`   | `UserService.updateEmail`            | `username`, `verifyLink`               |
| `reset-password-mail`              | `UserService.sendResetPasswordMail`  | `username`, `resetLink`                |

### Handlebars Helpers

Templates have access to the full set of `handlebarsHelpers` (from `src/handlebars-helper/helpers.ts`), which includes helpers for concatenation, date formatting, expressions, ternary conditions, string formatting, script/style tag injection, and link href generation. These are the same helpers available to page templates and partials.

---

## Non-Obvious Patterns

### 1. ConfigService Reads Synchronously, Serves Imports Transitively

`ConfigService` performs synchronous filesystem reads (`fs.readdirSync`, `fs.readFileSync`) during construction. This is safe because `ConfigService` has no async dependencies and is instantiated before the server starts listening. Every other service that needs configuration (Redis URL, passport keys, nodemailer creds, domains, etc.) receives them through `ConfigService` rather than reading config files directly.

### 2. `NODE_ENV` Is Set After ConfigService but Before Everything Else

In `main.ts`, the environment context is read from the config JSON before TypeORM connects, before the Express app is configured, and before any middleware is registered. This ensures that framework-level behavior (Express view caching, TypeORM logging, etc.) respects the deployment environment from the very first line of initialization.

### 3. Redis Legacy Mode for Dual API

The redis client is created with `legacyMode: true`, which means both the v3 callback-based API (`this.redisClient.get(...)`) and the v4 promise-based API (`this.redisClient.v4.get(...)`) are available. The `RedisService` methods use the v4 API internally. The session store (`connect-redis`) uses the legacy API on the same client. This dual-access pattern avoids needing two separate Redis connections.

### 4. `setObject` TTL Is Set Separately

In `RedisService.setObject`, the `HSET` and `EXPIRE` commands are sent as two separate calls rather than using the `EX` option that `SET` supports. This is because Redis does not support `EX` for hash set operations. The TTL is set independently, and there is a small race window between `HSET` and `EXPIRE` where the key exists without a TTL.

### 5. CachingService `clear()` Uses `keys` + `del` — Dangerous at Scale

The `clear()` method uses `redis.redisClient.keys(this.PREFIX + '*')` which blocks Redis while scanning every key. For the expected use case (a small number of cached keys), this is acceptable. In production with thousands of cached keys, this would block the event loop. A production-safe alternative would use `SCAN` with cursor iteration or the `UNLINK` command.

### 6. EmailService Creates a Fresh SMTP Connection per Send

Every `sendMail` call creates a new `nodemailer` transport, verifies the connection, sends the email, and closes the transport. There is no connection pooling or keep-alive. This is a deliberate trade-off — it avoids the complexity of managing persistent SMTP connections across emails that are sent infrequently (verification emails, password resets). However, it means each email incurs the overhead of a full SMTP handshake (TCP connect, TLS negotiation, EHLO, AUTH).

### 7. Token Generation via `generateToken()` — Externally Managed

Both email verification and password reset tokens are created by `generateToken()` (from `src/functions/generate-token.ts`), stored in Redis with a 1-hour TTL as hash objects. The token is the Redis key, and the associated data (userId, email) is stored as hash fields. Token validation is a simple Redis lookup — no database query is needed to find the token, only to load the referenced user.

Storing the token in Redis rather than the database means:
- Tokens auto-expire (no cleanup job needed).
- Token lookup is O(1) with no database index needed.
- A stolen token can only be used for the token's remaining TTL.
- All token state is lost on Redis restart, requiring users to request new tokens.

### 8. `@Transaction()` with Optional Repository Parameters

Both `UserService.removeTransaction` and the `ShareCloningService` transaction methods use TypeORM's `@Transaction()` decorator with `@TransactionRepository()` parameters. These repositories are **injected only when the method is called through the decorator's proxy** — they are not available in the constructor. This is a non-obvious TypeORM/typedi pattern:

```typescript
@Transaction()
private async removeTransaction(
    user: User,
    @TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
    @TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
    ...
) {}
```

The transaction uses its own database connection (from the connection pool) and all operations within it either commit together or roll back together. The method is `private` because it should only be called internally (never from a controller).

### 9. StandaloneViewService's In-Memory Cache Is Permanent

Template delegates are cached in a `Map` for the lifetime of the process. There is no cache invalidation — if template files change while the server is running, the changes will not be picked up until the server restarts. This is consistent with the production-oriented design (re-reading templates per-request would be wasteful), but means template changes in development require a server restart. The `projectRootPath` is also fixed at construction time and cannot be changed.

### 10. Passport Deserialization Handles Deleted Users Gracefully

When `deserializeUser` fails to find the user in the database (e.g., the account was deleted while the session was active), it explicitly logs the user out, clears the authenticated cookie, and redirects to the home page. Without this guard, a deleted user would remain "stuck" in a session that references a nonexistent database record, causing errors on every request.
