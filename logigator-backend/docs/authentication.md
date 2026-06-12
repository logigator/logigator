# Authentication System

The backend supports three authentication strategies (local email/password, Google OAuth2, and Twitter OAuth) via **Passport.js**, with sessions stored in **Redis** via `connect-redis`. A lightweight **isAuthenticated cookie** (non-httpOnly) signals auth state to client-side JavaScript without requiring an API call.

---

## Architecture Overview

```
                        ┌─────────────────────────────┐
                        │       Express Session        │
                        │   (connect-redis + Redis)    │
                        └──────────┬──────────────────┘
                                   │ deserializeUser
                        ┌──────────▼──────────────────┐
                        │      Passport.js             │
                        │  ┌──────┬───────┬────────┐   │
                        │  │Local │Google │ Twitter│   │
                        │  └──────┴───────┴────────┘   │
                        └──────────┬──────────────────┘
                                   │ req.user
                        ┌──────────▼──────────────────┐
                        │    routing-controllers        │
                        │   @CurrentUser() injection   │
                        │   guards (API + Frontend)    │
                        └─────────────────────────────┘
```

The auth pipeline for every request:

1. **Cookie parser** reads the session cookie.
2. **Express-session** + **connect-redis** loads the session from Redis.
3. **Passport session middleware** calls `deserializeUser` to load the `User` entity from the database and attach it to `req.user`.
4. **UserDataMiddleware** copies `isAuthenticated` and user profile data to `res.locals` for Handlebars templates.
5. Route-level middleware (guards, OAuth handlers) run before the controller action.

---

## Directory Layout

```
src/
├── main.ts                                          # Session + Passport setup
├── functions/
│   ├── update-authenticated-cookie.ts               # isAuthenticated cookie helper
│   ├── generate-token.ts                             # Cryptographically random token
│   ├── redirect.ts                                   # Redirect helper (used by auth flows)
├── services/
│   ├── passport-config.service.ts                    # Strategy registration + serialize/deserialize
│   ├── user.service.ts                               # User CRUD, password hashing, social connect
│   ├── redis.service.ts                              # Redis client (sessions + verification tokens)
│   ├── config.service.ts                             # Reads JSON config files
│   └── email.service.ts                              # Transactional email sending
├── middleware/
│   └── auth/
│       ├── api-guards/
│       │   ├── check-authenticated-api.middleware.ts
│       │   └── check-not-authenticated-api.middleware.ts
│       ├── frontend-guards/
│       │   ├── check-authenticated-front.middleware.ts
│       │   └── check-not-authenticated-front.middleware.ts
│       ├── google-login.middleware.ts
│       ├── google-authentication.middleware.ts
│       ├── twitter-login.middleware.ts
│       ├── twitter-authentication.middleware.ts
│       └── local-authentication.middleware.ts
├── controller/
│   ├── frontend/
│   │   ├── auth.controller.ts                        # POST /auth/* and GET /auth/* (OAuth, logout)
│   │   ├── auth-pages.controller.ts                  # GET /login, /register, /reset-password, /login-electron
│   │   └── verify-email.controller.ts                # GET /verify-email/:authCode
│   └── api/
│       └── user.controller.ts                        # GET/PATCH /api/user
├── models/request/frontend/auth/
│   ├── local-login.ts                                # validated login body
│   ├── local-register.ts                             # validated registration body
│   ├── resend-verification-mail.ts                   # validated resend body
│   ├── reset-password.ts                             # validated password reset body
│   └── send-password-reset-mail.ts                   # validated forgot-password body
└── database/entities/
    └── user.entity.ts                                # User entity with dual-strategy columns
```

---

## 1. Session Configuration

Session setup lives in `src/main.ts` (lines 94-107):

```typescript
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
Container.get(PassportConfigService).setupPassport();
app.use(passport.initialize());
app.use(passport.session());
```

Key properties:

| Setting               | Value                     | Purpose                                            |
|-----------------------|---------------------------|----------------------------------------------------|
| `secret`              | From config file          | Cookie signing secret (also used for cookieParser) |
| `resave`              | `false`                   | Don't save session if unmodified                   |
| `saveUninitialized`   | `false`                   | Don't create session for unauthenticated visitors  |
| `unset`               | `'destroy'`               | Destroy session store entry on `req.session = null`|
| `store`               | `connect-redis`           | Redis-backed session store                         |
| `cookie.maxAge`       | From config file          | Session TTL (same value used for isAuthenticated)  |

The `cookieParser` middleware is initialized **before** the session middleware because `express-session` relies on the parsed cookie. The same secret is passed to both.

The session is stored in Redis. On every subsequent request from the same browser:
1. Express reads the session cookie (`connect.sid` by default) from the request.
2. `connect-redis` fetches the session data from Redis.
3. Passport session middleware deserializes the user (see below).

### Serialization / Deserialization

Defined in `PassportConfigService.setupSessions()`:

