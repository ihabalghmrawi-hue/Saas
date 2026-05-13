FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY --chown=nextjs:nodejs . .

USER nextjs

CMD ["node", "scripts/cron.js"]
