# Contributing to Logigator

Thanks for helping make Logigator better. Bug reports, ideas, translations and pull requests are
all welcome. This page explains how to get a change from your machine into the project.

- [Reporting a bug or suggesting a feature](#reporting-a-bug-or-suggesting-a-feature)
- [Before you start on a change](#before-you-start-on-a-change)
- [Setting up](#setting-up)
- [Making a change](#making-a-change)
- [Opening a pull request](#opening-a-pull-request)
- [Translations](#translations)
- [Licensing](#licensing)

## Reporting a bug or suggesting a feature

Open an [issue](https://github.com/logigator/logigator/issues/new/choose) and pick the form that
fits. For a bug, the most useful thing you can attach is a way to reproduce it: the steps, and if
it involves a circuit, the circuit itself (export it as a file, or share a link to it).

Search the existing issues first; if yours is already there, a 👍 or a comment with new detail
helps more than a duplicate.

**Security issues are the exception**: never report them in a public issue. See
[`SECURITY.md`](SECURITY.md).

## Before you start on a change

- **Small fixes** (a typo, an obvious bug, a missing translation) can go straight to a pull request.
- **Anything larger** (a new feature, a new component, a change to how something behaves, a
  refactor) should start as an issue, so we can agree on the approach before you spend time on it.
  A pull request for a feature nobody discussed may be declined even if the code is good.
- Issues labelled
  [`help wanted`](https://github.com/logigator/logigator/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
  are a good place to start. Comment on one before you begin, so two people don't work on the same
  thing.

`logigator-editor-legacy/` and `logigator-backend/` hold the previous editor and backend. They are
kept for reference only and don't take changes.

## Setting up

The development stack runs in Docker; follow
[Running it locally](README.md#running-it-locally) in the README. Once
<https://logigator.test> opens, every app reloads as you edit its source.

Run every command from the repository root, inside a container:

```sh
docker compose exec editor yarn <command>
```

To work without Docker for the apps themselves, you need Node 24 with
[corepack](https://nodejs.org/api/corepack.html) enabled (`corepack enable`); the repository pins
its Yarn version. Postgres and Redis still come from `docker compose up postgres redis`.

To find your way around, [`CLAUDE.md`](CLAUDE.md) maps the repository and the rules that span
packages, and [`logigator-editor/docs/`](logigator-editor/docs) has one page per part of the
editor. Read the page for the part you're changing first: many files explain their reasoning in
comments, and those rules are usually load-bearing.

## Making a change

**Branch off `master`**, where all development happens; releases are tags on it.

```sh
git switch master
git switch -c fix/short-description
```

- **One concern per pull request.** A bug fix and an unrelated cleanup are two pull requests.
- **Add or update tests** for behavior you change. Specs sit next to the source they test
  (`*.spec.ts`). A good test states something that must stay true; a test that only repeats the
  implementation, or checks a label or a CSS class, adds little.
- **Match the code around you**: its naming, its comment density, its idioms. Comments describe
  what the code does and why, in the present tense.
- **Every user-facing string goes through the translation files**, never as literal text in a
  template (see [Translations](#translations)).
- **Leave the changelog alone.** `CHANGELOG.md` and `changelog/` are written by the maintainer at
  release time. Describe the user-visible effect in your pull request instead.

Before you push, run:

```sh
yarn lint          # ESLint (yarn lint:fix fixes what it can)
yarn format        # Prettier (yarn format:fix writes the fixes)
yarn typecheck     # TypeScript for core, contract, docs and the API
yarn test          # every package's tests
```

A bare command runs for every package; `yarn test:editor`, `yarn test:api` and so on run one. For a
single editor spec: `yarn test:editor --include='**/some.spec.ts'`.

If you change the API, also run its end-to-end suite, which needs the stack's Postgres and Redis:

```sh
docker compose exec \
  -e DATABASE_URL=postgresql://logigator:logigator@postgres:5432/logigator \
  -e REDIS_URL=redis://redis:6379 \
  api yarn test:e2e:api
```

A change to the database schema needs a migration: edit the Drizzle schema in
`logigator-api/src/database/schema/`, then generate the SQL with
`yarn workspace logigator-api run db:generate` and commit it along with the schema change.

### Commit messages

Start the subject line with the area it touches in brackets, then say what the commit does in the
present tense:

```
[editor] keep the selection when a rotated group is pasted

An optional body says why, when the subject alone doesn't make it obvious.
```

The areas in use are `[editor]`, `[web]`, `[api]`, `[ui]`, `[core]`, `[contract]`, `[docs]`,
`[screenshots]` and `[workspace]` (tooling, CI, dependencies, anything repository-wide).

## Opening a pull request

1. Push your branch to your fork and open a pull request against `master`.
2. In the description, say what the change does and why, link the issue (`Closes #123`), and add
   screenshots or a short recording for anything visual.
3. CI runs lint, format, type checks, tests and builds for every package you touched. A pull request
   is merged only once it's green.
4. A maintainer reviews it. Expect questions and requests for changes; that's normal and not a
   rejection. Push follow-up commits to the same branch rather than opening a new pull request.

## Translations

Logigator speaks English, German, French and Spanish, and fixes to any of them are very welcome. No
setup beyond a text editor is needed for most of these.

| What                | Where                                         |
| ------------------- | --------------------------------------------- |
| Editor interface    | `logigator-editor/src/i18n/<lang>.ts`         |
| Website interface   | `logigator-web/src/i18n/<lang>.ts`            |
| Documentation pages | `logigator-docs/src/pages/<lang>/` (markdown) |

English (`en`) is the source; every other language has the same keys, and a missing or extra key
fails the build. If you add a string, add it in all four languages. If you can't translate one,
copy the English text and say so in the pull request, and it'll be translated before the next
release.

## Licensing

Logigator is licensed under the [GNU Affero General Public License v3.0](LICENSE). By opening a
pull request, you agree that your contribution is licensed under the same terms.
