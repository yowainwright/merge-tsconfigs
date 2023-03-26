# syntax=docker/dockerfile:1

ARG BUILDKIT_INLINE_CACHE="0"

FROM node:18-alpine
WORKDIR /src
COPY package.json .
RUN npm install -g pnpm
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "build"]
