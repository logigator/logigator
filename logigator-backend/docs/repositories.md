# Repositories

The backend uses TypeORM's **repository pattern** to encapsulate database access for each entity. Repositories are registered as TypeDI services (`@Service()`) so they can be injected into controllers and other services via the `@InjectRepository()` decorator from `typeorm-typedi-extensions`.

---

## Dual Decoration Pattern

Every repository carries two class-level decorators:

```typescript
import {EntityRepository, Repository} from 'typeorm';
import {Service} from 'typedi';
import {User} from '../entities/user.entity';

@Service()
@EntityRepository(User)
export class UserRepository extends Repository<User> {
    // ...
}
```

- **`@Service()`** (from `typedi`) — registers the repository in TypeDI's dependency injection container, making it injectable via `@InjectRepository()` in controllers and services.
- **`@EntityRepository(Entity)`** (from `typeorm`) — registers the repository with TypeORM, binding it to a specific entity and making it available for use with `@TransactionRepository()` inside transaction-scoped methods.

The bridge between the two containers is the `@InjectRepository()` decorator from `typeorm-typedi-extensions`. When a constructor parameter is decorated with it, the library resolves the repository from TypeDI (which registered it via `@Service()`) rather than requiring `getCustomRepository()` calls:

```typescript
// In any @Service() or controller class:
constructor(
    @InjectRepository() private projectRepo: ProjectRepository,
    @InjectRepository() private componentRepo: ComponentRepository
) {}
```

This dual registration is necessary because TypeORM and TypeDI are separate DI containers. Without `@Service()`, `@InjectRepository()` would have nothing to resolve from TypeDI. Without `@EntityRepository()`, `@TransactionRepository()` (used inside `@Transaction()` methods) would have nothing to resolve from TypeORM.

---

## Directory Layout

```
src/database/repositories/
├── pageable.repository.ts               # Base class with pagination support
├── user.repository.ts
├── project.repository.ts
├── project-file.repository.ts
├── component.repository.ts
├── component-file.repository.ts
├── component-dependency.repository.ts
├── project-dependency.repository.ts
├── shortcut.repository.ts
└── profile-picture.repository.ts
```

---

## `PageableRepository<T>` — Paginated Base Class

`ProjectRepository` and `ComponentRepository` extend `PageableRepository<T>` (which itself extends `Repository<T>`) to provide a standard pagination method.

### `getPage()` method

```typescript
public async getPage(
    page = 0,
    pageSize: number = this.defaultPagesize,
    options: FindOneOptions<T> = {}
): Promise<Page<T>>
```

Key behavior:

- **Default page size**: 20 (`defaultPagesize = 20`).
- **Hard upper bound**: 1000 (`maxPagesize = 1000`). Any value above 1000 is silently clamped.
- **Lower bound**: Values <= 0 are treated as the default (20).
- **Implementation**: Uses TypeORM's `skip`/`take` built in to `findAndCount`, wrapping the result in a `Page<T>` envelope.

```typescript
const results = await super.findAndCount(Object.assign(options, {
    skip: page * pageSize,
    take: pageSize
}) as FindManyOptions);
```

### `Page<T>` interface

```typescript
export interface Page<T> {
    page: number;
    total: number;
    count: number;
    entries: T[];
}
```

| Field     | Description                                                  |
|-----------|--------------------------------------------------------------|
| `page`    | The requested page number (0-based, echoed back)             |
| `total`   | Total number of pages (`Math.ceil(totalCount / pageSize)`)   |
| `count`   | Number of entries in this page (`results[0].length`)         |
| `entries` | The actual entity array for this page                        |

### Page numbering convention

Pages are **0-based**. The first page is `page=0`. This flows directly to the frontend, where pagination controls start counting from 0 as well. The total page count in `total` is already ceiling-divided, so the frontend can render a control loop `for (let i = 0; i < total; i++)`.

---

## Ownership-Scoped Query Pattern

Both `ProjectRepository` and `ComponentRepository` implement an ownership guard that is central to the API's security model:

