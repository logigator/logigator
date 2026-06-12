# logigator-backend

Node.js/Express server for the Logigator platform — REST API, server-rendered pages, authentication, and file storage.

## Stack

Express • routing-controllers • TypeDI • TypeORM • Passport.js • Handlebars • Redis • MySQL

## Getting Started

```bash
docker compose up   # starts backend, editor, MySQL, Redis, Apache proxy
# Add to /etc/hosts: 127.0.0.1 logigator.test
```

Backend config files must be created from `.example` files in `config/`:
```bash
cp config/environment.json.example config/environment.json
cp config/domains.json.example config/domains.json
# ... etc.
```

## Commands

All commands run via Docker:

```bash
docker compose exec backend yarn build                              # tsc + Gulp asset pipeline
docker compose exec backend yarn lint:backend                       # ESLint on src/
docker compose exec backend yarn migration:run                      # run pending TypeORM migrations
docker compose exec backend yarn migration:generate -- -n Name      # generate migration
```

## Documentation

Detailed technical documentation is in [`docs/`](docs/):

| File | Topic |
|------|-------|
| [architecture.md](docs/architecture.md) | DI container, bootstrap sequence, module layout, dual JSON/HTML response architecture |
| [controllers.md](docs/controllers.md) | `@JsonController` vs `@Controller`, decorator-driven routing, serialization groups, AJAX fragments |
| [server-side-rendering.md](docs/server-side-rendering.md) | Handlebars engine, layouts/partials/views, 17 custom helpers, `StandaloneViewService` for emails |
| [form-validation.md](docs/form-validation.md) | `class-validator` DTOs, `FormDataError` → session flash pipeline, client-side JS mirroring |
| [i18n.md](docs/i18n.md) | 4-language translation system, URL prefix routing, SEO hreflang alternates |
| [entities.md](docs/entities.md) | TypeORM entities, `@Exclude`/`@Expose` patterns, lazy relations, lifecycle hooks |
| [repositories.md](docs/repositories.md) | `PageableRepository<T>`, pagination convention, ownership queries, cloning |
| [authentication.md](docs/authentication.md) | Passport.js (local + Google + Twitter OAuth), Redis sessions, guards, cookies |
| [middleware.md](docs/middleware.md) | Global middleware chain, action middleware, error handler, language prefix routing |
| [services.md](docs/services.md) | TypeDI singletons: config, Redis, email, translation, user management, cloning |
| [file-storage.md](docs/file-storage.md) | `PersistedResource` entity, MD5 change detection, cache-busting filenames |
| [build-system.md](docs/build-system.md) | TypeScript compilation, Gulp SCSS/JS pipeline, dual ES2015/ES5 bundles |
| [configuration.md](docs/configuration.md) | `.json` / `.json.example` convention, all 7 config files |
