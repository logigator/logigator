# Controllers

The backend uses **routing-controllers** (a TypeScript decorator-based routing library built on Express) to define HTTP endpoints. Every route in the application is declared inside a controller class, with routing metadata provided via decorators.

## Directory Layout

```
src/controller/
├── api/
│   ├── component.controller.ts      # /api/component
│   ├── project.controller.ts        # /api/project
│   ├── report-error.controller.ts   # /api/report-error
│   ├── share.controller.ts          # /api/share
│   └── user.controller.ts           # /api/user
└── frontend/
    ├── auth.controller.ts           # /auth
    ├── auth-pages.controller.ts     # /login, /register, /reset-password, /login-electron
    ├── community/
    │   ├── community-clone.controller.ts
    │   ├── community.controller.ts
    │   ├── community-proj-comp.controller.ts
    │   └── community-user.controller.ts
    ├── download.controller.ts       # /download
    ├── examples.controller.ts       # /examples
    ├── features.controller.ts       # /features
    ├── home.controller.ts           # /
    ├── imprint.controller.ts        # /imprint
    ├── my/
    │   ├── my-account.controller.ts # /my/account
    │   ├── my-components.controller.ts  # /my/components
    │   └── my-projects.controller.ts    # /my/projects
    ├── preferences.controller.ts    # /preferences
    ├── privacy-policy.controller.ts # /privacy-policy
    └── verify-email.controller.ts   # /verify-email
```

---

## Two Controller Families

Controllers are split into two families based on what kind of route they serve: JSON REST API or server-rendered HTML pages.

### `@JsonController('/api/...')` — API controllers

These controllers return JSON. Every API controller is decorated with `@UseInterceptor(ApiInterceptor)`, which wraps every response into the standard envelope `{ status: number, data: any }`.

```typescript
@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {
    // all methods return objects that become response.data
}
```

API controllers are stateless request handlers. They accept and return JSON, throw `routing-controllers` HTTP errors (`BadRequestError`, `NotFoundError`, etc.), and use `@CurrentUser()` to identify the caller. Authentication is opt-in per-route via `@UseBefore(CheckAuthenticatedApiMiddleware)`.

#### API route table

| Controller            | Prefix              | Responsibilities                                |
|-----------------------|---------------------|-------------------------------------------------|
| `ProjectController`   | `/api/project`      | CRUD for user projects, preview upload, cloning |
| `ComponentController` | `/api/component`    | CRUD for user components, preview upload, cloning|
| `UserController`      | `/api/user`         | Read/update current user profile and shortcuts  |
| `ShareController`     | `/api/share`        | Read shared projects/components by public link  |
| `ReportErrorController`| `/api/report-error`| Receive client-side error reports               |

### `@Controller('/...')` — Frontend controllers

These controllers return **Handlebars-rendered HTML pages** (or HTML fragments for AJAX requests). They do _not_ use the ApiInterceptor.

```typescript
@Controller('/community')
export class CommunityController {
    // methods annotated with @Render('template-name')
    // return data objects that are passed to the Handlebars template
}
```

Frontend controllers handle:
- Static page rendering (home, imprint, features, privacy policy)
- Authentication flows (login, register, password reset, OAuth)
- My Account / My Projects / My Components management (list, create, edit, delete, share)
- Community browsing (projects, components, user profiles, stargazers)
- Preferences (language, theme)