```typescript
public async getOwnedProjectOrThrow(
    projectId: string,
    user: User,
    message = 'ResourceNotFound'
): Promise<Project> {
    const project = await this.findOne({
        where: {
            id: projectId,
            user: user
        }
    });
    if (!project)
        throw new NotFoundError(message);
    return project;
}
```

**How it works**: The query filters by **both** `id` and `user`. If the entity exists but belongs to a different user, `findOne` returns `null` and `NotFoundError` is thrown — no distinction is made between "doesn't exist" and "exists but is not yours." This avoids leaking information about other users' resource IDs.

The `message` parameter defaults to `'ResourceNotFound'` but callers can override it to provide more specific error context:

```typescript
// In ProjectController.save:
const depComp = await this.componentRepo.getOwnedComponentOrThrow(
    mapping.id, user,
    `Component for mapping '${mapping.id}' not found.`
);
```

Every write operation (save, update, delete, patch) in `ProjectController` and `ComponentController` starts with a call to this method, ensuring that no user can modify another user's resources.

---

## Repository-by-Repository Reference

### `UserRepository`

```
src/database/repositories/user.repository.ts
```

Extends `Repository<User>` directly (not `PageableRepository`).

| Method | Description |
|--------|-------------|
| `getStargazersForProjectByLink(link, page, pageSize)` | Returns a `Page<User>` of users who have starred a project. Joins the `staredProjects` relation and eagerly loads each user's `image` (profile picture). |
| `getStargazersForComponentByLink(link, page, pageSize)` | Same as above but for the `staredComponents` relation. |
| `getUserOwningProject(projectId)` | Finds the user who owns a specific project by inner-joining through the user's `projects` relation. Eagerly loads `image`. |
| `getUserOwningComponent(componentId)` | Same as above but for the `components` relation. |

**Important**: This class does **not** define custom `findByEmail()` or `findByLoginStrategy()` methods. Email lookups are done inline using the inherited `Repository.findOne()`:

```typescript
// In UserService:
const user = await this.userRepo.findOne({ email: email });
```

Login strategy lookups follow the same pattern — the entity stores `googleUserId`, `twitterUserId`, and `password` (for local auth), and lookups use `findOne({ googleUserId: id })` / `findOne({ twitterUserId: id })`. The `@Check` decorator on the `User` entity enforces that local users must have a password set.

Services that use `UserRepository`:
- `UserService` — account creation, email verification, password management
- `PassportConfigService` — user deserialization during session authentication
- `UserController` (API) — profile read/update
- Multiple frontend controllers — community browsing, stargazer listings, account management

---

### `ProjectRepository`

```
src/database/repositories/project.repository.ts
```

Extends `PageableRepository<Project>`.

| Method | Description |
|--------|-------------|
| `getOwnedProjectOrThrow(id, user, message?)` | Ownership-scoped lookup. Throws `NotFoundError` if the project either does not exist or belongs to a different user. |
| `getProjectWithStargazersCountByLink(link)` | Loads a single project by its share link, with `stargazersCount` as a mapped property via `loadRelationCountAndMap`. Also eagerly loads `previewDark` and `previewLight`. Used by the community detail page. |
| `getProjectPageForUser(pageNr, pageSize, user, search?, onlyShowPublic?)` | Returns a `Page<Project>` filtered by owner. Supports optional case-insensitive name search (`Like('%...%')`) and an `onlyShowPublic` filter. Ordered by `lastEdited DESC`. |
| `getSharedProjectPage(pageNr, pageSize, search?, orderOnlyByTime?)` | Returns public projects for the community browse page. Has two ordering modes: (a) by star count descending (default), which uses `createQueryBuilder` with `COUNT(stargazers.id)` aggregation, and (b) by `lastEdited DESC` when `orderOnlyByTime` is true. |
| `createProjectForUser(name, description, sharePublicly, user)` | Factory method that creates a `Project`, wires it to the given user, instantiates a new `ProjectFile`, and saves. |
| `deleteProjectForUser(projectId, user)` | Ownership-scoped delete. Calls `getOwnedProjectOrThrow` first, then `remove`. Returns the deleted entity. |
| `hasUserStaredProject(project, user)` | Boolean check — queries the `stargazers` many-to-many junction table for a matching pair. |
| `getStargazersCount(project)` | Raw SQL count via `createQueryBuilder` + `getRawOne` for the number of stargazers. |
| `getProjectsStaredByUser(page, pageSize, user)` | Paginated query returning public projects that the given user has starred. |

