# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app

ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown

ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}

# Non-root
RUN addgroup -S app && adduser -S app -G app
USER app

# Copy only required output
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/prisma ./prisma

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
