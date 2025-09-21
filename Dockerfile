FROM node:18-alpine AS builder

LABEL maintainer="Universal Signal Bot Team"
LABEL description="Cryptocurrency Trading Signal Bot"
LABEL version="2.0.0"

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY ./prisma ./prisma

RUN npm ci && \
    npm cache clean --force

COPY src/ ./src/

RUN npm run build

FROM node:18-alpine AS production

RUN apk add --no-cache \
    dumb-init \
    tzdata && \
    addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

WORKDIR /app
RUN mkdir -p logs data signals backtest-results && \
    chown -R botuser:nodejs /app

COPY --from=builder --chown=botuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=botuser:nodejs /app/dist ./dist
COPY --from=builder --chown=botuser:nodejs /app/package*.json ./
COPY --from=builder --chown=botuser:nodejs /app/prisma ./prisma

COPY --chown=botuser:nodejs .env.example ./.env

ENV NODE_ENV=production
ENV TZ=UTC
ENV LOG_LEVEL=info
ENV LOG_FILE=/app/logs/bot.log

EXPOSE 3000
USER botuser

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js", "start", "--daemon"]