#### Factory pattern — `createProjectForUser`

This method demonstrates the canonical pattern for creating new resources with bidirectional relationships:

```typescript
public createProjectForUser(
    name: string,
    description: string,
    sharePublicly: boolean,
    user: User
) {
    const project = this.create();
    project.name = name;
    project.description = description;
    project.public = sharePublicly;
    project.user = Promise.resolve(user);       // lazy ManyToOne
    project.elementsFile = new ProjectFile();    // eager OneToOne
    return this.save(project);
}
```

Key points:
- `this.create()` instantiates a new entity instance managed by TypeORM.
- Lazy relations (`user`, `forkedFrom`) are assigned as `Promise.resolve(relatedEntity)`.
- Dependent entities (`elementsFile`, `previewDark`, `previewLight`) are instantiated fresh.

---

### `ComponentRepository`

```
src/database/repositories/component.repository.ts
```

Extends `PageableRepository<Component>`. Mirrors `ProjectRepository` in structure.

| Method | Description |
|--------|-------------|
| `getOwnedComponentOrThrow(id, user, message?)` | Ownership guard — same pattern as `ProjectRepository.getOwnedProjectOrThrow`. |
| `getComponentWithStargazersCountByLink(link)` | Single component with star count and preview images, for the community detail view. |
| `clone(component, user)` | Deep-copies a component for the given user, preserving name, description, symbol, labels, input/output counts, and circuit file. Sets `forkedFrom` to the original and creates a fresh `ComponentFile`. |
| `getComponentPageForUser(pageNr, pageSize, user, search?, onlyShowPublic?)` | Paginated listing of a user's own components, with optional search and public-only filter. |
| `getSharedComponentsPage(pageNr, pageSize, search?, orderOnlyByTime?)` | Public components for community browsing, ordered by star count or recency. |
| `createComponentForUser(name, symbol, description, sharePublicly, user)` | Factory method — same pattern as `createProjectForUser`. Additionally sets `symbol`, `numInputs`/`numOutputs` defaults, and initializes `labels` to an empty array. |
| `deleteComponentForUser(projectId, user)` | Ownership-scoped deletion. |
| `hasUserStaredComponent(component, user)` | Boolean check on stargazers junction table. |
| `getStargazersCount(component)` | Raw count query. |
| `getComponentsStaredByUser(page, pageSize, user)` | Paginated public components that the user has starred. |

#### The `clone()` method

```typescript
public async clone(component: Component, user: User) {
    const cloned = this.create();
    cloned.name = component.name;
    cloned.description = component.description;
    cloned.user = Promise.resolve(user);
    cloned.forkedFrom = Promise.resolve(component);
    cloned.createdOn = component.createdOn;
    cloned.labels = component.labels;
    cloned.numInputs = component.numInputs;
    cloned.numOutputs = component.numOutputs;
    cloned.symbol = component.symbol;
    cloned.elementsFile = new ComponentFile();
    if (component.elementsFile)
        cloned.elementsFile.setFileContent(await component.elementsFile.getFileContent());
    return this.save(cloned);
}
```

Preserves the full circuit data by copying the `elementsFile` content buffer. This is invoked within a `@Transaction()` context in `ShareCloningService`.

---

### `ProjectFileRepository` and `ComponentFileRepository`

```
src/database/repositories/project-file.repository.ts
src/database/repositories/component-file.repository.ts
```

Both extend `Repository<X>` with no custom methods. They exist so that `@InjectRepository()` can resolve them and so that the entity classes can reference them in `@BeforeRemove()` lifecycle hooks:

