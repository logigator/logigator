# Form Validation System

The form validation system provides a server-rendered approach to validating HTML form submissions, displaying errors, and mirroring validation on the client. It spans TypeScript model classes (using `class-validator`), a middleware error-handling pipeline, Handlebars helpers and partials, and a vanilla-JS client-side validation script.

## Directory Layout

```
src/
├── models/request/
│   ├── shared/                   # Request models used by both API and frontend
│   ├── api/                      # Fetch/XHR-requested API endpoints
│   │   ├── component/
│   │   ├── project/
│   │   ├── report-error/
│   │   └── user/
│   └── frontend/                 # Server-rendered (Handlebars) form endpoints
│       ├── auth/
│       ├── community/user/
│       ├── my-account/
│       ├── my-components/
│       ├── my-projects/
│       └── preferences/
├── validators/
│   ├── matches-property.validator.ts
│   └── unique-property.validator.ts
├── errors/
│   └── form-data.error.ts
├── middleware/
│   ├── action/
│   │   └── form-error.middleware.ts
│   └── global/
│       └── global-view-data.middleware.ts
├── handlebars-helper/
│   ├── form-name-scope.helper.ts
│   ├── form-field-name-scope.helper.ts
│   ├── form-field-has-errors.helper.ts
│   ├── form-field-value.helper.ts
│   ├── form-field-error.helper.ts
│   └── handleNewLines.ts
└── services/
    ├── user.service.ts            # Throws FormDataError from business logic
    └── passport-config.service.ts # Throws FormDataError from OAuth flows
resources/private/
├── templates/partials/
│   ├── form.hbs
│   ├── form-input.hbs
│   ├── form-area.hbs
│   ├── form-switch.hbs
│   ├── form-error.hbs
│   └── form-general-errors.hbs
└── js/
    ├── global-functions.js        # window.startFormValidation()
    └── global.js                  # Auto-starts validation on all forms
```

---

## 1. Request Model Class Hierarchy

Request models are plain TypeScript classes located under `src/models/request/`. They are organised into three directories that reflect where they are consumed.

### `shared/` — Cross-cutting models

Used by both API and frontend controllers. These tend to be create-oriented models that are submitted from the editor (`CreateProject`, `CreateComponent`) as well as from frontend HTML forms.

- `CreateProject` (`shared/create-project.ts`) — name, description, public flag.
- `CreateComponent` (`shared/create-component.ts`) — name, symbol, description, public flag.

### `api/` — Editor/API submissions

Models for the JSON API endpoints called by the editor application (`logigator-editor-v2`). These endpoints are **not** server-rendered and do **not** participate in the session-flash validation flow. When validation fails on an API endpoint, the controller auto-returns a 400 JSON response (routing-controllers default behaviour), not a redirect with formErrors in the session.

- `SaveProject` — circuit save: `oldHash`, `dependencies` (nested `ProjectMapping[]`), `elements` (nested `ProjectElement[]`).
- `SaveComponent` — component save: same structure plus `numInputs`, `numOutputs`, `labels`.
- `UpdateUser` — user settings: username, password, current_password, email, and a `shortcuts` array validated with `@UniqueProperty('name')`.
- `ProjectElement` — a single circuit element with numeric short-property names for compact serialisation: `t` (typeId), `o` (outputs), `i` (inputs), `p` (position), `q` (end-position), `r` (rotation), `n` (numeric data), `s` (string data).
- `ProjectMapping` — external component dependency: `id` (UUID) + `model` (numeric type).
- `UpdateProject` / `UpdateComponent` — metadata updates.
- `Shortcut` — keyboard shortcut config with `toEntity()` conversion method.
- `ReportError` / `ReportProject` — error report submission with deeply nested validation.

### `frontend/` — Server-rendered HTML forms

Models validated during POST requests that are handled by Handlebars-rendered controllers. When validation fails, `formErrorMiddleware` catches the error, serialises it into `session.formErrors`, and redirects back to the form page where `GlobalViewDataMiddleware` restores the errors into `res.locals.formErrors` and the Handlebars partials render them.

- `LocalRegister` — email, password, password_repeat (@MatchesProperty), username.
- `LocalLogin` — email, password.
- `ResetPassword` — password, password_repeat (@MatchesProperty), token.
- `SendPasswordResetMail` — email.
- `ResendVerificationMail` — email, password.
- `ProfileUpdateUsername`, `ProfileUpdateEmail`, `SecurityUpdatePassword`, `DeleteDelete` — account management.
- `EditProject`, `EditComponent`, `ShareProject` — project/component CRUD.
- `SetLanguage`, `SetTheme` — user preferences.
- `UserTab` — community user page with query param validation.

### Validation decoration pattern

