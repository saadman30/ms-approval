FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../packages/observability/package.json ./packages/observability/

# Install dependencies
RUN npm install --workspace=packages/observability

# Copy source code
COPY ../../packages/observability/ ./packages/observability/
COPY . .

# Build
RUN npm run build

# Production image
FROM node:25-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 8080

CMD ["node", "dist/index.js"]
