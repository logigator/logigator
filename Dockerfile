FROM node:20 AS backend
WORKDIR /app

COPY ["./logigator-backend/.yarn", "./.yarn"]
COPY ["./logigator-backend/package.json", "./logigator-backend/yarn.lock", "./logigator-backend/.yarnrc.yml", "./"]
RUN corepack enable && yarn install --immutable --inline-builds

COPY ["./logigator-backend", "./"]
RUN yarn build
RUN yarn migration:build

# ======================================================================================= #

FROM node:20 AS editor
WORKDIR /app

COPY ["./logigator-editor/.yarn", "./.yarn"]
COPY ["./logigator-editor/package.json", "./logigator-editor/yarn.lock", "./logigator-editor/.yarnrc.yml", "./"]
RUN corepack enable && yarn install --immutable --inline-builds

COPY ["./logigator-editor", "./"]
RUN yarn build

# ======================================================================================= #

FROM node:20-alpine
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

COPY ["./logigator-backend/.yarn", "./.yarn"]
COPY ["./logigator-backend/package.json", "./logigator-backend/yarn.lock", "./logigator-backend/.yarnrc.yml", "./"]
RUN --mount=type=bind,from=backend,source=/app/.yarn/cache,target=./.yarn/cache corepack enable && yarn workspaces focus --all --production

COPY --from=backend ["/app/dist", "./dist"]
COPY --from=backend ["/app/config", "./config"]
COPY --from=backend ["/app/resources", "./resources"]
COPY --from=backend ["/app/tools", "./tools"]
COPY --from=backend ["/app/migration", "./migration"]
COPY --from=editor ["/app/dist/logigator-editor/browser", "./resources/editor"]
