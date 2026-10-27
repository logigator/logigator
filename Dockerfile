FROM node:24 AS workspace
WORKDIR /app
RUN corepack enable

# Every application is a Yarn/Angular workspace member compiling @logigator/ui,
# @logigator/core, @logigator/contract and @logigator/docs from source via
# tsconfig path mapping, so they share one install and the shared sources;
# each build stage below adds only its own package. Manifests are copied
# first for a cached install — every member's manifest, since the immutable
# install validates the whole workspace against the lockfile.
COPY ["./package.json", "./yarn.lock", "./.yarnrc.yml", "./"]
COPY ["./logigator-ui/package.json", "./logigator-ui/"]
COPY ["./logigator-core/package.json", "./logigator-core/"]
COPY ["./logigator-contract/package.json", "./logigator-contract/"]
COPY ["./logigator-docs/package.json", "./logigator-docs/"]
COPY ["./logigator-api/package.json", "./logigator-api/"]
COPY ["./logigator-editor/package.json", "./logigator-editor/"]
COPY ["./logigator-web/package.json", "./logigator-web/"]
# @angular/router is a file: dependency whose lockfile hash covers the whole
# stub dir, so it must be copied in full (not package.json-only) for the
# immutable install to reproduce the pinned hash.
COPY ["./logigator-editor/packages/router-stub", "./logigator-editor/packages/router-stub/"]
# pixi.js resolves through a local patch (see logigator-editor/docs/rendering.md),
# which the lockfile names by path.
COPY ["./.yarn/patches", "./.yarn/patches/"]
# Yarn's download cache is a cache mount rather than part of the layer: a
# release bumps the root manifest's version, which reruns this step every time,
# and the mount keeps the archives it would otherwise fetch again. Both install
# steps share it, one at a time.
RUN --mount=type=cache,id=yarn-cache,target=/app/.yarn/cache,sharing=locked \
	yarn install --immutable --inline-builds

COPY ["./angular.json", "./tsconfig.json", "./"]
COPY ["./logigator-ui", "./logigator-ui/"]
COPY ["./logigator-core", "./logigator-core/"]
COPY ["./logigator-contract", "./logigator-contract/"]
COPY ["./logigator-docs", "./logigator-docs/"]
COPY ["./CHANGELOG.md", "./"]
COPY ["./changelog", "./changelog/"]

# ======================================================================================= #

FROM workspace AS editor-build
COPY ["./logigator-editor", "./logigator-editor/"]

# Version stamping for the About dialog. Empty args fall back to the angular.json
# defaults (empty strings), so the build works without them. Declared here so a
# version bump doesn't invalidate the cached install layer above.
ARG GIT_COMMIT=""
ARG BUILD_DATE=""
RUN yarn ng build logigator-editor \
	--define "GIT_COMMIT='${GIT_COMMIT}'" \
	--define "BUILD_DATE='${BUILD_DATE}'"

# ======================================================================================= #

FROM workspace AS web-build
COPY ["./logigator-web", "./logigator-web/"]

ARG GIT_COMMIT=""
ARG BUILD_DATE=""
RUN yarn ng build logigator-web \
	--define "GIT_COMMIT='${GIT_COMMIT}'" \
	--define "BUILD_DATE='${BUILD_DATE}'"

# ======================================================================================= #

FROM workspace AS api-build
COPY ["./logigator-api", "./logigator-api/"]

# Reach the build as environment variables, which rspack.config.mjs defines
# into the bundle for `GET /api/meta`.
ARG GIT_COMMIT=""
ARG BUILD_DATE=""
RUN yarn build:api

# ======================================================================================= #

# The website's server. Its bundle inlines every dependency, so the image needs
# nothing beyond the build output.
FROM node:24-slim AS web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000/tcp

COPY --from=web-build ["/app/dist/logigator-web", "./dist/logigator-web"]

USER node
CMD ["node", "--enable-source-maps", "dist/logigator-web/server/server.mjs"]

# ======================================================================================= #

# The API, together with its one-shot entries (`migrate.js`, `seed-examples.js`,
# `renormalize.js`). The bundle inlines the shared packages and leaves every
# real dependency external, so the image carries the API's production
# dependencies alone, installed where Node resolves them from `dist/`.
FROM node:24-slim AS api
WORKDIR /app
RUN corepack enable

# sharp runs libvips on a single thread under glibc's allocator, which fragments
# in a long-running multi-threaded process; under jemalloc it uses every core.
# The library lives under the architecture's multiarch directory, so a fixed
# link is what LD_PRELOAD names. A preload that resolves to nothing only warns
# and runs without it, so a dangling link fails the build instead.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libjemalloc2 \
	&& rm -rf /var/lib/apt/lists/* \
	&& ln -s "/usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2" /usr/local/lib/libjemalloc.so.2 \
	&& test -e /usr/local/lib/libjemalloc.so.2
ENV LD_PRELOAD=/usr/local/lib/libjemalloc.so.2

# `migrate.js` dumps the database before it applies a migration. pg_dump refuses
# a server of a newer major version, and Debian's own client is older than the
# production compose file's `postgres:18`, so the client comes from PostgreSQL's
# repository; its major moves with that image's. apt reads the key as `_apt`,
# hence the mode.
ADD --chmod=644 --checksum=sha256:0144068502a1eddd2a0280ede10ef607d1ec592ce819940991203941564e8e76 \
	https://www.postgresql.org/media/keys/ACCC4CF8.asc /usr/share/keyrings/pgdg.asc
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& . /etc/os-release \
	&& echo "deb [signed-by=/usr/share/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
		> /etc/apt/sources.list.d/pgdg.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends postgresql-client-18 \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage
EXPOSE 3000/tcp

COPY ["./package.json", "./yarn.lock", "./.yarnrc.yml", "./"]
COPY ["./logigator-ui/package.json", "./logigator-ui/"]
COPY ["./logigator-core/package.json", "./logigator-core/"]
COPY ["./logigator-contract/package.json", "./logigator-contract/"]
COPY ["./logigator-docs/package.json", "./logigator-docs/"]
COPY ["./logigator-api/package.json", "./logigator-api/"]
COPY ["./logigator-editor/package.json", "./logigator-editor/"]
COPY ["./logigator-web/package.json", "./logigator-web/"]
COPY ["./logigator-editor/packages/router-stub", "./logigator-editor/packages/router-stub/"]
COPY ["./.yarn/patches", "./.yarn/patches/"]
RUN --mount=type=cache,id=yarn-cache,target=/app/.yarn/cache,sharing=locked \
	yarn workspaces focus logigator-api --production

COPY --from=api-build ["/app/dist/logigator-api", "./dist/logigator-api"]

# A named volume mounted here starts out with this directory's owner, which is
# what lets the unprivileged process write to it.
RUN mkdir -p /data/storage /data/backups \
	&& chown node:node /data/storage /data/backups

USER node
CMD ["node", "--enable-source-maps", "dist/logigator-api/main.js"]

# ======================================================================================= #

# The origin, Caddy carrying the Caddyfile and the editor's static bundle,
# which it serves itself.
FROM caddy:2-alpine AS origin
COPY ["./Caddyfile", "/etc/caddy/Caddyfile"]
COPY --from=editor-build ["/app/dist/logigator-editor/browser", "/srv/editor"]

