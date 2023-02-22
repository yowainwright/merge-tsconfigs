# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /src
COPY package.json .
RUN npm install -g pnpm
RUN pnpm install
COPY . .
CMD ["pnpm", "run", "build"]
