# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
ENV NODE_ENV=development

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install ALL deps (needed for migrations with ts-node)
COPY package.json package-lock.json ./
RUN npm ci

# Copy built output and source files needed for migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["sh", "-c", "npm run migration:run && node dist/src/main"]

