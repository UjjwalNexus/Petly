FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Remove dev dependencies if any
RUN npm prune --production

FROM node:18-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nextjs:nodejs /app .

# Create necessary directories
RUN mkdir -p logs uploads
RUN chown -R nextjs:nodejs logs uploads

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (r) => {if (r.statusCode !== 200) throw new Error()})"

EXPOSE 3000

CMD ["node", "server.js"]