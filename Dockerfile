# syntax=docker/dockerfile:1.7
# Two images from one build: `web`, the Next.js server, small and self-contained;
# `tools`, the source with every dependency, for the realtime server and the
# operator's commands, run as `node --import tsx cli/<command>.ts`.

FROM node:24.13.0-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY site/package.json site/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:24.13.0-slim AS web
ARG COMMIT_SHA
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 COMMIT_SHA=$COMMIT_SHA
WORKDIR /app
COPY --from=build --chown=node /app/.next/standalone ./
COPY --from=build --chown=node /app/.next/static ./.next/static
COPY --from=build --chown=node /app/public ./public
# Read at run time: the customer, the rules, the knowledge base, the defaults.
COPY --from=build --chown=node /app/content ./content
# The node user, by number, so a cluster can tell it is not root.
USER 1000
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS tools
ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA
COPY . .
USER 1000
CMD ["node", "--import", "tsx", "realtime/server.ts"]
