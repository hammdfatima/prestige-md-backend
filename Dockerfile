# Development image for Revive Mind backend (Express + Prisma).
# Runs nodemon / ts-node — not a compiled production start.
# Provide env on the instance via `backend.env` (loaded by src/env.ts).

FROM node:22-alpine

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Prisma postinstall needs DATABASE_URL to load prisma.config.ts.
# Pass only for install/generate — do not bake into the image ENV.
ARG PRISMA_BUILD_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/revive_mind_build"

RUN DATABASE_URL="$PRISMA_BUILD_DATABASE_URL" pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL="$PRISMA_BUILD_DATABASE_URL" pnpm exec prisma generate

ENV NODE_ENV=development
ENV PORT_NO=5000

EXPOSE 5000

CMD ["pnpm", "run", "dev"]
