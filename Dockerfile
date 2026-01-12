# Shared base
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:chart

# Core для тестов (нужен СЕЙЧАС)
FROM base AS core-test
ENV NODE_ENV=test
CMD ["npx", "tsx", "src/core/index.ts"]

# Facade для тестов (HTTP MCP Server)
FROM base AS facade-test
ENV NODE_ENV=test
ENV FACADE_TRANSPORT=http
CMD ["npx", "tsx", "src/facade/index.ts"]

# Telegram Bot для тестов
FROM base AS telegram-bot-test
ENV NODE_ENV=test
CMD ["npx", "tsx", "src/telegram-bot/index.ts"]

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
