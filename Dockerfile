FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:24.19.0-bookworm-slim AS production
WORKDIR /app
ARG APP_VERSION=local
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