Every property is decorated with `class-validator` decorators. A typical example:

```typescript
export class LocalRegister {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)
    password: string;

    @IsString()
    @IsNotEmpty()
    @MatchesProperty('password')
    password_repeat: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(20)
    @Matches(/^[a-zA-Z0-9_-]+$/)
    username: string;
}
```

For nested validation (`@ValidateNested`), a `@Type()` decorator from `class-transformer` is required so that plain deserialised objects are correctly converted to their class instances before validation runs:

```typescript
@IsArray()
@ValidateNested({each: true})
@Type(() => ProjectMapping)
dependencies: ProjectMapping[];
```

---

## 2. How `class-validator` Validates Incoming Bodies

Validation is triggered by routing-controllers' built-in `@Body()` parameter decorator. When a controller method is annotated with `@Body()`, routing-controllers automatically:

1. Parses the request body.
2. Calls `plainToClass(RequestModel, body)` (using `class-transformer`) to instantiate the typed model.
3. Runs `validateOrReject(instance)`, which executes all `class-validator` decorators on the model.
4. If validation fails, it throws a `BadRequestError` with an `errors` array of `ValidationError` objects and `paramName = 'body'`.

The thrown error has this shape:

```
BadRequestError {
  name: 'BadRequestError',
  message: 'Invalid body, check \'errors\' property for more info.',
  errors: [
    ValidationError {
      property: 'email',
      constraints: {
        isNotEmpty: 'email should not be empty',
        isEmail: 'email must be an email'
      }
    }
  ],
  paramName: 'body'
}
```

For the login endpoint, a `LocalAuthenticationMiddleware` does this explicitly instead of relying on routing-controllers' automatic body validation:

```typescript
await validateOrReject(plainToClass(LocalLogin, request.body));
```

The `LocalAuthenticationMiddleware` manually performs the same `plainToClass` + `validateOrReject` steps inside `use()`, then catches any `ValidationError` array and re-throws it as a `BadRequestError` with the expected `errors` and `paramName` shape so that `formErrorMiddleware` can handle it uniformly.

---

## 3. The `FormDataError` Class

`src/errors/form-data.error.ts`:

```typescript
export class FormDataError extends BadRequestError {
    currentValues: any;
    property: string | undefined;
    errorName: string;
    formName: string;
    name = 'FormDataError';
}
```

`FormDataError` extends `BadRequestError` (from `routing-controllers`) so it flows through the same error-handling middleware pipeline. It carries three pieces of context beyond the base error class:

- **`currentValues`**: The submitted form field values (typically the entire request body object). This is required so the form can re-populate fields after a redirect, rather than showing a blank form.
- **`property`**: The specific field that caused the error, or `undefined` if the error is not field-specific (e.g., a token has expired, a verification mail could not be sent).
- **`errorName`**: A string identifier for the error (e.g. `'emailTaken'`, `'noUser'`, `'invalid'`, `'verificationMail'`, `'tokenInvalid'`, `'unknown'`).
- **`formName`**: The name of the form this error belongs to. If omitted, the middleware derives it from the request path.

### When it is thrown vs. BadRequestError

- **`BadRequestError`** (with `errors` array + `paramName`): Thrown **automatically** by routing-controllers or the `LocalAuthenticationMiddleware` when `class-validator` decorator validation fails (e.g., a required field is missing, an email is malformed, a password is too short). The `errors` array contains `ValidationError` objects, each with a `property` name and `constraints` map.
- **`FormDataError`**: Thrown **explicitly** in controller or service code when business logic validation fails after the structural validation has passed. Common examples:
  - `new FormDataError(body, 'email', 'emailTaken')` — email already in use.
  - `new FormDataError(body, 'password', 'invalid')` — wrong password during login.
  - `new FormDataError(body, 'current_password', 'invalid')` — current password mismatch.
  - `new FormDataError(body, undefined, 'tokenInvalid')` — password reset token is invalid/expired (no specific field).
  - `new FormDataError(body, undefined, 'verificationMail')` — verification mail could not be sent.

Key distinction: `BadRequestError` with class-validator errors means "the submitted data is structurally invalid." `FormDataError` means "the submitted data is structurally valid but semantically invalid in the business context."

When `FormDataError` is thrown from a Passport strategy callback (e.g., during OAuth login), it is passed via `done(error)` rather than thrown directly. It still reaches the middleware pipeline because Passport calls the `next` function with the error.

---

## 4. The `formErrorMiddleware` — Session-Flash Pattern

`src/middleware/action/form-error.middleware.ts`

The `formErrorMiddleware` is a **post-action middleware** (applied via `@UseAfter()` in routing-controllers) that catches validation errors and stores them in the session as a one-time flash message before redirecting back to the referrer.

### Step-by-step flow

