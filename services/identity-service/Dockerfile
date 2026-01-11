FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/events/package.json ./packages/events/
COPY packages/observability/package.json ./packages/observability/
COPY services/identity-service/package.json ./services/identity-service/

# Install dependencies
RUN npm install --workspace=packages/events --workspace=packages/observability --workspace=services/identity-service

# Copy source code
COPY packages/ ./packages/
COPY services/identity-service/ ./services/identity-service/

# Build
WORKDIR /app/services/identity-service
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built packages
COPY --from=builder /app/packages/events/dist ./packages/events/dist
COPY --from=builder /app/packages/events/package.json ./packages/events/
COPY --from=builder /app/packages/observability/dist ./packages/observability/dist
COPY --from=builder /app/packages/observability/package.json ./packages/observability/
COPY --from=builder /app/node_modules ./node_modules

# Copy built service
COPY --from=builder /app/services/identity-service/dist ./services/identity-service/dist
COPY --from=builder /app/services/identity-service/package.json ./services/identity-service/
COPY --from=builder /app/services/identity-service/src/migrations ./services/identity-service/src/migrations

WORKDIR /app/services/identity-service

EXPOSE 3001

CMD ["node", "dist/index.js"]
