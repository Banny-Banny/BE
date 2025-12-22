# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify dist folder exists
RUN ls -la dist/

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Verify dist folder in production stage
RUN ls -la && ls -la dist/

# Expose port (Railway will override this with PORT env var)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]

