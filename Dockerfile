FROM node:22-alpine AS base

# Install dependencies needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS runner

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built app and dependencies from build stage
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig.json ./tsconfig.json

# Create data directory (fallback if no volume mounted)
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Seed the database if it doesn't exist, then start the app
CMD sh -c "npx tsx scripts/seed.ts && npm run start"
