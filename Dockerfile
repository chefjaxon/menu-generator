FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/tsconfig.json ./tsconfig.json
COPY --from=base /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && npx prisma db seed && npm run start"
