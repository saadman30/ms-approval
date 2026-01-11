# API Gateway

The API Gateway provides:
- Request routing to appropriate services
- Token validation (synchronous call to Identity Service)
- Token caching (5 minute TTL)
- Correlation ID injection
- CORS handling
- Rate limiting (TODO)

## Implementation

The gateway is built with Node.js/Express and uses `http-proxy-middleware` for routing. Token validation results are cached for 5 minutes to reduce load on the Identity Service.

## Routes

- `/auth/*` - Identity Service (public)
- `/orgs/*` - Organization Service (authenticated)
- `/workflow/*` - Workflow Service (authenticated)
- `/billing/*` - Billing Service (authenticated)
- `/notifications/*` - Notification Service (authenticated)
- `/audit/*` - Audit Service (authenticated)
- `/analytics/*` - Analytics Service (authenticated)

## Running

```bash
npm install
npm run build
npm start
```

Or with Docker:

```bash
docker build -t api-gateway .
docker run -p 8080:8080 api-gateway
```

## Environment Variables

- `PORT` - Gateway port (default: 8080)
- `IDENTITY_SERVICE_URL` - Identity service URL (default: http://localhost:3001)
- `ORGANIZATION_SERVICE_URL` - Organization service URL (default: http://localhost:3002)
- `WORKFLOW_SERVICE_URL` - Workflow service URL (default: http://localhost:3003)
- `BILLING_SERVICE_URL` - Billing service URL (default: http://localhost:3004)
- `NOTIFICATION_SERVICE_URL` - Notification service URL (default: http://localhost:3005)
- `AUDIT_SERVICE_URL` - Audit service URL (default: http://localhost:3006)
- `ANALYTICS_SERVICE_URL` - Analytics service URL (default: http://localhost:3007)