**Serialize** — called when a user logs in, stores only the user ID in the session:

```typescript
passport.serializeUser((user: User, done) => {
    done(null, user.id);
});
```

**Deserialize** — called on every request that has a session, loads the full `User` entity:

```typescript
passport.deserializeUser(async (req: Request, id: string, done) => {
    const user = await this.userRepo.findOne(id);
    if (user === undefined) {
        req.logout(err => console.error(err));
        updateAuthenticatedCookie(req, req.res, false);
        return redirect(req, req.res, {target: '/'});
    }
    done(null, user);
});
```

If the user is no longer in the database (deleted account), deserializeUser destroys the session, clears the isAuthenticated cookie, and redirects to `/`.

---

## 2. The isAuthenticated Cookie Pattern

**`src/functions/update-authenticated-cookie.ts`** manages a non-httpOnly cookie that tells client-side JavaScript whether the user is authenticated — without requiring an API call:

```typescript
const sessionMaxAge: number = Container.get(ConfigService).getConfig('session').maxAge;

export function updateAuthenticatedCookie(request: Request, response: Response, isAuthenticated: boolean) {
    request.cookies.isAuthenticated = isAuthenticated;

    response.cookie('isAuthenticated', isAuthenticated, {
        httpOnly: false,     // client-side JS can read it
        secure: false,       // served over plain HTTP in dev
        maxAge: isAuthenticated ? sessionMaxAge : -10000
    });
}
```

**Why this exists:** The server-rendered Handlebars pages know auth state from `res.locals.isAuthenticated` (set by UserDataMiddleware). But the client-side JavaScript (especially in the editor SPA) needs to know whether the user is logged in to decide whether to show authenticated UI. Making an API call just for this would be wasteful. Instead, the frontend reads the `isAuthenticated` cookie.

**On logout:** `maxAge` is set to `-10000` (a negative value), which tells the browser to immediately expire and delete the cookie. The `request.cookies.isAuthenticated` value is also updated in-memory so that middleware running later in the same request lifecycle sees the fresh value.

This cookie is set/cleared by every auth action:
- `LocalAuthenticationMiddleware` — sets `true` on successful login
- `GoogleAuthenticationMiddleware` — sets `true` on successful Google auth
- `TwitterAuthenticationMiddleware` — sets `true` on successful Twitter auth
- `AuthController.logout` — sets `false` on logout
- `CheckAuthenticatedApiMiddleware` — sets `false` if user is not authenticated (defensive cleanup)
- `CheckAuthenticatedFrontMiddleware` — sets `false` if user is not authenticated (defensive cleanup)

---

## 3. API Guards

### `CheckAuthenticatedApiMiddleware`

**File:** `src/middleware/auth/api-guards/check-authenticated-api.middleware.ts`

```typescript
use(request: Request, response: Response, next: (err?: any) => any): any {
    if (request.isAuthenticated()) {
        next();
        return;
    }
    updateAuthenticatedCookie(request, response, false);
    throw new UnauthorizedError(request.originalUrl + ' requires authentication');
}
```

- Throws `UnauthorizedError` (maps to HTTP 401) when not authenticated.
- Also clears the `isAuthenticated` cookie defensively (in case it was stale).
- Used on API routes that require a logged-in user (e.g., `GET /api/user`, `GET /api/project`).

### `CheckNotAuthenticatedApiMiddleware`

**File:** `src/middleware/auth/api-guards/check-not-authenticated-api.middleware.ts`

```typescript
use(request: Request, response: Response, next: (err?: any) => any): any {
    if (request.isAuthenticated()) {
        throw new BadRequestError(request.originalUrl + ' cannot be used by authenticated users');
    }
    next();
}
```

- Throws `BadRequestError` (HTTP 400) when an authenticated user tries to access a route that requires being logged-out.
- Currently not used in any route — it exists for completeness.

---

## 4. Frontend Guards

### `CheckAuthenticatedFrontMiddleware`

**File:** `src/middleware/auth/frontend-guards/check-authenticated-front.middleware.ts`

```typescript
use(request: Request, response: Response, next: (err?: any) => any): any {
    if (request.isAuthenticated()) {
        next();
        return;
    }
    updateAuthenticatedCookie(request, response, false);
    redirect(request, response, {target: '/'});
}
```

- Allows the request through if authenticated.
- If not authenticated: clears the isAuthenticated cookie and redirects to the home page.
- Used on routes that require a logged-in user (e.g., `/my/account`, `/my/projects`, `/auth/logout`).

### `CheckNotAuthenticatedFrontMiddleware`

**File:** `src/middleware/auth/frontend-guards/check-not-authenticated-front.middleware.ts`

```typescript
use(request: Request, response: Response, next: (err?: any) => any): any {
    if (request.isAuthenticated()) {
        redirect(request, response, {target: '/'});
        return;
    }
    next();
}
```