#### Step 1: Error type detection

```typescript
if (!(error instanceof BadRequestError &&
      (('errors' in error && 'paramName' in error) || error.name === 'FormDataError'))) {
    throw error;
}
```

Only errors matching the expected shape are intercepted. Any other error type is re-thrown to propagate up to the global error handler.

Two error shapes are accepted:
- A `BadRequestError` with `errors` (array of `ValidationError`) and `paramName` properties — produced by routing-controllers' automatic body validation.
- A `BadRequestError` whose `.name` is `'FormDataError'` — a manually-thrown `FormDataError` instance.

#### Step 2: Determine form name

```typescript
if (error.name === 'FormDataError' && (error as FormDataError).formName) {
    formName = (error as FormDataError).formName;
} else {
    formName = request.path.replace(/\//g, '_').substr(1);
}
```

The form name is either:
- Explicitly provided via `(error as FormDataError).formName`, or
- Derived from the URL path: `/auth/local-register` becomes `auth_local-register`.

This form name must match the one produced by the `formNameScope` Handlebars helper (which uses the same derivation logic).

#### Step 3: Build the formErrors data structure

```typescript
formErrors = {
  'auth_local-register': {
    'email': {
      value: 'user@example.com',
      errors: ['isNotEmpty', 'isEmail']   // from class-validator violations
    },
    'password': {
      value: '',
      errors: ['isNotEmpty']               // from class-validator violations
    },
    '__general__': {
      errors: ['emailTaken']               // non-field-specific business error
    }
  }
}
```

**From class-validator errors** (`'errors' in error`):
- Iterates over `request.body` to capture the current values of all fields.
- Iterates over each `ValidationError` in the `errors` array and extracts the constraint key names (e.g., `isNotEmpty`, `isEmail`, `minLength`).

**From FormDataError** (`error.name === 'FormDataError'`):
- Uses `formDataError.currentValues` for field values (rather than `request.body`, which may not be available if the error was thrown from a service or Passport strategy).
- If `formDataError.property` is set, the error is stored under that specific field.
- If `formDataError.property` is `undefined`, the error is stored under `__general__`.

#### Step 4: Flash to session and redirect

```typescript
request.session.formErrors = formErrors;

let redirectTarget;
if (redirectTargetFunc) {
    redirectTarget = redirectTargetFunc(request, response);
}

redirect(request, response, {target: redirectTarget});
```

The `redirect` function (in `src/functions/redirect.ts`) prepends the user's language code to the target path, so a redirect to `/auth/login` becomes `/en/auth/login` (or `/de/auth/login` etc.). If no target is specified (and no `redirectTargetFunc` was provided), it falls back to the `Referer` header from the request.

The optional `redirectTargetFunc` parameter allows callers to compute a custom redirect target dynamically. For example, Google and Twitter authentication passes `request => request.query.state as string ?? '/'` to redirect back to the page the user was on before the OAuth flow.

### Registration pattern

The middleware is registered on each controller method that accepts form submissions via the routing-controllers `@UseAfter` decorator:

```typescript
@Post('/local-register')
@UseBefore(CheckNotAuthenticatedFrontMiddleware)
@UseAfter(formErrorMiddleware())
public localRegister(@Body() body: LocalRegister, ...) { ... }
```

---

## 5. `GlobalViewDataMiddleware` — Session to `res.locals` Transfer

`src/middleware/global/global-view-data.middleware.ts`

This is a **global before-middleware** (priority `-1`, meaning it runs very early in the request lifecycle) registered on all routes:

```typescript
@Middleware({type: 'before', priority: -1})
export class GlobalViewDataMiddleware implements ExpressMiddlewareInterface {
    use(request: Request, response: Response, next: (err?: any) => any): any {
        // ... i18n and altPages setup ...

        response.locals.formErrors = request.session.formErrors;
        request.session.formErrors = undefined;

        response.locals.infoPopup = request.session.infoPopup;
        request.session.infoPopup = undefined;

        next();
    }
}
```

This implements the **read** half of the session-flash pattern:
1. On every request, it copies `session.formErrors` into `res.locals.formErrors` (making it available in Handlebars as `this.formErrors`).
2. It immediately clears `session.formErrors` (`undefined`), ensuring the flash is consumed exactly once.
3. A second flash, `session.infoPopup`, follows the same pattern for success/info popup messages (set by `redirect()` when `showInfoPopup` is provided).

Since this middleware runs before any controller action, the `formErrors` are available in the template context when the form page re-renders after a redirect. A subsequent normal visit (without a validation redirect) will see `formErrors` as `undefined`.

---

## 6. Handlebars Helpers

Five helpers compose to render form errors from the stored `formErrors` structure. They are registered in `src/handlebars-helper/helpers.ts` and available in all templates.

