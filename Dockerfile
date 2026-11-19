FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# prisma.config.ts exige DATABASE_URL incluso para generar el cliente; el valor real llega en runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