- Blocks authenticated users from accessing login/register/reset-password pages.
- Redirects them to the home page instead.
- Used on: `GET /login`, `GET /register`, `GET /reset-password`, `POST /auth/local-login`, `POST /auth/local-register`, `POST /auth/send-password-reset-mail`, `POST /auth/reset-password`.

---

## 5. `@CurrentUser()` and `currentUserChecker`

The `currentUserChecker` is registered in `src/main.ts`:

```typescript
useExpressServer(app, {
    ...
    currentUserChecker: action => (action.request as Request).user
});
```

This is a `routing-controllers` feature that reads `req.user` (which Passport sets during deserialization) and makes it available via the `@CurrentUser()` parameter decorator:

```typescript
@Get('/')
@UseBefore(CheckAuthenticatedApiMiddleware)
public async get(@CurrentUser() user: User) {
    return user;
}
```

**Key behaviors:**

- `@CurrentUser()` returns the full `User` entity object (not just an ID), because Passport's deserializeUser loads it from the database.
- It is **optional by default** — when no user is authenticated, it returns `undefined`. Controllers that require authentication must also use `@UseBefore(CheckAuthenticatedApiMiddleware)` or `@UseBefore(CheckAuthenticatedFrontMiddleware)`.
- Some controllers (e.g., `CommunityController`) use the optional pattern to conditionally show auth-dependent data:

```typescript
@Get('/')
public async index(@CurrentUser() currentUser?: User) {
    // currentUser is undefined when not logged in
}
```

---

## 6. Passport Strategies

All three strategies are registered in `PassportConfigService.setupPassport()`.

### 6.1 Local Strategy

```typescript
passport.use(new LocalStrategy(
    {
        passwordField: 'password',
        usernameField: 'email'
    },
    async (email, password, done) => {
        try {
            const user = await this.userService.validateLocalUser(email, password);
            done(null, user);
        } catch (error) {
            done(error);
        }
    }
));
```

- Uses `passport-local` with `email` as the username field.
- Delegates validation to `UserService.validateLocalUser()` which:
  1. Looks up the user by email.
  2. Checks the user has a password (not just OAuth-only).
  3. Compares the password with bcrypt.
  4. Checks that the email is verified.
  5. Throws `FormDataError` with field-specific error names: `'noUser'` (no account), `'invalid'` (wrong password), `'notVerified'` (email not yet verified).

This strategy is invoked via `LocalAuthenticationMiddleware` (see section 7.3).

### 6.2 Google OAuth2 Strategy

```typescript
passport.use(new OAuth2Strategy({
    ...this.configService.getConfig('passport').google,
    passReqToCallback: true
},
async (request, accessToken, refreshToken, profile, done) => {
    if (request.isAuthenticated()) {
        // Account connection flow: linking Google to existing account
        try {
            const user = await this.userService.connectGoogle(request.user, profile);
            done(null, user, {connectedAccounts: true});
            return;
        } catch (e) {
            done(new FormDataError({}, undefined, 'unknown', 'my_account_security_connect-account'));
            return;
        }
    }

    // New registration / returning user flow
    try {
        const user = await this.userService.findOrCreateGoogleUser(profile);
        done(null, user);
    } catch (error) {
        const formName = this.getOauthErrorFormName(request);
        if (error.message === 'emailTaken') {
            done(new FormDataError({}, undefined, 'emailTaken', formName));
        } else {
            done(new FormDataError({}, undefined, 'unknown', formName));
        }
    }
}
));
```

- **Two paths:**
  1. **Account connection** (`request.isAuthenticated()`): The user is already logged in (via local or Twitter) and is linking their Google account from the security settings page. Calls `userService.connectGoogle()`.
  2. **Login/Registration**: The user is not logged in. Calls `userService.findOrCreateGoogleUser()` which looks up by `googleUserId`, then falls back to creating a new user from the Google profile data.

- **Error handling:** Uses `getOauthErrorFormName()` to extract the correct form name from the `state` query parameter (see section 8 for how `state` tracks the original page). This ensures error messages appear on the right page (login, register, or Electron login).

### 6.3 Twitter OAuth Strategy

```typescript
passport.use(new TwitterStrategy({
    ...this.configService.getConfig('passport').twitter,
    userAuthorizationURL: 'https://api.twitter.com/oauth/authenticate?force_login=true',
    includeEmail: true,
    includeEntities: false,
    includeStatus: false,
    forceLogin: true,
    passReqToCallback: true
},
async (request, accessToken, refreshToken, profile, done) => {
    // Same dual-path logic as Google: connection vs login/registration
    // ...
}
));
```