```typescript
// In Project.entity.ts:
@BeforeRemove()
private async removeFile() {
    if (this.elementsFile)
        await getCustomRepository(ProjectFileRepository).remove(this.elementsFile);
}
```

The actual file content management is handled by the `PersistedResource` base class, which each file entity extends:

- `setFileContent(content)` — accepts `Buffer` or `string`, computes an MD5 hash, marks the entity as dirty.
- `getFileContent()` — reads from disk (lazy-loaded and cached in `_fileContent`).
- `filePath` — computed path on disk: `resources/<_path>/<_filename>.<mime-ext>`.
- TypeORM hooks `@AfterInsert` / `@BeforeUpdate` / `@BeforeRemove` handle writing/updating/deleting files on the filesystem.

---

### `ComponentDependencyRepository`

```
src/database/repositories/component-dependency.repository.ts
```

Extends `Repository<ComponentDependency>`.

| Method | Description |
|--------|-------------|
| `getDependencies(component, recursive?)` | Returns the immediate component dependencies. When `recursive=true`, traverses the entire dependency graph via `getRecursiveDependencies`. |
| `getRecursiveDependencies(component, deps?)` | Depth-first traversal of the dependency graph. Uses a `Map<string, Component>` (keyed by entity ID) to avoid infinite loops from circular dependencies. Returns `Component[]` flattened. |
| `getDependents(component)` | Inverse lookup — finds all components that depend on the given component. |

#### Recursive graph traversal pattern

```typescript
public async getRecursiveDependencies(
    component: Component,
    deps = new Map<string, Component>()
): Promise<Map<string, Component>> {
    const dependencies = await this.find({
        where: { dependent: component }
    });

    for (const dependency of dependencies) {
        if (deps.has(dependency.dependency.id))
            continue;                          // already visited
        deps.set(dependency.dependency.id, dependency.dependency);
        deps = await this.getRecursiveDependencies(dependency.dependency, deps);
    }

    return deps;
}
```

The `Map` keyed by entity ID serves as a visited set, preventing infinite recursion. The final result is all unique components in the transitive closure of the dependency relation.

---

### `ProjectDependencyRepository`

```
src/database/repositories/project-dependency.repository.ts
```

Extends `Repository<ProjectDependency>`.

| Method | Description |
|--------|-------------|
| `getDependencies(project, recursive?)` | Returns `Component[]` that a project depends on. When `recursive=true`, first loads the project's direct component dependencies, then delegates to `ComponentDependencyRepository.getRecursiveDependencies` for each to build the full transitive closure. |
| `getDependents(component)` | Inverse lookup — finds all projects that depend on the given component. |

#### Cross-repository delegation

This repository uses `getCustomRepository(ComponentDependencyRepository)` to traverse the component dependency graph from a project dependency context:

```typescript
public async getDependencies(project: Project, recursive = false): Promise<Component[]> {
    const dependencies = await this.find({
        where: { dependent: project }
    });

    if (!recursive)
        return dependencies.map(x => x.dependency);

    let deps = new Map<string, Component>();
    for (const dep of dependencies) {
        if (deps.has(dep.dependency.id))
            continue;
        deps.set(dep.dependency.id, dep.dependency);
        deps = await getCustomRepository(ComponentDependencyRepository)
            .getRecursiveDependencies(dep.dependency, deps);
    }
    return Array.from(deps.values());
}
```

This illustrates that a project depends on components (not other projects), and those components may themselves depend on other components. The full dependency graph is a project -> components -> sub-components tree.

---

### `ShortcutRepository`

```
src/database/repositories/shortcut.repository.ts
```

Extends `Repository<Shortcut>` with no custom methods. Shortcuts are managed as a `OneToMany` relation on the `User` entity and are accessed through the user:

```typescript
await user.shortcuts;  // resolves the Promise<Shortcut[]>
```

All CRUD for shortcuts is handled via the entity's lazy relation.

---

### `ProfilePictureRepository`

```
src/database/repositories/profile-picture.repository.ts
```

Extends `Repository<ProfilePicture>`.