### `formNameScope`

```
{{#formNameScope action namePrefix}}...{{/formNameScope}}
```

- Derives a form name from the form action URL using the same logic as the middleware: `/auth/local-register` becomes `auth_local-register`.
- Optionally prepends a `namePrefix`.
- Sets `@formName` in the Handlebars data context via `createFrame()`. This scopes all nested error lookups to the correct form.
- The `action` argument is the form's `action` attribute; the middleware uses `request.path`, which is equivalent for same-page forms.

Example:
```handlebars
{{#formNameScope '/auth/local-register'}}
    {{@formName}}  <!-- outputs: auth_local-register -->
{{/formNameScope}}
```

### `formFieldNameScope`

```
{{#formFieldNameScope fieldName}}...{{/formFieldNameScope}}
```

- Sets `@fieldName` in the data context so that nested `formFieldError` calls know which field to check.
- Used inside form-input and form-area partials around the error slot so that multiple error elements inside the same field get the correct scope.

Example:
```handlebars
{{#formFieldNameScope 'email'}}
    {{#formFieldError 'isNotEmpty'}}...{{/formFieldError}}
    {{#formFieldError 'isEmail'}}...{{/formFieldError}}
{{/formFieldNameScope}}
```

### `formFieldHasErrors`

```
{{#formFieldHasErrors fieldName}}...{{/formFieldHasErrors}}
```

- Conditionally renders its block if `this.formErrors[formName][fieldName].errors` exists (is truthy).
- Used in form-input and form-area to add the `is-invalid` CSS class to the field container.

### `formFieldValue`

```
{{formFieldValue fieldName defaultValue}}
```

- Retrieves the previously-submitted value from `this.formErrors[formName][fieldName].value`.
- Falls back to `defaultValue` (or `undefined`) if there is no stored value.
- Used in the `value` attribute of `<input>` and the body of `<textarea>` elements so that re-displayed forms retain user input rather than showing blank fields.

### `formFieldError`

```
{{#formFieldError errorName}}...{{/formFieldError}}
```

- Conditionally renders its block if `this.formErrors[formName][fieldName].errors` includes the given `errorName`.
- Requires `@formName` (set by `formNameScope`) and `@fieldName` (set by `formFieldNameScope`) to be set in the data context.
- Used inside form-error partials to toggle their `is-shown` CSS class.

### `handleNewLines`

```
{{handleNewLines text}}
```

- Escapes HTML and replaces `\r\n` and `\n` with `&#10;` (HTML numeric entity for newline).
- Used in the form-area partial to preserve newlines in `<textarea>` content after a round-trip.

---

## 7. Form Partials

Six Handlebars partials implement the actual form rendering.

### `form.hbs`

The wrapping partial. Accepts `action`, `namePrefix?`, `method?`, and `class?` parameters.

```handlebars
{{#formNameScope action namePrefix}}
    <form class="partial-form {{class}}"
          action="{{action}}"
          method="{{ternary method method 'POST'}}"
          name="{{@formName}}">
        {{> @partial-block }}
    </form>
{{/formNameScope}}
```

- Wraps `formNameScope` around the `<form>` element so `@formName` is available for all nested helpers.
- The form element gets `name="{{@formName}}"` for client-side reference.

### `form-input.hbs`

A floating-label text input partial. Accepts `name`, `type`, `label`, `tooltip?`, `autocomplete?`, and `value?`.

```handlebars
<div class="partial-form-input {{#formFieldHasErrors name}}is-invalid{{/formFieldHasErrors}}" form-container>
    <div class="partial-form-input__input-container">
        <input type="{{type}}"
               name="{{name}}"
               id="{{concat @formName '_' name}}"
               placeholder=" "
               value="{{formFieldValue name value}}"
               {{#if autocomplete}}autocomplete="{{autocomplete}}"{{/if}}>
        <label for="{{concat @formName '_' name}}">{{label}}</label>
        {{#if tooltip}}
            <span class="partial-form-input__tooltip-button"></span>
            <div class="partial-form-input__tooltip">{{tooltip}}</div>
        {{/if}}
    </div>
    <div class="partial-form-input__errors" form-errors>
        {{#formFieldNameScope name }}
            {{#if @partial-block}}
                {{> @partial-block }}
            {{/if}}
        {{/formFieldNameScope}}
    </div>
</div>
```

- The `form-container` attribute is used by the client-side script to locate field containers.
- The `form-errors` attribute marks the element containing error messages for client-side scanning.
- `is-invalid` CSS class is conditionally applied when the field has server-side errors.
- `formFieldValue` fills in the submitted value so the form does not appear blank after a failed submission.

### `form-area.hbs`

A `<textarea>` variant of form-input. Accepts `name`, `label`, `tooltip?`, `value?`.

