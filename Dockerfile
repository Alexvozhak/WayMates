# Shared base
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Core для тестов (нужен СЕЙЧАС)
FROM base AS core-test
ENV NODE_ENV=test
CMD ["npx", "tsx", "src/core/index.ts"]

# Core для production (будущее - SaaS)
FROM base AS core-production
ENV NODE_ENV=production
RUN npm prune --production
CMD ["npx", "tsx", "src/core/index.ts"]

# Facade для production (будущее - SaaS)
FROM base AS facade-production
ENV NODE_ENV=production
RUN npm prune --production
CMD ["npx", "tsx", "src/facade/index.ts"]