Many frontend routes come in pairs: a **full-page route** (`@Render('template')`) and an **AJAX page-fragment route** (`@Render('fragment-template')` with `{ layout: false }`). See the [layout: false pattern](#layout--false-pattern-for-ajax-page-fragments) section below.

#### Frontend route table

| Controller                  | Prefix                  | Responsibilities                                  |
|-----------------------------|-------------------------|----------------------------------------------------|
| `HomeController`            | `/`                     | Landing page with examples and featured shared items|
| `AuthPagesController`       | (none; per-method)      | Login, register, reset password pages             |
| `AuthController`            | `/auth`                 | Local/auth login/register, OAuth (Google/Twitter), logout, password reset, email verification |
| `MyProjectsController`      | `/my/projects`          | List, create, edit, delete, share projects        |
| `MyComponentsController`    | `/my/components`        | List, create, edit, delete, share components      |
| `MyAccountController`       | `/my/account`           | Profile, security, account deletion               |
| `CommunityController`       | `/community`            | Browse shared projects and components (paginated) |
| `CommunityProjCompController`| `/community`           | Single project/comp detail, star/unstar, stargazers|
| `CommunityUserController`   | `/community/user`       | User profile pages (projects/components/stars tabs)|
| `CommunityCloneController`  | `/community/clone`      | Clone a shared project or component               |
| `ExamplesController`        | `/examples`             | Example project listing                           |
| `FeaturesController`        | `/features`             | Static features page                              |
| `DownloadController`        | `/download`             | Electron download page, fetches release data from GitHub |
| `ImprintController`         | `/imprint`              | Static imprint page                               |
| `PrivacyPolicyController`   | `/privacy-policy`       | Static privacy policy page                        |
| `PreferencesController`     | `/preferences`          | Set language/theme cookies                        |
| `VerifyEmailController`     | `/verify-email`         | Email verification link handler                   |

---

## Decorator-Driven Routing

All routes are declared through decorators from the `routing-controllers` package. The system uses a flat routing model: the controller-level decorator sets the prefix, and method-level decorators set the verb and path suffix.

### HTTP Method Decorators

```typescript
@Get('/:projectId')
@Post('/')
@Put('/:projectId')
@Patch('/:projectId')
@Delete('/:projectId')
```

Parameters are extracted via dedicated decorators:

```typescript
@Param('projectId')       // from the URL path
@QueryParam('page')       // from the query string
@Body()                   // from the request body (auto-parsed JSON)
@UploadedFiles('previews', { options: ..., required: true })  // multipart file upload
@UploadedFile('image', { options: ..., required: true })      // single file upload
```

Query parameters are optional by default — when not present, they are `undefined`:

```typescript
public async list(
    @QueryParam('page') pageNr: number,
    @QueryParam('size') pageSize: number,
    @QueryParam('search') search: string
) {
    if (pageNr !== undefined || pageSize !== undefined || search !== undefined)
        return this.componentRepo.getComponentPageForUser(pageNr, pageSize, user, search);
    return this.componentRepo.find({ where: { user } });
}
```

### TypeDI Dependency Injection

Controller constructors use `@InjectRepository()` (from `typeorm-typedi-extensions`) for repositories and regular constructor injection for services:

```typescript
@Controller('/my/projects')
export class MyProjectsController {
    constructor(
        private translationService: TranslationService,
        private configService: ConfigService,
        @InjectRepository() private projectRepo: ProjectRepository,
        @InjectRepository() private projectDepRepo: ProjectDependencyRepository
    ) {}
}
```

---

## `@CurrentUser()` Injection

routing-controllers supports a `currentUserChecker` function registered during express app setup. The backend uses Passport.js session serialization — when a request is authenticated, Passport loads the `User` entity from the database and stores it in `req.user`. The `currentUserChecker` reads it from there:

```typescript
// In the app setup:
routingControllers.useExpressServer(app, {
    currentUserChecker: action => (action.request as Request).user
});
```

Usage in controllers:

```typescript
@Get('/')
@UseBefore(CheckAuthenticatedApiMiddleware)
public async get(@CurrentUser() user: User) {
    await user.shortcuts;  // triggers lazy relation load
    return user;
}
```

Key behaviors:
- `@CurrentUser()` returns the `User` entity directly (not just an ID).
- It is **optional by default** — it returns `undefined` when no user is authenticated. Controllers that require a user must use `@UseBefore(CheckAuthenticatedApiMiddleware)` or `@UseBefore(CheckAuthenticatedFrontMiddleware)` to reject unauthenticated requests.
- The `CommunityController` and `CommunityProjCompController` demonstrate the optional pattern: they accept `@CurrentUser() currentUser?: User` and only call `hasUserStaredProject` / `hasUserStaredComponent` when `request.isAuthenticated()` returns true.

---

## `@Render('view-name')` for Template Selection

Frontend controllers use `@Render('template-name')` to select a Handlebars template. The returned object is passed as the template's context.

```typescript
@Get('/')
@Render('home')
@UseBefore(setTitleMiddleware('TITLE.HOME'))
public async index() {
    return {
        editorUrl: this.configService.getConfig('domains').editor,
        examples,
        sharedProjects,
        sharedComps
    };
}
```

When a method returns a string (e.g., `return '';`) or has no return statement, the empty object `{}` is used as the template context. This is fine for static pages that don't need dynamic data:

```typescript
@Get('/')
@Render('features')
@UseBefore(setTitleMiddleware('TITLE.FEATURES'))
public async features() {
    return '';
}
```

Some handlers also set the page title manually via the `setTitle()` function, which writes directly to the Express response object. This is used when the title depends on dynamic data (e.g., a project name):

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

## `@UseBefore` / `@UseAfter` for Middleware Attachment

routing-controllers provides `@UseBefore` and `@UseAfter` to attach Express middleware to routes. These decorators can be applied at the **class level** (applies to every method) or at the **method level**.

### `@UseBefore` — runs before the handler

Used for:
- **Auth guards**: `CheckAuthenticatedApiMiddleware`, `CheckAuthenticatedFrontMiddleware`, `CheckNotAuthenticatedFrontMiddleware`
- **OAuth middleware**: `GoogleLoginMiddleware`, `GoogleAuthenticationMiddleware`, `TwitterLoginMiddleware`, `TwitterAuthenticationMiddleware`
- **Page metadata**: `setTitleMiddleware('TITLE.HOME')` — sets the `<title>` via `res.locals`
- **Auth strategies**: `LocalAuthenticationMiddleware` — handles passport.authenticate('local')

Multiple middleware can be stacked:

```typescript
@Post('/local-login')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
@UseAfter(formErrorMiddleware())
public localLogin() {
    // handler body is empty — middleware does the work
}
```

### `@UseAfter` — runs after the handler

Used for:
- **Form error handling**: `formErrorMiddleware()` catches `FormDataError` thrown in the handler and re-renders the form with validation errors.
- `formErrorMiddleware` can accept a factory function to compute the redirect target dynamically:

```typescript
@UseAfter(formErrorMiddleware(request => `/my/projects/edit-popup/${request.params.id}`))
```

### Class-level middleware

API controllers declare `@UseInterceptor(ApiInterceptor)` at the class level. routing-controllers runs interceptors after the handler but before the response is serialized, making it distinct from `@UseBefore`/`@UseAfter`.

---

## `@Redirect()` Custom Decorator

The `@Redirect()` decorator is a custom parameter decorator defined in `src/decorator/redirect.decorator.ts`. It injects a `RedirectFunction` — a function that returns the `Response` object after performing a redirect.

```typescript
export function Redirect() {
    return createParamDecorator({
        value: (action): RedirectFunction => (options?: RedirectFuncOptions) => {
            return redirect(action.request, action.response, options);
        }
    });
}

export type RedirectFunction = (options?: RedirectFuncOptions) => Response;
```

Usage:

```typescript
@Post('/local-register')
@UseBefore(CheckNotAuthenticatedFrontMiddleware)
@UseAfter(formErrorMiddleware())
public localRegister(
    @Body() body: LocalRegister,
    @Preferences() preferences: UserPreferences,
    @Redirect() redirect: RedirectFunction
) {
    return this.localRegisterShared(body, preferences, redirect);
}

// Inside the shared logic:
return redirect({ showInfoPopup: 'local-register' });
```

The `RedirectFuncOptions` type supports:
- `target?: string` — an explicit URL to redirect to. When absent, the redirect falls back to the Referer header or a default.
- `showInfoPopup?: string` — a query parameter name that signals the frontend to show an info popup (e.g., after a password reset).

The underlying `redirect()` function in `src/functions/redirect.ts` handles:
1. If `target` is provided, redirect to it.
2. If `showInfoPopup` is provided, redirect to the Referer with `?info=<name>` appended.
3. If neither is provided, redirect to the Referer.

### Usage in OAuth callbacks

The `formErrorMiddleware` is also used as `@UseAfter` with a factory that extracts the redirect target from the query string:

```typescript
@Get('/google-authenticate')
@UseBefore(GoogleAuthenticationMiddleware)
@UseAfter(formErrorMiddleware(request => request.query.state as string ?? '/'))
public googleAuthenticate() {
}
```

This pattern lets the OAuth provider (Google/Twitter) pass a `state` parameter that routing-controllers preserves across the OAuth round-trip.

---

## `@Preferences()` and `@Referer()` Decorators

Two other custom parameter decorators in `src/decorator/`:

### `@Preferences()`

Reads the `preferences` cookie and returns a `UserPreferences` object:

```typescript
@Post('/local-register')
public localRegister(
    @Body() body: LocalRegister,
    @Preferences() preferences: UserPreferences,
    @Redirect() redirect: RedirectFunction
) {
    // preferences.lang is used for email language
    // preferences contains whatever was serialized in the 'preferences' cookie
}
```

### `@Referer()`

Reads the `Referer` header from the request:

```typescript
@Post('/set-lang')
public setLanguage(
    @Body() body: SetLanguage,
    @Req() req: Request,
    @Res() res: Response,
    @Referer() ref: string
) {
    updatePreferences(req, res, { lang: body.lang });
    let redirectTarget = getPathnameWithoutLang(ref);
    // ...
}
```

---

## ApiInterceptor — JSON Response Envelope

Every API controller is decorated with `@UseInterceptor(ApiInterceptor)`, which wraps all returned data into a uniform structure:

```typescript
export class ApiInterceptor implements InterceptorInterface {
    intercept(action: Action, result: any): any | Promise<any> {
        return {
            status: (action.response as Response).statusCode,
            data: result || {}
        };
    }
}
```

This means:
- Every JSON response has the shape `{ status: <HTTP status code>, data: <handler return value> }`.
- If the handler returns `null` or `undefined`, `data` is an empty object `{}`.
- The HTTP status code is set separately via `@HttpCode(201)` or by Express defaults.
- The `classToPlain` transformation on the returned entity is handled _inside_ the handler (see Serialization Groups below). The interceptor only wraps the already-plain result.

The interceptor also contains a private `applyORMCache` utility for cleaning up TypeORM metadata keys (prefixed with `__`), but this is currently unused in the interceptor flow itself.

---

## Serialization Groups (`@ResponseClassTransformOptions`)

The backend uses `class-transformer` to control which properties are included in JSON responses. The `@ResponseClassTransformOptions({ groups: [...] })` decorator sets the active groups for `classToPlain()`.

### Groups used

| Group                | Effect                                       |
|----------------------|----------------------------------------------|
| `showShareLinks`     | Includes the public `link` field (share URL) |
| `privateUserData`    | Includes email, verification status, etc.    |
| `detailed`           | Used for community listing cards              |

### API controller example

```typescript
@Get('/')
@UseBefore(CheckAuthenticatedApiMiddleware)
@ResponseClassTransformOptions({groups: ['showShareLinks']})
public async list(@CurrentUser() user: User, @QueryParam('page') pageNr: number, ...) {
    return this.projectRepo.getProjectPageForUser(pageNr, pageSize, user, search);
}
```

### Frontend controller example

```typescript
@Get('/community/projects')
@Render('community')
@UseBefore(setTitleMiddleware('TITLE.COMMUNITY'))
public async projects(...) {
    return {
        ...(await this.getProjectsPage(pageNumber, search, preferences.lang, currentUser, orderBy === 'latest')),
        // shared comps also get showShareLinks via classToPlain inside the private method
    };
}
```

The `showShareLinks` group must be explicitly set in both API and frontend controllers because by default, the `link` property on entities is excluded from serialization (to avoid leaking share URLs in unintended contexts).

Note: `@ResponseClassTransformOptions` only affects the automatic `classToPlain` that routing-controllers performs on the returned entity. When the handler manually calls `classToPlain()` (e.g., to merge with additional properties), the options are not inherited — the handler must pass groups explicitly:

```typescript
const transformed = classToPlain(entry, { groups: ['detailed'] });
```

---

## `layout: false` Pattern for AJAX Page Fragments

Many frontend list views support **infinite scroll** or **lazy-loaded popups** via AJAX. The pattern is:

1. A full-page route renders the complete page with `@Render('template')`.
2. A parallel route renders only the fragment with `@Render('fragment-template')` and `{ layout: false }` in the return value.

The `layout: false` flag tells the Handlebars layout engine to render only the view partial without the surrounding site chrome (header, footer, navigation). The client-side JavaScript fetches these fragments and inserts them into the DOM.

### Paginated listing example

Full page (CommunityController):

```typescript
@Get('/projects')
@Render('community')
@UseBefore(setTitleMiddleware('TITLE.COMMUNITY'))
public async projects(@QueryParam('page') pageNumber: number, ...) {
    return {
        ...(await this.getProjectsPage(pageNumber, search, preferences.lang, currentUser, orderBy === 'latest')),
        searchTerm: search,
        type: 'projects',
        orderByLatest: orderBy === 'latest',
        viewScript: 'community'
    };
}
```

AJAX fragment:

```typescript
@Get('/projects/page')
@Render('community-page')
public async projectsPage(@QueryParam('page') pageNumber = 0, ...) {
    return {
        ...(await this.getProjectsPage(pageNumber, search, preferences.lang, currentUser, orderBy === 'latest')),
        layout: false     // <-- renders without layout
    };
}
```

### Popup example

```typescript
@Get('/info/:id')
@Render('project-component-info-popup')
@UseBefore(CheckAuthenticatedFrontMiddleware)
public async infoPopup(...) {
    return {
        ...component,
        dependencies,
        layout: false,
        type: 'project'
    };
}
```

The `login-electron` route also uses `{ layout: false }` because the Electron app renders the login page in a frameless window:

```typescript
@Get('/login-electron')
@Render('login-electron')
@UseBefore(CheckNotAuthenticatedFrontMiddleware)
public loginElectron() {
    return { layout: false };
}
```

---

## Non-Obvious Patterns

### 1. Awaiting Lazy Relations Before Passing to Templates

TypeORM lazy relations return Promises. When the Handlebars template iterates over a relation, the relation must be resolved before the data reaches the renderer. Since Express finishes rendering synchronously after the handler returns, unresolved lazy relations would appear as empty.

For example, `user.shortcuts` is a `Promise<Shortcut[]>`:

```typescript
@Get('/')
@UseBefore(CheckAuthenticatedApiMiddleware)
@ResponseClassTransformOptions({groups: ['privateUserData']})
public async get(@CurrentUser() user: User) {
    await user.shortcuts;  // <-- must await before returning
    return user;
}
```

Similarly, `forkedFrom`, `staredProjects`, and `staredComponents` are lazy relations:

```typescript
const forkedFrom = await project.forkedFrom;
if (forkedFrom) {
    (project as any).forkedFromName = (await forkedFrom.user).username + '/' + forkedFrom.name;
}
```

### 2. `classToPlain()` for Merging with Dynamic Properties

When a handler needs to include both entity properties and computed/transient properties, it cannot return the entity directly (routing-controllers would serialize it but the extra properties would be lost or not enumerable). Instead, it spreads `classToPlain()` into the returned object:

```typescript
@Get('/:projectId')
@UseBefore(CheckAuthenticatedApiMiddleware)
public async open(@Param('projectId') projectId: string, @CurrentUser() user: User) {
    const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);
    // ...
    return {
        ...classToPlain(project, {groups: ['showShareLinks']}),
        dependencies,
        elements: content ?? []
    };
}
```

This pattern is used extensively in:
- `ProjectController.open` / `ComponentController.open`
- `ShareController.get`
- `HomeController.index` (for preview URLs)
- All community listing private methods

### 3. Shared Endpoints (`/api/share`) and Dual-Type Resolution

The `ShareController` handles both projects and components from a single endpoint. It resolves the type by checking both repositories:

```typescript
const project = (await this.projectRepo.findOne({ where: { link } }))
            || (await this.componentRepo.findOne({ where: { link } }));
if (!project) throw new NotFoundError('ResourceNotFound');
// ...
return {
    type: project instanceof Project ? 'project' : 'comp',
    ...classToPlain(project),
    dependencies,
    elements
};
```

### 4. `@HttpCode(201)` for Created Resources

API POST handlers that create resources explicitly set the 201 status:

```typescript
@Post('/')
@HttpCode(201)
@UseBefore(CheckAuthenticatedApiMiddleware)
public create(@Body() body: CreateProject, @CurrentUser() user: User) {
    return this.projectRepo.createProjectForUser(...);
}
```

### 5. FormDataError Pattern for Form Validation

Frontend controllers that process form submissions (login, register, profile update) use a `FormDataError` + `formErrorMiddleware` pipeline rather than returning error responses directly:

```typescript
throw new FormDataError(body, 'email', 'emailTaken');
```

The `formErrorMiddleware` (applied via `@UseAfter`) catches these errors, re-renders the form with the original body values, and injects a field-level error message. This keeps the form state intact across validation failures.

### 6. `@ContentType('application/json')` for JSON Endpoints

Some frontend routes return JSON even though they're on `@Controller` rather than `@JsonController`. These use `@ContentType('application/json')` to override the default HTML content type:

```typescript
@Post('/edit/:id')
@ContentType('application/json')
@UseBefore(CheckAuthenticatedFrontMiddleware)
public async edit(@Param('id') id: string, ...) {
    const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
    project.name = body.name;
    await this.projectRepo.save(project);
    return { id: project.id };
}
```

This is used by the popup-based create/edit forms in `MyProjectsController` and `MyComponentsController`.

### 7. Empty Handler Body for Middleware-Only Routes

Some routes exist solely to trigger middleware and have empty handler bodies:

```typescript
@Post('/local-login')
@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
@UseAfter(formErrorMiddleware())
public localLogin() {
    // LocalAuthenticationMiddleware calls passport.authenticate('local')
    // which handles the entire response — success redirects, failure throws FormDataError
}
```

The OAuth initiation routes (`/auth/google-login`, `/auth/twitter-login`) follow the same pattern — the GoogleLoginMiddleware / TwitterLoginMiddleware redirects the user to the OAuth provider, and the controller handler never executes.

### 8. Version Mismatch Detection in Save Endpoints

Both `ProjectController.save` and `ComponentController.save` implement optimistic concurrency control by comparing file hashes:

```typescript
if (project.elementsFile && project.elementsFile.hash !== body.oldHash)
    throw new BadRequestError('VersionMismatch');
```

The editor sends the hash of the circuit data it last received, and the server rejects the save if the stored hash differs, preventing accidental overwrites.

### 9. Uploaded File Handling

Preview images and profile pictures are uploaded as multipart form data and stored as `Buffer` content in dedicated entity classes:

```typescript
@Post('/:projectId/preview')
@UseBefore(CheckAuthenticatedApiMiddleware)
public async updatePreviews(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
    @UploadedFiles('previews', { options: getUploadedFileOptions(2), required: true }) images: any
) {
    if (images[0].mimetype !== 'image/png' || images[1].mimetype !== 'image/png')
        throw new BadRequestError('Invalid MIME type');
    project.previewDark.setFileContent(images[0].buffer);
    project.previewLight.setFileContent(images[1].buffer);
    return this.projectRepo.save(project);
}
```

The `getUploadedFileOptions(n)` function configures multer (the underlying file upload middleware). MIME type validation is done explicitly in the handler.