- Uses `passport-twitter` with the same dual-path pattern as Google.
- Key options: `includeEmail: true` (Twitter's email scope), `forceLogin: true` (always shows consent screen), `includeEntities: false` / `includeStatus: false` (reduces profile payload size).
- Sets `userAuthorizationURL` to force `force_login=true` in the Twitter authorization URL.

### Error Form Name Resolution

```typescript
private getOauthErrorFormName(request: Request): string {
    switch (request.query.state) {
        case '/login':            return 'auth_local-login-page';
        case '/login-electron':   return 'auth_local-login-electron';
        case '/register':         return 'auth_local-register-page';
        default:                  return 'auth_local-login';
    }
}
```

The `state` query parameter is set by the login middleware (see section 8) to the page the user was on. When OAuth fails, this determines which form shows the error.

---

## 7. OAuth Flow (Google / Twitter)

Both providers follow the same two-phase flow:

### Phase 1: Initiation (`LoginMiddleware`)

The user clicks "Log in with Google/Twitter" on the login page. This sends a `GET` request to the initiation endpoint:

- `GET /auth/google-login` → `GoogleLoginMiddleware`
- `GET /auth/twitter-login` → `TwitterLoginMiddleware`

**GoogleLoginMiddleware** calls `passport.authenticate('google')` with:

```typescript
passport.authenticate('google', {
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'profile'],
    prompt: 'select_account',
    state: getPathnameWithoutLang(request.get('Referer') as string ?? '/')
})
```

- `scope`: Requests the user's email and profile information.
- `prompt: 'select_account'`: Forces Google's account picker even if one session is active.
- **`state`**: Crucial for preserving the user's original page. The `Referer` header tells us which page the user was on (e.g., `/login`, `/register`, `/login-electron`). After OAuth completes, this value is read from `request.query.state` to redirect the user back to the correct page — and to map errors to the correct form.

**TwitterLoginMiddleware** works similarly but passes the callback URL with a `state` query parameter inline:

```typescript
passport.authenticate('twitter', {
    callbackURL: configService.getConfig('passport').twitter.callbackURL + '?state=' + getPathnameWithoutLang(request.get('Referer'))
})
```

The user is now redirected to the OAuth provider's consent screen.

### Phase 2: Callback (`AuthenticationMiddleware`)

After the user grants permission, the OAuth provider redirects back to:

- `GET /auth/google-authenticate` → `GoogleAuthenticationMiddleware`
- `GET /auth/twitter-authenticate` → `TwitterAuthenticationMiddleware`

These middlewares call `passport.authenticate('google')` / `passport.authenticate('twitter')` with a **custom callback function** (not the default redirect-based flow):

```typescript
return passport.authenticate('google', (err, user: User, args) => {
    if (err) {
        return next(err);      // Passes FormDataError to formErrorMiddleware
    }
    if (args?.connectedAccounts) {
        return redirect(request, response, { target: '/my/account/security'});
    }

    request.login(user, loginErr => {
        if (loginErr) {
            return next(loginErr);
        }
        updateAuthenticatedCookie(request, response, true);
        return redirect(request, response, { target: request.query.state as string ?? '/'});
    });
})(request, response, next);
```

**Step by step:**

1. Passport calls the strategy's callback (from `passport-config.service.ts`) which returns `(err, user, args)`.
2. If there is an error (e.g., email already taken), the error is passed to `next(err)`, which hits `formErrorMiddleware`. This re-renders the original form with the error message.
3. If `args.connectedAccounts` is true, the user was already logged in and connected a new OAuth provider to their existing account. Redirect to security settings.
4. `request.login(user, ...)` establishes the Passport session (calls `serializeUser` internally).
5. `updateAuthenticatedCookie(request, response, true)` sets the non-httpOnly cookie.
6. Redirect to the original page (from the `state` parameter), or `/` if no state was preserved.

The `@UseAfter(formErrorMiddleware(...))` on each callback endpoint catches any `FormDataError` thrown during the flow and re-renders the original page with validation errors.

### Account Connection Flow

When a user is already logged in (via local auth or another OAuth provider) and visits `/auth/google-login` or `/auth/twitter-login`, the `request.isAuthenticated()` check in the strategy's callback fires:

1. `userService.connectGoogle(user, profile)` or `userService.connectTwitter(user, profile)` sets `googleUserId` or `twitterUserId` on the existing user record.
2. If the user already has that OAuth provider connected, it throws an error (`'Already Connected'`).
3. On success, the callback returns `{connectedAccounts: true}` and the user is redirected to `/my/account/security` (the account security settings page).

This flow is triggered from the **Security** tab in My Account (`/my/account/security`), where users can link additional login methods.

---

## 8. Local Authentication Flow

### 8.1 Registration

**Endpoint:** `POST /auth/local-register` or `POST /auth/local-register-page`

Both call the shared `localRegisterShared` method:

```typescript
private async localRegisterShared(body: LocalRegister, preferences: UserPreferences, redirect: RedirectFunction): Promise<Response> {
    try {
        if (await this.userService.createLocalUser(body.username, body.email, body.password, preferences.lang)) {
            return redirect({ showInfoPopup: 'local-register'});
        }
    } catch (err) {
        if (err.message === 'verification_mail') {
            throw new FormDataError(body, undefined, 'verificationMail');
        }
        throw new FormDataError(body, undefined, 'unknown');
    }
    throw new FormDataError(body, 'email', 'emailTaken');
}
```

**Step by step:**

1. **Validation:** The `LocalRegister` model uses `class-validator` decorators:
   - `email`: Must be a valid email (`@IsEmail()`).
   - `password`: Minimum 8 characters, must contain at least one letter and one digit (`@Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)`).
   - `password_repeat`: Must match `password` (`@MatchesProperty('password')`).
   - `username`: 2-20 characters, alphanumeric with `_` and `-` only (`@Matches(/^[a-zA-Z0-9_-]+$/)`).

2. **Email uniqueness check:** `userService.createLocalUser()` queries for an existing user with the same email. Returns `false` if taken.

3. **User creation:**
   ```typescript
   newUser.password = await hash(password, this.PASSWORD_SALT_ROUNDS);  // 9 rounds
   newUser.localEmailVerified = false;
   ```
   The password is hashed with bcrypt (9 salt rounds). The email is marked as unverified.

4. **Verification email:**
   ```typescript
   const code = await this.generateEmailVerificationCode(newUser.id, newUser.email);
   await this.sendRegisterVerificationMail(newUser, code, currentLang);
   ```
   A cryptographically random token (`crypto.randomBytes(32).toString('base64url')`) is stored in Redis under the key `verify-mail:{code}` with a 1-hour TTL. The code is sent in a verification link: `${rootUrl}/verify-email/${code}`.

5. **Redirect:** On success, redirects to the previous page with `showInfoPopup: 'local-register'`.
6. **On failure:** Throws `FormDataError` which is caught by `formErrorMiddleware` and re-renders the registration form with field-level errors.

**The two endpoints (`/local-register` and `/local-register-page`)** exist because the registration form appears both in a popup on certain pages and as a full-page view. They share the same logic but may render different templates.

### 8.2 Email Verification

**Endpoint:** `GET /verify-email/:authCode`

```typescript
@Get('/:authCode')
@Render('verify-email')
public async verifyEmail(@Param('authCode') authCode: string) {
    try {
        await this.userService.verifyEmail(authCode);
        return {success: true};
    } catch (e) {
        return {success: false};
    }
}
```

**`userService.verifyEmail()`:**

1. Reads the verification data from Redis: `getObject('verify-mail:{code}')`.
2. If the key doesn't exist or has expired (1-hour TTL), throws `'verification_timeout'`.
3. Looks up the user by the stored `userId`.
4. Sets `user.email = verificationData.email` and `user.localEmailVerified = true`.
5. Deletes the Redis verification token (single-use).
6. Renders `verify-email` Handlebars template with `{success: true}`.

Note that the email stored in Redis can differ from the user's current email — this supports the **email update verification flow** in `MyAccountController`, where `updateEmail()` generates a new verification code with the new email address.

### 8.3 Resending Verification Mail

**Endpoint:** `POST /auth/resend-verification-mail`

- Validates email and password against the database (must match existing credentials).
- Generates a new verification code and sends another verification email.
- Uses `showInfoPopup: 'local-register'` to notify the user.

### 8.4 Login

**Endpoint:** `POST /auth/local-login`, `POST /auth/local-login-page`, or `POST /auth/local-login-electron`

All three use the `LocalAuthenticationMiddleware`:

```typescript
async use(request: Request, response: Response, next?: (err?: any) => any): Promise<any> {
    // 1. Validate request body
    try {
        await validateOrReject(plainToClass(LocalLogin, request.body));
    } catch (validationErrors) {
        const error: any = new BadRequestError(`Invalid body, check 'errors' property for more info.`);
        error.errors = validationErrors;
        error.paramName = 'body';
        throw error;
    }

    // 2. Authenticate via passport
    return passport.authenticate('local', (err, user: User) => {
        if (err) {
            return next(err);   // FormDataError from validateLocalUser → formErrorMiddleware
        }
        request.login(user, loginErr => {
            if (loginErr) {
                return next(loginErr);
            }
            updateAuthenticatedCookie(request, response, true);
            return redirect(request, response, { target: '/'});
        });
    })(request, response, next);
}
```

**Step by step:**

1. **Body validation:** Transforms `request.body` to `LocalLogin` (using `class-transformer`) and validates it with `class-validator`. If validation fails, throws a `BadRequestError` with field-level errors.
2. **Passport authenticate:** Calls `passport.authenticate('local')` with a custom callback:
   - On error (wrong password, email not verified, no account): the `FormDataError` is passed to `next(err)`, which hits `formErrorMiddleware`. The error includes the error name (`'noUser'`, `'invalid'`, `'notVerified'`) and the affected field (`'email'` or `'password'`), so the form can highlight the relevant field.
   - On success: `request.login(user, ...)` creates the session (serializes user ID), `updateAuthenticatedCookie` sets the non-httpOnly cookie, and the user is redirected to `/`.

**The three variants:**
- `/local-login` — used when login is in a popup on an existing page (redirects back to that page via Referer).
- `/local-login-page` — used when login is on the dedicated login page.
- `/local-login-electron` — used by the Electron desktop app, rendered without a layout (`layout: false`).

### 8.5 Logout

**Endpoint:** `GET /auth/logout`

```typescript
@Get('/logout')
@UseBefore(CheckAuthenticatedFrontMiddleware)
public logout(@Req() request: Request, @Res() response: Response, @Redirect() redirect: RedirectFunction) {
    request.logout((err => console.error(err)));
    updateAuthenticatedCookie(request, response, false);
    return redirect({target: '/'});
}
```

1. `request.logout()` — Passport method that removes `req.user` and destroys the session.
2. `updateAuthenticatedCookie(request, response, false)` — sets `maxAge: -10000` to expire the isAuthenticated cookie immediately.
3. Redirect to home page.

### 8.6 Password Reset

Two endpoints work together:

**Step 1 — Send reset email:** `POST /auth/send-password-reset-mail`

```typescript
const code = await this.generatePasswordResetCode(user.id);
// Stores { userId } in Redis under key 'reset-password:{code}', TTL 1 hour
```

Generates a cryptographically random token, stores it in Redis with a 1-hour TTL, and sends an email with a reset link: `${rootUrl}/reset-password?token=${code}`.

**Step 1.5 — Display reset form:** `GET /reset-password`

The `AuthPagesController` renders a Handlebars template with the token in a hidden form field:

```typescript
@Get('/reset-password')
@Render('reset-password')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.RESET_PASSWORD'))
public resetPassword(@QueryParam('token') token: string) {
    return { token };
}
```

**Step 2 — Execute reset:** `POST /auth/reset-password`

```typescript
await this.userService.updatePasswordWithToken(body.token, body.password);
```

1. Reads the reset data from Redis: `getObject('reset-password:{token}')`.
2. If the key doesn't exist or has expired, throws `'reset_timeout'`.
3. Looks up the user by stored `userId`.
4. Hashes the new password with bcrypt and saves.
5. Deletes the Redis key (single-use).
6. Redirects with `showInfoPopup: 'password-reset'`.

The password uses the same validation as registration: minimum 8 characters, must contain at least one letter and one digit.

---

## 9. User Entity — Dual Login Strategy

**File:** `src/database/entities/user.entity.ts`

The `User` entity is designed to support multiple login strategies on a single account:

```typescript
@Entity()
@Check(`(login_type = 'local' and password is not null) or (login_type != 'local')`)
export class User {
    id: string;                    // UUID primary key

    username: string;              // Display name

    email: string;                 // Unique, required for all strategies

    password: string | null;       // Null for OAuth-only accounts

    googleUserId: string | null;   // Unique, set when Google is linked

    twitterUserId: string | null;  // Unique, set when Twitter is linked

    localEmailVerified: boolean;   // Default true (only meaningful for local accounts)

    image: ProfilePicture;         // Eager-loaded profile picture

    // Relations: shortcuts, projects, components, starred items
}
```

**Key design points:**

- **Independent columns** for each strategy: `password`, `googleUserId`, `twitterUserId`. A user can have any combination of these.
- **The CHECK constraint** ensures that if `login_type` were `'local'`, a password must exist. (The `login_type` column is implicit — the constraint exists but the column name in the source is the raw SQL constraint; it enforces data integrity at the database level.)
- **Email is shared** across strategies. When a user signs up via Google, their Google profile email becomes their account email. If another user already has that email, the OAuth registration fails with `'emailTaken'`.
- **`localEmailVerified`** defaults to `true` for OAuth-only accounts but is set to `false` on local registration. The `verifyEmail` flow only matters for local accounts.

### Serialization Groups

The `User` entity uses `class-transformer` for controlled JSON serialization:

| Group               | Exposed properties                                         |
|---------------------|------------------------------------------------------------|
| _(default)_         | `id`, `username`, `memberSince`, `image`                   |
| `privateUserData`   | `email`, `shortcuts`, `projects`, `components`             |
| `extendedUserData`  | `projects` / `components` filtered to `public` only        |

The `@Exclude({toPlainOnly: true})` class-level decorator ensures that properties without `@Expose()` are excluded from all JSON responses by default. Sensitive fields like `password`, `googleUserId`, and `twitterUserId` are never serialized.

---

## 10. UserService

**File:** `src/services/user.service.ts`

`UserService` is the core business logic layer for user management. It is a TypeDI `@Service()` injected into all controllers that manipulate users.

### Password Hashing

```typescript
private readonly PASSWORD_SALT_ROUNDS = 9;
```

All password hashing uses bcrypt with 9 salt rounds (a reasonable cost factor for a web application).

### User Creation Methods

| Method | Purpose |
|--------|---------|
| `createLocalUser(username, email, password, lang)` | Creates a local user with bcrypt-hashed password, sends verification email. Returns `false` if email already exists. |
| `findOrCreateGoogleUser(profile)` | Looks up by `googleUserId`, or creates a new user from Google profile data. Throws `'emailTaken'` if the Google email belongs to an existing account. |
| `findOrCreateTwitterUser(profile)` | Same pattern for Twitter. |

### Verification Methods

| Method | Purpose |
|--------|---------|
| `verifyEmail(code)` | Looks up the Redis-stored verification code, sets `localEmailVerified = true`, deletes the code. |
| `resendVerificationMail(email, password, lang)` | Validates credentials, generates a new Redis verification code, resends the email. |

### Password Methods

| Method | Purpose |
|--------|---------|
| `validateLocalUser(email, password)` | Looks up user, verifies bcrypt hash, checks `localEmailVerified`. Throws `FormDataError` with field-specific errors. |
| `updatePassword(user, newPassword, currentPassword?)` | Updates user's password. If user already has a password, requires `currentPassword` for verification. |
| `updatePasswordWithToken(token, newPassword)` | Validates a Redis-stored reset token, hashes the new password, saves, and deletes the token. |
| `sendResetPasswordMail(email, lang)` | Generates a Redis-stored reset token and sends the reset email. |

### Social Account Connection

| Method | Purpose |
|--------|---------|
| `connectGoogle(user, profile)` | Sets `googleUserId` on the existing user. Throws if already connected. |
| `connectTwitter(user, profile)` | Same pattern for Twitter. |

### Account Deletion

```typescript
public async remove(user: User, password: string) {
    if (user.password) {
        if (!(await compare(password, user.password))) {
            throw new Error('invalid_password');
        }
    }
    await this.removeTransaction(user);
    await this.userRepo.remove(user);
}
```

**`removeTransaction`** uses TypeORM's `@Transaction()` decorator to clean up all owned resources in a single transactional context:

```typescript
@Transaction()
private async removeTransaction(
    user: User,
    @TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
    @TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
    @TransactionRepository(UserRepository) userRepo?: UserRepository,
    @TransactionRepository(ProfilePictureRepository) profilePicRepo?: ProfilePictureRepository
) {
    // Deletes all components, projects, and profile picture owned by the user
}
```

### Redis Token Storage

Both verification codes and password reset tokens are stored in Redis with a **1-hour TTL** (3600 seconds):

```typescript
await this.redisService.setObject(`verify-mail:${code}`, {
    userId: userId,
    email: emailToVerify
}, 60 * 60);
```

Redis stores these as **hashes** (via `HSET`) with automatic expiry. The key format is:

| Token Type      | Redis Key Pattern         | Fields                |
|-----------------|---------------------------|-----------------------|
| Email Verify    | `verify-mail:{code}`      | `userId`, `email`     |
| Password Reset  | `reset-password:{code}`   | `userId`              |

---

## 11. Auth Pages Controller

**File:** `src/controller/frontend/auth-pages.controller.ts`

Serves the server-rendered Handlebars templates for authentication pages:

| Route                     | Template              | Guard                       |
|---------------------------|-----------------------|-----------------------------|
| `GET /login`              | `login-page`          | `CheckNotAuthenticatedFront` |
| `GET /register`           | `register-page`       | `CheckNotAuthenticatedFront` |
| `GET /reset-password`     | `reset-password`      | `CheckNotAuthenticatedFront` |
| `GET /login-electron`     | `login-electron`      | `CheckNotAuthenticatedFront` |

All routes are protected by `CheckNotAuthenticatedFrontMiddleware` — if the user is already logged in, they are redirected to `/`.

The `login-electron` route renders without the site layout (`layout: false`) because Electron renders the login page in a frameless window. It also passes the `token` query parameter to the `reset-password` template so the form can include it as a hidden field.

---

## 12. UserDataMiddleware

**File:** `src/middleware/global/user-data.middleware.ts`

This is a global `@Middleware({type: 'before'})` that runs on every request. It makes auth state available to Handlebars templates via `res.locals`:

```typescript
response.locals.isAuthenticated = request.isAuthenticated();
if (request.isAuthenticated()) {
    response.locals.user = {
        username: (request.user as User).username,
        email: (request.user as User).email,
        image: (request.user as User).image?.publicUrl ?? '/assets/default-user.svg'
    };
}
```

Every Handlebars template can check `{{#if isAuthenticated}}` to conditionally render authenticated UI, and access `{{user.username}}`, `{{user.email}}`, and `{{user.image}}` for the current user's profile.

---

## 13. API User Controller

**File:** `src/controller/api/user.controller.ts`

```typescript
@JsonController('/api/user')
@UseInterceptor(ApiInterceptor)
export class UserController {
    @Get('/')
    @UseBefore(CheckAuthenticatedApiMiddleware)
    @ResponseClassTransformOptions({groups: ['privateUserData']})
    public async get(@CurrentUser() user: User) {
        await user.shortcuts;  // trigger lazy relation load
        return user;
    }

    @Patch('/')
    @UseBefore(CheckAuthenticatedApiMiddleware)
    public async update(@CurrentUser() user: User, @Body() body: UpdateUser, @Preferences() preferences: UserPreferences) {
        if (body.email)    await this.userService.updateEmail(user, body.email, preferences.lang);
        if (body.password) await this.userService.updatePassword(user, body.password, body.current_password);
        if (body.username) await this.userService.updateUsername(user, body.username);
        // shortcuts update ...
        return user;
    }
}
```

- Both endpoints require authentication (`@UseBefore(CheckAuthenticatedApiMiddleware)`).
- `GET /api/user` returns all user data including email and shortcuts (via `privateUserData` serialization group). The `user.shortcuts` lazy relation must be awaited before returning.
- `PATCH /api/user` allows updating email (sends verification mail), password (requires current password), username, and shortcuts.

---

## 14. FormDataError Pattern in Auth Flows

The authentication system uses `FormDataError` throughout to communicate validation failures back to the UI. `FormDataError` extends `BadRequestError` (HTTP 400) and carries:

| Property        | Purpose                                        |
|-----------------|------------------------------------------------|
| `currentValues` | The form body values so the form can be re-populated |
| `property`      | The specific field with the error, or `undefined` for general errors |
| `errorName`     | Machine-readable error key (e.g., `'emailTaken'`, `'invalid'`, `'notVerified'`) |
| `formName`      | The form identifier for correct error display  |

Errors are caught by `formErrorMiddleware` (applied via `@UseAfter`), which serializes them into `req.session.formErrors` and redirects to the originating page. The Handlebars template reads session-stored errors and renders field-level validation messages.

---

## 15. Non-Obvious Patterns

### 1. Middleware-only Handlers

Several auth endpoints have empty handler bodies — the middleware does all the work:

```typescript
@Post('/local-login')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
@UseAfter(formErrorMiddleware())
public localLogin() {
    // LocalAuthenticationMiddleware calls passport.authenticate('local')
    // which handles success-redirect or error-throw
}
```

The OAuth initiation routes work the same way — `GoogleLoginMiddleware` and `TwitterLoginMiddleware` redirect the user to the OAuth provider, and the handler body never executes.

### 2. The OAuth State Parameter

The `state` query parameter serves three purposes in the OAuth flow:

1. **Redirect target:** After successful authentication, the user is redirected back to the page they were on (e.g., `/login`, `/register`, `/login-electron`).
2. **Error form name:** If the OAuth flow fails, the `state` value maps to the correct form name for error display (via `getOAuthErrorFormName()`).
3. **Routing-controllers preservation:** Since `state` is passed through the OAuth round-trip (the provider includes it in the callback URL), `routing-controllers` preserves it as `request.query.state`.

### 3. DeserializeUser as a Safety Net

Passport's `deserializeUser` is not just a session loader — it's also a **safety net** for deleted accounts. If a user is deleted from the database while their session is still valid, `deserializeUser` catches the condition (`user === undefined`), logs them out, clears the isAuthenticated cookie, and redirects them.

### 4. isAuthenticated Cookie Double-Write

The `updateAuthenticatedCookie` function writes the cookie via `response.cookie()` **and** updates `request.cookies.isAuthenticated` in-memory. This ensures that middleware running later in the same request lifecycle (e.g., guards that check the cookie) see the updated value immediately, even before the response is sent to the browser.

### 5. Two Login Endpoints per Action

Most local auth actions have two endpoints (e.g., `/local-login` and `/local-login-page`, `/local-register` and `/local-register-page`). This is because the same form can appear:

- As a **popup** on any page (the form posts to the non-page variant and redirects back via Referer).
- As a **full-page view** (the form posts to the `-page` variant).

Both share the same underlying logic but have different `formErrorMiddleware` redirect targets.

### 6. Email Verification Supports Email Changes

The same Redis-backed verification system handles both **registration verification** and **email change verification**. The verification data stores the target email alongside the user ID, so `verifyEmail()` updates `user.email` to the new value. For registration, this is the same as the current email. For email changes, it overwrites the old email with the new one.

### 7. OAuth-Only Users Have No Password

Users created via Google or Twitter have `password: null` and `localEmailVerified: true`. This means:

- They cannot log in via the local strategy (`validateLocalUser` checks `user.password` and throws `'noUser'`).
- They cannot set a password from the "forgot password" flow.
- They can later set a password via the security settings page (which calls `updatePassword` without requiring a current password).

The `@Check` constraint on the entity enforces database-level integrity: if a user record implies local login, a password must exist.

### 8. Update Password Without Current Password

`updatePassword` (used via the API `PATCH /api/user`) allows setting a password on an OAuth-only account without providing a current password:

```typescript
if (user.password) {
    if (!(await compare(currentPassword, user.password))) {
        throw new Error('invalid_password');
    }
}
```

If `user.password` is null (OAuth-only account), the current password check is skipped. This allows Google/Twitter users to add a local password later.