| Method | Description |
|--------|-------------|
| `importFromUrl(url)` | Fetches an image from a remote URL (HTTP GET via `node-fetch`), creates a new `ProfilePicture` entity with the downloaded buffer and the response's `Content-Type` as the MIME type. |

Used by `UserService.findOrCreateGoogleUser()` and `UserService.findOrCreateTwitterUser()` to download and store OAuth provider profile photos:

```typescript
user.image = await this.profilePictureRepo.importFromUrl(profile.photos[0].value);
```

---

## The Cloning Pattern

Cloning a shared project or component involves copying the entity, its circuit file, and all transitive dependencies in a single database transaction. This is implemented in `ShareCloningService`.

### Entry points

- `cloneProject(link, currentUser)` — finds the project by share link, loads all recursive dependencies, calls `cloneProjectTransaction`.
- `cloneComponent(link, currentUser)` — finds the component by share link, loads all recursive dependencies, calls `cloneComponentTransaction`.

### Transaction flow (`cloneProjectTransaction`)

```typescript
@Transaction()
private async cloneProjectTransaction(
    project: Project,
    dependencies: Component[],
    user: User,
    @TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
    @TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
    @TransactionRepository(ComponentDependencyRepository) compDepRepo?: ComponentDependencyRepository,
    @TransactionRepository(ProjectDependencyRepository) projDepRepo?: ProjectDependencyRepository
)
```

1. **Clone all transitive component dependencies**: Each component is cloned via `ComponentRepository.clone()`, which copies all fields including the circuit file. The clone is saved with `forkedFrom` pointing to the original.

2. **Rewrite component dependency edges**: For each cloned component, its `ComponentDependency` edges are recreated to point to the corresponding cloned dependency (looked up by original ID in the `map`).

3. **Clone the project itself**: A new `Project` is created from the original's fields, with `forkedFrom` pointing to the original. A fresh `ProjectFile` is populated with the original's circuit content.

4. **Rewrite project dependency edges**: `ProjectDependency` entries pointing to the original components are recreated pointing to the cloned components.

5. **Return the cloned project**.

The entire operation runs inside `@Transaction()`, so if any step fails, all changes are rolled back.

The `@TransactionRepository()` parameter decorators are the reason repositories need `@EntityRepository()` — TypeORM uses the decorator to locate the correct repository class within the transaction scope.

### Transaction flow (`cloneComponentTransaction`)

Same pattern without the project step: clones all component dependencies, rewrites edges, returns all cloned components.

---

## How Repositories Are Injected

### In controllers (via constructor injection)

```typescript
@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {
    constructor (
        @InjectRepository() private projectRepo: ProjectRepository,
        @InjectRepository() private componentRepo: ComponentRepository,
        @InjectRepository() private projectDepRepo: ProjectDependencyRepository,
        private shareCloningService: ShareCloningService  // regular service, no @InjectRepository
    ) {}
}
```

Services (like `ShareCloningService`) use regular constructor injection — TypeDI resolves them automatically because they are decorated with `@Service()`.

### In services (via constructor injection)

```typescript
@Service()
export class ShareCloningService {
    constructor(
        @InjectRepository() private projectRepo: ProjectRepository,
        @InjectRepository() private componentRepo: ComponentRepository,
        @InjectRepository() private userRepo: UserRepository,
        @InjectRepository() private projectDepRepo: ProjectDependencyRepository,
        @InjectRepository() private compDepRepo: ComponentDependencyRepository
    ) {}
}
```

### In transaction-scoped methods (via `@TransactionRepository`)

```typescript
@Transaction()
private async cloneProjectTransaction(
    project: Project,
    dependencies: Component[],
    user: User,
    @TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
    // ...
)
```

When a `@Transaction()` method is entered, TypeORM creates a new database transaction and provides transaction-scoped repository instances via `@TransactionRepository()`. These are **optional parameters** — they can be `undefined` outside the transaction context.

### Summary of injection decorators

