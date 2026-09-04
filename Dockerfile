# Production image for Prestige MD backend (Express + Prisma).

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Prisma postinstall needs DATABASE_URL to load prisma.config.ts.
ARG PRISMA_BUILD_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/prestige_md_build"
RUN DATABASE_URL="$PRISMA_BUILD_DATABASE_URL" pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@10
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG PRISMA_BUILD_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/prestige_md_build"
RUN DATABASE_URL="$PRISMA_BUILD_DATABASE_URL" pnpm exec prisma generate
RUN DATABASE_URL="$PRISMA_BUILD_DATABASE_URL" pnpm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT_NO=5000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 expressjs

COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=expressjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=expressjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=expressjs:nodejs /app/src/generated ./src/generated

USER expressjs
EXPOSE 5000

CMD ["node", "dist/server.js"]