```handlebars
<div class="partial-form-area {{#formFieldHasErrors name}}is-invalid{{/formFieldHasErrors}}" form-container>
    <label class="partial-form-area__label" for="{{concat @formName '_' name}}">{{label}}</label>
    <textarea class="partial-form-area__area"
              name="{{name}}"
              id="{{concat @formName '_' name}}">{{handleNewLines (formFieldValue name value)}}</textarea>
    <div class="partial-form-area__errors" form-errors>
        {{#formFieldNameScope name }}
            {{> @partial-block }}
        {{/formFieldNameScope}}
    </div>
</div>
```

- Uses `handleNewLines` to preserve line breaks in the textarea content.
- Same `form-container`/`form-errors` attribute pattern for client-side hookup.

### `form-error.hbs`

A single error message element. Accepts `error` (error name string), `message` (display text), and `clientValData?` (parameter for client-side validation).

```handlebars
<div class="partial-form-error {{#formFieldError error}}is-shown{{/formFieldError}}"
     data-error="{{error}}"
     {{#if clientValData}}data-val-data="{{clientValData}}"{{/if}}>
    {{message}}
</div>
```

- The `is-shown` CSS class is conditionally applied when the error exists for the current field (using the data context's `@formName` and `@fieldName`).
- `data-error` stores the error name (e.g., `isNotEmpty`, `minLength`, `matches`, `isEmail`, `matchesProperty`, `mustChange`).
- `data-val-data` stores optional parameter data for client-side validation (e.g., `'8'` for minLength, `'password'` for matchesProperty, a regex string for matches, or a comparison value for `mustChange`).

### `form-general-errors.hbs`

A slot for non-field-specific errors. Wraps content in a `formFieldNameScope '__general__'` context, so nested `form-error` partials check `formErrors[formName].__general__.errors`.

```handlebars
<div class="partial-form-general-errors">
    {{#formFieldNameScope '__general__' }}
        {{#if @partial-block}}
            {{> @partial-block }}
        {{/if}}
    {{/formFieldNameScope}}
</div>
```

### `form-switch.hbs`

A checkbox toggle for boolean flags. Accepts `name`, `label?`, `checked?`, `onchange?` (inline JS code).

```handlebars
<div class="partial-form-switch">
    <label class="partial-form-switch__switch-container" for="{{concat @formName '_' name}}">
        <input class="partial-form-switch__input"
               type="checkbox"
               {{#if checked}}checked{{/if}}
               name="{{name}}"
               id="{{concat @formName '_' name}}"
               {{#if onchange}}onchange="{{onchange}}"{{/if}}>
        <span class="partial-form-switch__slider"></span>
    </label>
    {{#if label}}
        <span class="partial-form-switch__label">{{label}}</span>
    {{/if}}
</div>
```

- Unlike form-input, form-switch does **not** have a `form-container` attribute or an error slot, so it does not participate in client-side validation. It is not validated by `startFormValidation`.

---

## 8. Client-Side Validation Mirroring

`startFormValidation()` is defined in `resources/private/js/global-functions.js` as `window.startFormValidation`. It mirrors the server-side class-validator rules on the client to provide instant feedback without a round-trip.

### Auto-initialisation

`resources/private/js/global.js` auto-starts validation on every `<form>` that has a submit button:

```javascript
function formValidationForGlobalForms(form) {
    if (form.querySelector('button[type="submit"]')) {
        startFormValidation(form);
    }
}
document.querySelectorAll('form').forEach(form => formValidationForGlobalForms(form));
```

For dynamically-loaded popup forms (loaded via `openDynamicPopup`), `startFormValidation` is called explicitly inside the `setupPopupHandling` function after the popup HTML is injected.

### Configuration scanning: `generateFormErrorConfig`

The function reads the `data-error` and `data-val-data` attributes from error elements nested inside the form's `div[form-errors]` containers to build a configuration array:

```javascript
function generateFormErrorConfig(elements) {
    const config = [];
    for (const element of elements) {
        if (element instanceof HTMLButtonElement) continue;
        const formContainer = element.closest('div[form-container]');
        if (!formContainer) continue;
        const elementConfig = {
            formContainer: formContainer,
            element: element,
            touched: false,
            valid: false,
            errors: []
        };
        const errorMessages = elementConfig.formContainer
            .querySelector('div[form-errors]').children;
        for (const errorMessage of errorMessages) {
            const errorName = errorMessage.getAttribute('data-error');
            if (!(errorName in validationFunctions)) continue;
            elementConfig.errors.push({
                errorName: errorName,
                valData: errorMessage.getAttribute('data-val-data'),
                errorMessage: errorMessage
            });
        }
        config.push(elementConfig);
    }
    return config;
}
```

### Supported validators

| Error name | Validation function | `data-val-data` usage |
|---|---|---|
| `isNotEmpty` | `value !== undefined && value !== null && value !== ''` | none |
| `minLength` | `value.length >= Number(valData)` | minimum length |
| `maxLength` | `value.length <= Number(valData)` | maximum length |
| `isEmail` | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | none |
| `matches` | `new RegExp(valData).test(value)` | the regex pattern |
| `matchesProperty` | `elements.namedItem(valData).value === value` | name of the property to match (e.g., `'password'`) |
| `mustChange` | `value !== valData` | the original value to differ from |

The server-side `@UniqueProperty` decorator is **not** mirrored on the client, as uniqueness can only be verified by the server.

### Event-driven validation

Each validated input element gets an `input` event listener that calls `updateElementState`:

```javascript
element.addEventListener('input', () => {
    elementErrorConfig.touched = true;
    updateElementState(elementErrorConfig);
});
```

`updateElementState` runs all applicable `validationFunctions` against the current value. For each error:

- If validation fails and the field has been `touched` (received at least one input event), the error message element gets the CSS class `is-shown`.
- The field container (`div[form-container]`) gets/loses the `is-invalid` class based on overall validity.

### Submit button control

```javascript
submitButton.disabled = !formErrorConfig.every(elemErrConf => elemErrConf.valid);
```

The submit button is **disabled** until every validated field passes all its validation rules. This prevents submission of forms with known client-side errors. Note that this is only a convenience — the server always re-validates independently.

### CSS class conventions

- **`is-invalid`** (on `div[form-container]`): Applied when the field has validation errors (either from the server pre-population or after client interaction).
- **`is-shown`** (on `div.partial-form-error`): Applied when a specific error is active. On initial load with server errors, errors are shown immediately. On fresh forms, errors appear only after the user interacts with the field (`touched`).

---

## 9. Custom class-validator Decorators

### `@MatchesProperty`

`src/validators/matches-property.validator.ts`

Validates that a string property matches the value of another property on the same object. Used for password confirmation fields.

```typescript
@MatchesProperty('password')
password_repeat: string;
```

The validator constraint:
```typescript
class MatchesPropertyConstraint implements ValidatorConstraintInterface {
    validate(value: any, validationArguments?: ValidationArguments): boolean {
        const [propToMatch] = validationArguments.constraints;
        const propToMatchValue = (validationArguments.object as any)[propToMatch];
        return typeof value === 'string' && typeof propToMatchValue === 'string' && value === propToMatchValue;
    }
}
```

Both values must be strings and strictly equal. This prevents type-coercion surprises. The default error name is `matchesProperty`.

Used in: `LocalRegister`, `ResetPassword`, `SecurityUpdatePassword`.

### `@UniqueProperty`

`src/validators/unique-property.validator.ts`

Validates that an array of objects has unique values for a given property. Used for the keyboard shortcuts array in `UpdateUser`.

```typescript
@UniqueProperty('name')
shortcuts: Shortcut[];
```

The validator:
```typescript
export function UniqueProperty(property: string, validationOptions?: ValidationOptions) {
    return ValidateBy({
        name: 'uniqueProperty',
        constraints: [property],
        validator: {
            validate(value: any[], args: ValidationArguments): boolean {
                return value instanceof Array &&
                    new Set(value.map(x => x[args.constraints[0]])).size === value.length;
            },
            ...
        }
    }, validationOptions);
}
```

It creates a `Set` of the values for the given property across all array elements. If the set size differs from the array length, a duplicate exists. This decorator uses the shorthand `ValidateBy` function rather than the `registerDecorator` + class approach used by `@MatchesProperty`. The default error name is `uniqueProperty`.

---

## 10. End-to-End Example: Registration Form Failure

This example traces a registration attempt that fails at multiple validation levels, following the data through every layer.

### 1. User submits the form

A user fills out the registration form at `/auth/local-register` with:
- email: `not-an-email`
- password: `short`
- password_repeat: `different`
- username: `a`

The form POSTs to `/auth/local-register`.

### 2. routing-controllers parses the body

`@Body() body: LocalRegister` triggers `plainToClass(LocalRegister, request.body)` followed by `validateOrReject(instance)`.

### 3. class-validator produces ValidationErrors

The `validateOrReject` call fails with an array of `ValidationError` objects:
```
[
  { property: 'email', constraints: { isEmail: 'email must be an email' } },
  { property: 'password', constraints: { minLength: 'password must be longer than or equal to 8 characters' } },
  { property: 'password_repeat', constraints: { matchesProperty: 'password_repeat must match password!' } },
  { property: 'username', constraints: { minLength: 'username must be longer than or equal to 2 characters' } }
]
```

routing-controllers wraps these in a `BadRequestError` with `errors` and `paramName`.

### 4. formErrorMiddleware catches the error

The middleware (registered via `@UseAfter(formErrorMiddleware())` on `localRegister`) intercepts the `BadRequestError`. Since the error has `errors` and `paramName`, it enters the class-validator branch.

### 5. The middleware builds the formErrors structure

```javascript
// Form name derived from the path
formName = 'auth_local-register';

// All submitted values captured
formErrors['auth_local-register'] = {
    email:         { value: 'not-an-email', errors: ['isEmail'] },
    password:      { value: 'short',        errors: ['minLength'] },
    password_repeat: { value: 'different',  errors: ['matchesProperty'] },
    username:      { value: 'a',            errors: ['minLength'] }
};
```

### 6. The middleware redirects to the form page

```javascript
request.session.formErrors = formErrors;
redirect(request, response, {target: undefined}); // falls back to Referer
```

The redirect preserves `session.formErrors` across the redirect (session middleware persists it).

### 7. GlobalViewDataMiddleware transfers errors to template context

On the redirect's GET request for the form page, `GlobalViewDataMiddleware` runs before the controller:

```javascript
response.locals.formErrors = request.session.formErrors; // restores the data
request.session.formErrors = undefined;                  // consumes the flash
```

### 8. Handlebars partials render the errors

The form template uses:

```handlebars
{{#> form action='/auth/local-register'}}
    {{#> form-input name='email' type='email' label='Email'}}
        {{> form-error error='isNotEmpty' message='Email is required'}}
        {{> form-error error='isEmail' message='Invalid email format'}}
    {{/form-input}}
    ...
{{/form}}
```

- `formNameScope` derives `@formName = 'auth_local-register'`.
- For the email field: `formFieldHasErrors 'email'` detects `formErrors['auth_local-register']['email'].errors` exists, adds `is-invalid` to the container.
- `formFieldValue 'email'` returns `'not-an-email'`, which fills the input's `value` attribute.
- `formFieldNameScope 'email'` sets `@fieldName = 'email'`.
- `formFieldError 'isEmail'` checks if `errors` includes `'isEmail'` — it does, so the `is-shown` class is applied.

### 9. Client-side validation activates

After the page loads, `startFormValidation` runs automatically via the global.js initialiser. It reads `data-error` and `data-val-data` attributes from the rendered error elements:

- email field: `data-error="isNotEmpty"` and `data-error="isEmail"`
- password field: `data-error="isNotEmpty"` and `data-error="minLength"` with `data-val-data="8"`
- etc.

The submit button is disabled until all fields pass client-side validation. As the user types, each field's errors update in real time.

### 10. Business logic validation (FormDataError)

If the user corrects all field-level errors (valid email, 8+ char password, matching password_repeat, valid username) and resubmits, the request passes class-validator. The controller's `localRegisterShared` method calls `userService.createLocalUser()`. If the email is already taken, `createLocalUser` returns `false`, and the controller throws:

```javascript
throw new FormDataError(body, 'email', 'emailTaken');
```

This flows through `formErrorMiddleware` again, but this time via the FormDataError branch:
```
formErrors['auth_local-register'] = {
    email: { value: 'valid@example.com', errors: ['emailTaken'] },
    password: { value: 'longenough1', errors: [] },
    ...
}
```

The `emailTaken` error is rendered by the form-error with `error='emailTaken'` inside the email field's `form-error` slot. (Note that `emailTaken` is not in the `validationFunctions` map on the client, so it never enables/disables from client-side events — it only shows after a server round-trip.)

---

## 11. Non-Obvious Patterns

### The `__general__` concept

The `__general__` key in the formErrors structure is not a real form field. It stores errors that do not apply to any specific input, such as:
- Expired password-reset tokens (`tokenInvalid`)
- Verification mail delivery failures (`verificationMail`)
- Unknown/unexpected errors (`unknown`)
- OAuth email-conflict errors (`emailTaken` in the context of a login page, not a field)

The `form-general-errors` partial wraps its content in a `formFieldNameScope '__general__'` block so that `formFieldError` checks the correct path in the formErrors object.

General errors do **not** have a `value` property because they are not tied to any input element. The middleware sets `formErrors[formName].__general__ = { errors: [...] }` directly, without a `value` key.

### Error name conventions

The error names used in `form-error` partials fall into two categories:

**1. class-validator constraint names** (mirrored on the client):
- `isNotEmpty`, `isEmail`, `isString`, `isBoolean`, `isInt`, `isIn`
- `minLength`, `maxLength`, `matches`
- `matchesProperty` (custom), `uniqueProperty` (custom)

These are the **keys** of the `ValidationError.constraints` object produced by class-validator. The actual messages (e.g., `'email must be an email'`) are not used — only the constraint names matter, because the Handlebars template provides its own i18n-translated message per error name.

**2. Business logic error names** (server-only, no client-side validation):
- `emailTaken`, `noUser`, `invalid`, `notVerified`
- `verificationMail`, `tokenInvalid`, `resetMail`
- `unknown`

These are passed to `FormDataError.errorName` and are only rendered after a server round-trip. They are **not** in the client-side `validationFunctions` map. This means they do not affect the submit button's disabled state and are never hidden by user input — which is the desired behaviour, since client-side JS cannot verify email uniqueness or token validity.

### `fieldName` vs `@fieldName` vs `@formName`

- `@formName` and `@fieldName` are **Handlebars data-frame variables** (set via `createFrame()`), only accessible within the block of the helper that created them.
- `fieldName` is a **regular parameter** passed to the helper.
- The middleware and the `formNameScope` helper derive the form name using the same algorithm (`path.replace(/\//g, '_').substr(1)`), and this must match for errors to be found.
- `formFieldHasErrors` and `formFieldValue` receive `fieldName` as an explicit argument and use `@formName` from the data context.
- `formFieldError` receives `errorName` as an explicit argument and uses both `@formName` and `@fieldName` from the data context.

### Class-validator error names vs. messages

The form validation system relies solely on **constraint names** (the keys of the `constraints` map), not the human-readable messages. This is why the Handlebars templates look like:

```handlebars
{{> form-error error='isEmail' message='Please enter a valid email'}}
```

The `error` attribute matches the constraint key produced by class-validator. The `message` attribute is the user-facing string (typically a translation key). This separation means:
- The server translation layer (`i18n`) provides messages per language.
- The constraint names stay language-independent.
- Client-side JS checks the same constraint names against its own `validationFunctions` map.

### The `@MatchesProperty` validator is intentionally strict about types

```typescript
return typeof value === 'string' && typeof propToMatchValue === 'string' && value === propToMatchValue;
```

Both values must be strings. This guards against subtle bugs where, for example, a number `123` and a string `'123'` could be considered equal under loose comparison.

### The `do-not-remove-next` comment in formErrorMiddleware

```typescript
// DO NOT REMOVE next parameter, it breaks the middleware for some reason
return function (error: any, request: Request, response: Response, next: (err?: any) => any) {
```

The `next` parameter must remain in the signature even though it is never called. In routing-controllers' middleware processing, the arity of the function determines how the middleware is invoked. Removing `next` changes the function signature and alters how routing-controllers calls the function, which breaks error propagation.

### Form name collisions and shared forms

Multiple controller endpoints can share the same form name prefix when they serve different versions of the same form. For example:

- `/auth/local-register` (standalone page) and `/auth/local-register-page` (popup) both render registration forms. Their derived form names are `auth_local-register` and `auth_local-register-page` respectively, keeping them isolated.
- The OAuth flow in `passport-config.service.ts` explicitly sets `formName` based on `request.query.state` to ensure the redirected-to page gets the correct errors.

### The `redirectTargetFunc` parameter

The middleware accepts an optional factory function that dynamically computes the redirect target. This is used for OAuth callbacks:

```typescript
@UseAfter(formErrorMiddleware(request => request.query.state as string ?? '/'))
```

The `request.query.state` value encodes the page the user was on before being redirected to the OAuth provider, allowing the user to be returned to the correct page on error.

### API vs frontend validation split

Only frontend controllers use `formErrorMiddleware`. API controllers (under `src/controller/api/`) let routing-controllers return the default 400 JSON response with the `ValidationError` array when validation fails. There is no session flash for API errors because the editor handles errors via JavaScript, not page redirects.

### `form.hbs` is a wrapping partial, not an inline partial

Note the use of `{{#> form }}...{{/form}}` syntax, which is Handlebars **partial blocks**. The `action` and other parameters are passed as partial parameters (`action=action`, `class=class`, etc.). The content between `{{#> form}}` and `{{/form}}` becomes the `@partial-block` that `form.hbs` inserts with `{{> @partial-block }}`.

### Client-side validation does not replace server-side

Client-side validation is purely a UX optimisation. It cannot validate business rules like email uniqueness. Every form submission is independently validated on the server, and the server always has the last word. The disabled submit button is a convenience, not a security boundary.

### The `mustChange` validator

The client-side `mustChange` validation function is registered but has no corresponding server-side class-validator decorator (there is no `@MustChange` decorator in the codebase). It is used for profile forms where the new value must differ from the current one (e.g., changing username to something different from the current username). The `data-val-data` attribute holds the original value, and the comparison is done entirely on the client. The server independently rejects the submission if the value has not changed.