| Decorator | Source | Scope | Purpose |
|-----------|--------|-------|---------|
| `@Service()` | `typedi` | Class-level | Registers the repository in TypeDI's container |
| `@EntityRepository(E)` | `typeorm` | Class-level | Registers the repository in TypeORM |
| `@InjectRepository()` | `typeorm-typedi-extensions` | Constructor parameter | Resolves from TypeDI (needs `@Service()` on the target) |
| `@TransactionRepository(E)` | `typeorm` | Method parameter | Provides a transaction-scoped instance (needs `@EntityRepository()` on the target) |

---

## Non-Obvious Patterns

### 1. Why both `@Service()` and `@EntityRepository()`?

TypeDI and TypeORM maintain separate DI containers. `@Service()` puts the repository in TypeDI's container (used by `@InjectRepository()`). `@EntityRepository()` puts it in TypeORM's container (used by `@TransactionRepository()` and `getCustomRepository()`). Both are required because different consumers use different resolution paths.

### 2. Page size bounds

The `PageableRepository` silently clamps page sizes:
- `pageSize <= 0` → reset to 20 (default)
- `pageSize > 1000` → capped at 1000

Callers are never notified of the clamp — it is a silent adjustment. This prevents both accidental zero-page queries (which would return all rows) and abusive large-page queries (which could be a DoS vector).

### 3. `getCustomRepository()` for cross-entity lifecycle hooks

Entity `@BeforeRemove()` hooks use `getCustomRepository()` to access repositories within lifecycle callbacks. This is necessary because entities are not managed by TypeDI and cannot use DI:

```typescript
// In User.entity.ts:
@BeforeRemove()
private async removeFile() {
    return Promise.all([
        getCustomRepository(ProjectRepository).remove(await this.projects),
        getCustomRepository(ComponentRepository).remove(await this.components),
        // ...
    ]);
}
```

### 4. `Promise.resolve()` for lazy relation assignment

All `ManyToOne` and `OneToMany` relations on entities are declared as `Promise<RelatedEntity>` (lazy loading). When assigning these in factory methods, the pattern is:

```typescript
project.user = Promise.resolve(user);
```

rather than:

```typescript
project.user = user;  // type error: Promise<User> vs User
```

This is because TypeORM lazy relations expect a Promise wrapper. Eager relations (`@OneToOne({ eager: true })` like `elementsFile`) are assigned directly as entity instances.

### 5. The Project ↔ Component dual nature in dependency routing

Both `ComponentDependencyRepository` and `ProjectDependencyRepository` implement `getDependencies()` and `getDependents()`, but they operate at different levels:
- Projects depend on **components** (via `ProjectDependencyRepository`).
- Components depend on **other components** (via `ComponentDependencyRepository`).

The `ShareCloningService` bridges the two: when cloning a project, it first clones all transitive component dependencies (using `ComponentDependencyRepository.getRecursiveDependencies`), then clones the project and rewrites its `ProjectDependency` edges to the newly cloned components.

### 6. `ComponentRepository.clone()` preserves timestamps

Unlike the factory methods (`createComponentForUser`), `clone()` copies `createdOn` from the original:

```typescript
cloned.createdOn = component.createdOn;
```

This is intentional — when a user forks a component, they see the original creation date, not the fork date. The `lastEdited` column is handled by `@UpdateDateColumn` and will reflect the actual save time.

### 7. No custom `findByEmail` on `UserRepository`

Despite being a common need, `findByEmail` is not factored into a separate repository method. All email lookups use the inherited `findOne({ where: { email } })` inline in the service layer. This is a deliberate simplicity choice — the query is straightforward and the service layer adds contextual error handling (e.g., `FormDataError` with field-level error details) that would be lost if abstracted into the repository.

### 8. The `User` entity's `@Check` constraint

```typescript
@Check(`(login_type = 'local' and password is not null) or (login_type != 'local')`)
```

This SQL CHECK constraint enforces at the database level that local authentication users must have a password set. Note that while the constraint references `login_type`, the `User` entity does not have a `login_type` column — the strategy is inferred from which authentication fields are populated (`googleUserId`, `twitterUserId`, or `password`). The check constraint applies to the underlying MySQL column (which exists in the schema even if not mapped in the TypeScript entity).
