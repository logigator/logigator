FROM node:24 AS backend
WORKDIR /app

COPY ["./logigator-backend/package.json", "./logigator-backend/yarn.lock", "./logigator-backend/.yarnrc.yml", "./"]
RUN corepack enable && yarn install --immutable --inline-builds

COPY ["./logigator-backend", "./"]
RUN yarn build
RUN yarn migration:build

# ======================================================================================= #

FROM node:24 AS editor
WORKDIR /app
RUN corepack enable

# The new editor is a Yarn/Angular workspace member: it compiles @logigator/ui
# from source via tsconfig path mapping, so the whole workspace is built here,
# not just logigator-editor/. Manifests are copied first for a cached install.
COPY ["./package.json", "./yarn.lock", "./.yarnrc.yml", "./"]
COPY ["./logigator-ui/package.json", "./logigator-ui/"]
COPY ["./logigator-editor/package.json", "./logigator-editor/"]
# @angular/router is a file: dependency whose lockfile hash covers the whole
# stub dir, so it must be copied in full (not package.json-only) for the
# immutable install to reproduce the pinned hash.
COPY ["./logigator-editor/packages/router-stub", "./logigator-editor/packages/router-stub/"]
RUN yarn install --immutable --inline-builds

COPY ["./angular.json", "./tsconfig.json", "./"]
COPY ["./logigator-ui", "./logigator-ui/"]
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

FROM node:20 AS editor-legacy
WORKDIR /app

COPY ["./logigator-editor-legacy/package.json", "./logigator-editor-legacy/yarn.lock", "./logigator-editor-legacy/.yarnrc.yml", "./"]
RUN corepack enable && yarn install --immutable --inline-builds

COPY ["./logigator-editor-legacy", "./"]
RUN yarn build

# ======================================================================================= #

FROM node:24-alpine
LABEL org.opencontainers.image.authors="andreas.sch4@gmail.com"
LABEL org.opencontainers.image.description="Logigator"
WORKDIR /app
EXPOSE 3000/tcp
VOLUME ["/app/config"]
VOLUME ["/app/resources/private/components"]
VOLUME ["/app/resources/private/projects"]
VOLUME ["/app/resources/public/preview"]
VOLUME ["/app/resources/public/profile"]

ENTRYPOINT ["/etc/entrypoint.sh"]
COPY ./entrypoint.sh /etc/entrypoint.sh
RUN chmod +x /etc/entrypoint.sh

COPY ["./logigator-backend/package.json", "./logigator-backend/yarn.lock", "./logigator-backend/.yarnrc.yml", "./"]
RUN --mount=type=bind,from=backend,source=/app/.yarn,target=./.yarn,rw corepack enable && yarn workspaces focus --all --production

COPY --from=backend ["/app/dist", "./dist"]
COPY --from=backend ["/app/config", "./config"]
COPY --from=backend ["/app/resources", "./resources"]
COPY --from=backend ["/app/tools", "./tools"]
COPY --from=backend ["/app/migration", "./migration"]
COPY --from=editor ["/app/dist/logigator-editor/browser", "./resources/editor"]
COPY --from=editor-legacy ["/app/dist/logigator-editor/browser", "./resources/legacy-editor"]
