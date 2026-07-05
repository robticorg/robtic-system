FROM oven/bun:1.3.14 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY images ./images

CMD ["bun", "--preload", "./src/preload.ts", "src/index.ts"]