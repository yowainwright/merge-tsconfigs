# syntax=docker/dockerfile:1

FROM node:26-alpine
WORKDIR /src
COPY package.json pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
CMD ["pnpm", "run", "build"]
