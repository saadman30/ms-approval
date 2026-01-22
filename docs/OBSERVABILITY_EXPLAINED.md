# Observability Explained: A Complete Guide

## Table of Contents
1. [What is Observability?](#what-is-observability)
2. [The Three Pillars of Observability](#the-three-pillars-of-observability)
3. [Logging with Loki](#logging-with-loki)
4. [Metrics with Prometheus](#metrics-with-prometheus)
5. [Tracing with OpenTelemetry](#tracing-with-opentelemetry)
6. [How They Work Together](#how-they-work-together)
7. [Technology Alternatives](#technology-alternatives)
8. [Implementation in This Project](#implementation-in-this-project)
9. [Practical Examples](#practical-examples)
10. [Best Practices](#best-practices)

---

## What is Observability?

**Observability** is the ability to understand what's happening inside your system by examining its outputs. Think of it like a car's dashboard: you can't see the engine directly, but you can monitor speed, fuel level, temperature, and warning lights to understand the car's state.

In microservices, observability is critical because:
- **Services are distributed**: A single user request might touch 5-7 services
- **Failures are complex**: An error in Service A might cause a problem in Service B
- **Debugging is hard**: You can't just add a breakpoint and step through code
- **Performance matters**: Slow services affect the entire user experience

### Observability vs. Monitoring

- **Monitoring**: You know what to look for (CPU usage, error rates)
- **Observability**: You can ask questions you didn't know to ask (Why did this user's request fail? What happened between these two services?)

Observability enables you to explore and discover issues, not just alert on known problems.

---

## The Three Pillars of Observability

Observability is built on three pillars:

### 1. **Logs** - "What happened?"
- **Purpose**: Record discrete events with context
- **Example**: "User logged in at 2:34 PM with IP 192.168.1.1"
- **Use case**: Debugging specific errors, auditing actions
- **Format**: Structured JSON (not plain text!)

### 2. **Metrics** - "How many? How fast?"
- **Purpose**: Numerical measurements over time
- **Example**: "500 requests per second, 2% error rate"
- **Use case**: Alerting, capacity planning, performance monitoring
- **Format**: Time-series data (value at timestamp)

### 3. **Traces** - "What path did this request take?"
- **Purpose**: Follow a request across multiple services
- **Example**: "Request started in API Gateway → Identity Service → Organization Service → Workflow Service"
- **Use case**: Understanding latency, finding bottlenecks
- **Format**: Distributed trace with spans

### Why All Three?

Each pillar answers different questions:

| Question | Logs | Metrics | Traces |
|----------|------|---------|--------|
| "Why did this user's request fail?" | ✅ | ❌ | ✅ |
| "Is our system healthy?" | ❌ | ✅ | ❌ |
| "Which service is slow?" | ❌ | ✅ | ✅ |
| "What did this user do?" | ✅ | ❌ | ✅ |
| "How many requests per second?" | ❌ | ✅ | ❌ |

You need all three to have complete observability.

---

## Logging with Loki

### What is Loki?

**Loki** is a log aggregation system designed by Grafana Labs. It's like a search engine for logs across all your services.

### Why Loki?

**Traditional Approach (ELK Stack)**:
```
Application → Logstash → Elasticsearch → Kibana
```
- Stores full log text
- Indexes everything (expensive)
- Requires lots of storage
- Complex to operate

**Loki's Approach**:
```
Application → Loki → Grafana
```
- Stores only log labels (metadata)
- Doesn't index log content
- Uses object storage (cheaper)
- Simpler architecture

### How Loki Works

1. **Log Ingestion**: Services send logs to Loki via HTTP or gRPC
2. **Label Extraction**: Loki extracts labels (service name, level, etc.) from log structure
3. **Storage**: Logs stored in chunks, labels stored in index
4. **Querying**: You query by labels, then search within matching logs

**Example Log**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "error",
  "service": "identity-service",
  "correlationId": "abc-123",
  "message": "Authentication failed",
  "userId": "user-456"
}
```

Loki extracts labels: `service=identity-service`, `level=error`

**Query Example**:
```
{service="identity-service"} |= "Authentication failed"
```
Translation: "Find logs from identity-service containing 'Authentication failed'"

### Key Concepts

**Labels**: Key-value pairs used for filtering (service, level, environment)
**Stream**: All logs with the same label combination
**Chunk**: Compressed log data stored together
**Query LogQL**: Loki's query language (similar to PromQL)

### Advantages

✅ **Cost-effective**: Only indexes labels, not content
✅ **Simple**: Easier to operate than Elasticsearch
✅ **Fast queries**: Label-based filtering is very fast
✅ **Grafana integration**: Built-in visualization
✅ **Horizontal scaling**: Can scale out easily

### Disadvantages

❌ **Less powerful**: Not as flexible as Elasticsearch for complex queries
❌ **Label cardinality**: Too many unique labels can cause problems
❌ **Newer**: Less mature than ELK stack

### Alternatives to Loki

1. **ELK Stack (Elasticsearch, Logstash, Kibana)**
   - More powerful querying
   - Better for complex log analysis
   - More expensive to operate
   - Harder to scale

2. **Splunk**
   - Enterprise-grade
   - Very expensive
   - Powerful analytics
   - Overkill for most projects

3. **Cloud Logging (AWS CloudWatch, GCP Cloud Logging)**
   - Managed service
   - Vendor lock-in
   - Can be expensive at scale
   - Good for cloud-native apps

4. **Datadog Logs**
   - SaaS solution
   - Easy to use
   - Expensive
   - Good for startups

**Why We Chose Loki**: Cost-effective, simple, integrates well with Grafana (which we use for metrics), and sufficient for our needs.

---

## Metrics with Prometheus

### What is Prometheus?

**Prometheus** is a time-series database and monitoring system. It's the industry standard for metrics collection in cloud-native applications.

### Why Prometheus?

**Traditional Approach (Nagios, Zabbix)**:
- Push-based (agents push metrics)
- Centralized configuration
- Hard to scale
- Limited querying

**Prometheus Approach**:
- Pull-based (Prometheus scrapes metrics)
- Service discovery
- Highly scalable
- Powerful query language (PromQL)

### How Prometheus Works

1. **Metrics Export**: Services expose `/metrics` endpoint in Prometheus format
2. **Scraping**: Prometheus periodically pulls metrics from services
3. **Storage**: Metrics stored as time-series in Prometheus database
4. **Querying**: Use PromQL to query and aggregate metrics
5. **Alerting**: Prometheus can trigger alerts based on rules

### Prometheus Data Model

**Metric Types**:

1. **Counter**: Always increases (e.g., total requests)
   ```
   http_requests_total{method="GET", route="/users", status="200"} 1523
   ```

2. **Gauge**: Can go up or down (e.g., active connections)
   ```
   db_connections_active{service="identity-service"} 5
   ```

3. **Histogram**: Distribution of values (e.g., request duration)
   ```
   http_request_duration_seconds_bucket{le="0.1"} 1200
   http_request_duration_seconds_bucket{le="0.5"} 1500
   http_request_duration_seconds_bucket{le="1.0"} 1520
   ```

4. **Summary**: Similar to histogram, but calculated on client side

### Key Concepts

**Metric Name**: What you're measuring (`http_requests_total`)
**Labels**: Dimensions for filtering (`method="GET"`, `service="identity"`)
**Sample**: A single data point at a timestamp
**Time Series**: A metric with specific label values over time

**Example**:
```
http_request_duration_seconds{method="GET", route="/users", status="200", service="identity-service"} 0.234
```

- **Metric**: `http_request_duration_seconds`
- **Labels**: `method="GET"`, `route="/users"`, `status="200"`, `service="identity-service"`
- **Value**: `0.234` seconds

### PromQL (Prometheus Query Language)

**Simple Query**:
```
http_requests_total
```
Returns all time series for this metric

**Filter by Label**:
```
http_requests_total{service="identity-service"}
```

**Aggregation**:
```
sum(http_requests_total) by (service)
```
Total requests grouped by service

**Rate Calculation**:
```
rate(http_requests_total[5m])
```
Requests per second over last 5 minutes

**Error Rate**:
```
rate(http_request_errors_total[5m]) / rate(http_requests_total[5m])
```

### Advantages

✅ **Industry standard**: Widely adopted, lots of tooling
✅ **Powerful queries**: PromQL is very expressive
✅ **Pull model**: Services don't need to know about Prometheus
✅ **Service discovery**: Automatically finds new services
✅ **Rich ecosystem**: Many exporters available
✅ **Open source**: Free and community-driven

### Disadvantages

❌ **Local storage**: Not designed for long-term storage (use Thanos or Cortex)
❌ **Pull model**: Can't monitor short-lived jobs easily
❌ **Cardinality**: Too many unique label combinations can cause issues
❌ **Learning curve**: PromQL takes time to master

### Alternatives to Prometheus

1. **InfluxDB**
   - Time-series database
   - Push-based
   - Good for IoT and high-frequency data
   - Less common for application metrics

2. **Datadog**
   - SaaS solution
   - Easy to use
   - Expensive
   - Good for startups

3. **New Relic**
   - APM + metrics
   - Very expensive
   - Good UI
   - Vendor lock-in

4. **CloudWatch Metrics (AWS) / Cloud Monitoring (GCP)**
   - Managed service
   - Vendor lock-in
   - Integrated with cloud services
   - Can be expensive

5. **StatsD + Graphite**
   - Older approach
   - Push-based
   - Less powerful than Prometheus
   - Still used in some organizations

**Why We Chose Prometheus**: Industry standard, powerful, free, integrates with Grafana, and works well with Kubernetes.

---

## Tracing with OpenTelemetry

### What is OpenTelemetry?

**OpenTelemetry** (OTel) is a vendor-neutral standard for generating, collecting, and exporting telemetry data (traces, metrics, logs). It's not a tool itself—it's a specification and SDK.

### Why OpenTelemetry?

**The Problem**: Every tracing vendor had their own SDK:
- Jaeger SDK
- Zipkin SDK
- Datadog SDK
- New Relic SDK

If you wanted to switch vendors, you had to rewrite your code!

**OpenTelemetry Solution**:
- One SDK for all vendors
- Vendor-neutral format
- Export to any backend (Jaeger, Zipkin, Datadog, etc.)
- Standardized instrumentation

### How OpenTelemetry Works

1. **Instrumentation**: Code is instrumented with OpenTelemetry SDK
2. **Trace Generation**: SDK creates spans (units of work)
3. **Context Propagation**: Trace IDs passed between services via headers
4. **Export**: Spans exported to backend (Jaeger, in our case)
5. **Visualization**: Backend visualizes traces

### Key Concepts

**Trace**: The entire journey of a request across services
**Span**: A single operation within a trace
**Span Context**: Trace ID + Span ID (passed between services)
**Instrumentation**: Code that generates spans

**Example Trace**:
```
Request: POST /api/workflows
├─ API Gateway (50ms)
│  ├─ Validate Token (10ms)
│  └─ Route to Workflow Service (5ms)
├─ Workflow Service (200ms)
│  ├─ Validate Request (5ms)
│  ├─ Check Permissions (20ms)
│  │  └─ Call Organization Service (15ms)
│  ├─ Create Workflow (150ms)
│  │  └─ Database Insert (140ms)
│  └─ Publish Event (10ms)
└─ Total: 250ms
```

### Trace Propagation

When Service A calls Service B, the trace ID is passed in HTTP headers:

**Service A**:
```javascript
const traceId = span.spanContext().traceId;
headers['traceparent'] = `00-${traceId}-${spanId}-01`;
```

**Service B**:
```javascript
const traceParent = headers['traceparent'];
// Extracts traceId and continues the trace
```

This creates a **distributed trace** across all services.

### OpenTelemetry Architecture

```
Application Code
    ↓
OpenTelemetry SDK
    ↓
Instrumentation (HTTP, Express, PostgreSQL, etc.)
    ↓
Span Exporter (Jaeger, Zipkin, etc.)
    ↓
Backend (Jaeger UI)
```

### Advantages

✅ **Vendor-neutral**: Switch backends without code changes
✅ **Standardized**: Industry-wide standard
✅ **Auto-instrumentation**: Automatically instruments common libraries
✅ **Rich context**: Can add custom attributes to spans
✅ **Future-proof**: Won't become obsolete

### Disadvantages

❌ **Complexity**: More moving parts than vendor-specific SDKs
❌ **Performance overhead**: Instrumentation adds latency (usually minimal)
❌ **Learning curve**: Understanding traces and spans takes time
❌ **Still evolving**: Some features may change

### Alternatives to OpenTelemetry

1. **Jaeger SDK (Direct)**
   - Simpler if you only use Jaeger
   - Vendor lock-in
   - Less flexible

2. **Zipkin**
   - Older, simpler
   - Less features
   - Still widely used

3. **Datadog APM**
   - SaaS solution
   - Very easy to use
   - Expensive
   - Vendor lock-in

4. **New Relic APM**
   - SaaS solution
   - Good UI
   - Very expensive
   - Vendor lock-in

5. **AWS X-Ray**
   - AWS-native
   - Good for AWS services
   - Vendor lock-in
   - Less flexible

**Why We Chose OpenTelemetry**: Future-proof, vendor-neutral, industry standard, and allows us to switch backends if needed.

---

## How They Work Together

The three pillars complement each other:

### Example: Debugging a Slow Request

1. **Metrics** tell you: "Average response time is high"
   ```
   http_request_duration_seconds{service="workflow-service"} 2.5
   ```

2. **Traces** show you: "The database query is slow"
   ```
   Trace shows: Database query took 2.3 seconds
   ```

3. **Logs** explain why: "Complex join query on large table"
   ```
   {service="workflow-service"} "Executing complex join query on projects table"
   ```

### The Observability Stack

```
┌─────────────────────────────────────────┐
│         Your Microservices              │
│  (Identity, Organization, Workflow...)  │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │               │
       ▼               ▼               ▼
   ┌──────┐      ┌──────────┐   ┌─────────────┐
   │ Loki │      │Prometheus│   │OpenTelemetry│
   │(Logs)│      │(Metrics) │   │  (Traces)   │
   └───┬──┘      └────┬─────┘   └──────┬──────┘
       │              │                 │
       └──────┬───────┴─────────────────┘
              │
              ▼
        ┌──────────┐
        │ Grafana  │
        │  (UI)    │
        └──────────┘
```

**Grafana** is the visualization layer that queries all three:
- **Loki**: For log queries
- **Prometheus**: For metrics queries
- **Jaeger**: For trace queries (via Jaeger UI or Grafana plugin)

### Correlation: The Secret Sauce

To connect logs, metrics, and traces, we use **correlation IDs**:

1. **Request comes in** → Generate `correlationId` and `traceId`
2. **All logs** include `correlationId` and `traceId`
3. **Metrics** can be filtered by labels (service, route)
4. **Traces** have the `traceId` in span context

**Example**:
```
User Request ID: abc-123
├─ Log: {correlationId: "abc-123", traceId: "xyz-789", message: "Request started"}
├─ Metric: http_requests_total{correlationId="abc-123"} 1
└─ Trace: traceId="xyz-789" spans=[gateway, identity, workflow]
```

Now you can:
- Find all logs for this request
- See the trace for this request
- Correlate metrics with specific requests

---

## Technology Alternatives

### Complete Stack Alternatives

#### 1. **ELK Stack (Elasticsearch, Logstash, Kibana)**
- **Logs**: Elasticsearch (replaces Loki)
- **Metrics**: Metricbeat → Elasticsearch
- **Traces**: APM → Elasticsearch
- **Pros**: Powerful, mature, all-in-one
- **Cons**: Complex, expensive, resource-intensive
- **Use when**: You need powerful search and analytics

#### 2. **Datadog**
- **Everything**: Logs, metrics, traces in one platform
- **Pros**: Easy, great UI, managed service
- **Cons**: Very expensive, vendor lock-in
- **Use when**: Budget allows, want simplicity

#### 3. **New Relic**
- **Everything**: APM + logs + metrics
- **Pros**: Excellent UI, good for application performance
- **Cons**: Very expensive, vendor lock-in
- **Use when**: Focus on APM, budget allows

#### 4. **Splunk**
- **Everything**: Enterprise logging and monitoring
- **Pros**: Very powerful, enterprise features
- **Cons**: Extremely expensive, complex
- **Use when**: Enterprise requirements, compliance needs

#### 5. **Cloud-Native (AWS/GCP/Azure)**
- **AWS**: CloudWatch Logs + CloudWatch Metrics + X-Ray
- **GCP**: Cloud Logging + Cloud Monitoring + Cloud Trace
- **Azure**: Application Insights
- **Pros**: Integrated with cloud services, managed
- **Cons**: Vendor lock-in, can be expensive
- **Use when**: All-in on one cloud provider

### Why Our Stack (Loki + Prometheus + OpenTelemetry + Jaeger)?

✅ **Cost-effective**: All open-source, no licensing fees
✅ **Vendor-neutral**: Not locked into one vendor
✅ **Industry standard**: Prometheus and OpenTelemetry are standards
✅ **Flexible**: Can swap components (e.g., use Tempo instead of Jaeger)
✅ **Learning value**: Understanding these tools is valuable
✅ **Cloud-agnostic**: Works on any infrastructure

---

## Implementation in This Project

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Microservices                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │Identity  │  │Organization│  │Workflow  │  ...       │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘            │
│       │              │              │                   │
│       └──────┬───────┴──────┬───────┘                   │
│              │              │                            │
│       ┌──────▼──────────────▼──────┐                    │
│       │  @observability package    │                    │
│       │  - Logger (Pino)            │                    │
│       │  - Metrics (Prometheus)     │                    │
│       │  - Tracing (OpenTelemetry)  │                    │
│       └──────┬──────────────┬──────┘                    │
└──────────────┼──────────────┼───────────────────────────┘
               │              │              │
       ┌───────▼──────┐  ┌────▼─────┐  ┌────▼──────┐
       │    Loki      │  │Prometheus│  │   Jaeger  │
       │  Port: 3100  │  │Port: 9090│  │Port: 16686│
       └──────────────┘  └──────────┘  └───────────┘
               │              │              │
               └──────┬───────┴──────┬───────┘
                      │              │
                 ┌────▼──────────────▼────┐
                 │      Grafana           │
                 │     Port: 3000         │
                 └────────────────────────┘
```

### Shared Observability Package

All services use the `@microservice-learning/observability` package:

**Location**: `packages/observability/`

**Components**:
1. **Logger** (`src/logger.ts`): Pino-based structured logging
2. **Metrics** (`src/metrics.ts`): Prometheus metrics registry
3. **Tracing** (`src/tracing.ts`): OpenTelemetry initialization

### Service Initialization

Every service initializes observability the same way:

```typescript
// services/identity-service/src/index.ts
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';

const SERVICE_NAME = 'identity-service';

// Initialize all three pillars
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });
```

### Logging Implementation

**Logger Configuration** (`packages/observability/src/logger.ts`):

```typescript
export function createLogger(options: LoggerOptions): pino.Logger {
  return pino({
    level: options.level || process.env.LOG_LEVEL || 'info',
    base: {
      service: options.serviceName,
      environment: options.environment || process.env.NODE_ENV || 'development',
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
  });
}
```

**Key Features**:
- Structured JSON output
- Service name in every log
- ISO 8601 timestamps
- Request/response/error serialization

**Usage in Services**:
```typescript
logger.info({ userId: 'user-123', correlationId: 'abc-123' }, 'User logged in');
logger.error({ err, correlationId: 'abc-123' }, 'Authentication failed');
```

**Log Format**:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "identity-service",
  "environment": "development",
  "userId": "user-123",
  "correlationId": "abc-123",
  "message": "User logged in"
}
```

**Loki Configuration** (`infrastructure/loki/loki-config.yml`):
- HTTP port: 3100
- gRPC port: 9096
- File-based storage (local development)
- Can be configured for S3/GCS in production

### Metrics Implementation

**Metrics Registry** (`packages/observability/src/metrics.ts`):

The `MetricsRegistry` class creates all standard metrics:

**HTTP Metrics**:
- `http_request_duration_seconds` (Histogram)
- `http_requests_total` (Counter)
- `http_request_errors_total` (Counter)

**Database Metrics**:
- `db_query_duration_seconds` (Histogram)
- `db_connections_active` (Gauge)
- `db_connections_idle` (Gauge)

**Kafka Metrics**:
- `kafka_messages_consumed_total` (Counter)
- `kafka_messages_produced_total` (Counter)
- `kafka_consumer_lag` (Gauge)
- `kafka_processing_duration_seconds` (Histogram)

**Business Metrics**:
- `business_events_processed_total` (Counter)
- `business_events_failed_total` (Counter)

**Prometheus Configuration** (`infrastructure/prometheus/prometheus.yml`):

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'identity-service'
    static_configs:
      - targets: ['host.docker.internal:3001']
        labels:
          service: 'identity-service'
  # ... other services
```

**How It Works**:
1. Each service exposes `/metrics` endpoint
2. Prometheus scrapes every 15 seconds
3. Metrics stored in Prometheus time-series database
4. Grafana queries Prometheus for visualization

**Example Metric Output** (`/metrics` endpoint):
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/users",status_code="200",service="identity-service"} 1523

# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/users",le="0.1",service="identity-service"} 1200
http_request_duration_seconds_bucket{method="GET",route="/users",le="0.5",service="identity-service"} 1500
http_request_duration_seconds_bucket{method="GET",route="/users",le="1.0",service="identity-service"} 1520
http_request_duration_seconds_sum{method="GET",route="/users",service="identity-service"} 234.5
http_request_duration_seconds_count{method="GET",route="/users",service="identity-service"} 1523
```

### Tracing Implementation

**Tracing Setup** (`packages/observability/src/tracing.ts`):

```typescript
export function initializeTracing(options: TracingOptions): NodeSDK {
  const jaegerExporter = new JaegerExporter({
    endpoint: options.jaegerEndpoint || process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: options.environment || process.env.NODE_ENV || 'development',
    }),
    traceExporter: jaegerExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
  return sdk;
}
```

**Key Features**:
- Auto-instrumentation for HTTP, Express, PostgreSQL, etc.
- Exports to Jaeger
- Service name and version in resource attributes
- Trace context automatically propagated

**Jaeger Configuration** (`docker-compose.yml`):

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  ports:
    - "16686:16686"  # UI
    - "14268:14268"  # HTTP collector
    - "4317:4317"    # OTLP gRPC
    - "4318:4318"    # OTLP HTTP
  environment:
    - COLLECTOR_OTLP_ENABLED=true
```

**How It Works**:
1. OpenTelemetry SDK auto-instruments HTTP requests
2. Spans created for each operation
3. Trace context propagated via HTTP headers (`traceparent`)
4. Spans exported to Jaeger via OTLP
5. Jaeger UI visualizes traces

### Docker Compose Setup

All observability infrastructure runs in Docker:

```yaml
# Prometheus
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./infrastructure/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

# Jaeger
jaeger:
  image: jaegertracing/all-in-one:latest
  ports:
    - "16686:16686"  # UI

# Loki
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - ./infrastructure/loki/loki-config.yml:/etc/loki/local-config.yaml

# Grafana
grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  depends_on:
    - prometheus
    - loki
```

**Access Points**:
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Jaeger UI**: http://localhost:16686
- **Loki**: http://localhost:3100

---

## Practical Examples

### Example 1: Debugging a Slow Request

**Scenario**: User reports slow login (takes 5 seconds)

**Step 1: Check Metrics** (Prometheus/Grafana)
```
Query: rate(http_request_duration_seconds_sum{route="/login"}[5m]) / rate(http_request_duration_seconds_count{route="/login"}[5m])
Result: 4.8 seconds average
```

**Step 2: Find the Trace** (Jaeger)
- Search for traces with route="/login"
- Find the slow trace
- See that database query took 4.5 seconds

**Step 3: Check Logs** (Loki/Grafana)
```
Query: {service="identity-service"} |= "login" |= "database"
Result: "Executing password verification query, took 4500ms"
```

**Solution**: Database query is slow → Add index or optimize query

### Example 2: Investigating High Error Rate

**Scenario**: Error rate increased from 0.1% to 5%

**Step 1: Check Metrics** (Prometheus)
```
Query: rate(http_request_errors_total[5m]) / rate(http_requests_total[5m])
Result: 5.2% error rate
```

**Step 2: Find Error Logs** (Loki)
```
Query: {service="workflow-service", level="error"}
Result: Multiple "Database connection timeout" errors
```

**Step 3: Check Database Metrics** (Prometheus)
```
Query: db_connections_active{service="workflow-service"}
Result: 100 (max connections reached)
```

**Solution**: Connection pool exhausted → Increase pool size or add connection retry logic

### Example 3: Tracing a Cross-Service Request

**Scenario**: User creates a workflow, but it fails

**Request Flow**:
1. API Gateway → Identity Service (validate token)
2. API Gateway → Workflow Service (create workflow)
3. Workflow Service → Organization Service (check permissions)
4. Workflow Service → Database (save workflow)
5. Workflow Service → Kafka (publish event)

**In Jaeger**:
- See the entire trace with all spans
- Identify which service/operation failed
- See latency for each step
- Find the error span with error details

**In Logs** (correlated by traceId):
```
{service="workflow-service", traceId="xyz-789"} "Creating workflow"
{service="organization-service", traceId="xyz-789"} "Checking permissions"
{service="organization-service", traceId="xyz-789", level="error"} "Permission denied: user not member of organization"
```

---

## Best Practices

### Logging Best Practices

1. **Always use structured logging**
   ```typescript
   // ❌ Bad
   logger.info("User logged in");
   
   // ✅ Good
   logger.info({ userId: "user-123", correlationId: "abc-123" }, "User logged in");
   ```

2. **Include correlation IDs**
   - Every log should have `correlationId` and `traceId`
   - Enables correlation across services

3. **Log at appropriate levels**
   - `error`: Something failed
   - `warn`: Something unexpected but handled
   - `info`: Important business events
   - `debug`: Detailed debugging information

4. **Never log sensitive data**
   - No passwords, tokens, or PII
   - Hash or mask sensitive fields

5. **Use consistent field names**
   - `userId`, `organizationId`, `correlationId` (not `user_id`, `orgId`, etc.)

### Metrics Best Practices

1. **Use appropriate metric types**
   - Counter for things that only increase
   - Gauge for things that go up and down
   - Histogram for distributions

2. **Keep label cardinality low**
   - Too many unique label combinations = performance problems
   - Avoid high-cardinality labels (like user IDs)

3. **Use standard metric names**
   - `http_requests_total` (not `requests`, `httpRequests`, etc.)
   - Follow Prometheus naming conventions

4. **Export business metrics**
   - Not just technical metrics
   - Track business events (users created, workflows completed, etc.)

5. **Set appropriate buckets for histograms**
   - Match your SLOs
   - Example: `[0.1, 0.5, 1, 2, 5, 10]` for request duration

### Tracing Best Practices

1. **Use auto-instrumentation when possible**
   - OpenTelemetry auto-instruments common libraries
   - Only add manual spans when needed

2. **Add meaningful span names**
   - `createUser` (not `operation`, `doStuff`, etc.)

3. **Add useful attributes**
   ```typescript
   span.setAttributes({
     'user.id': userId,
     'organization.id': orgId,
     'workflow.type': 'approval',
   });
   ```

4. **Keep spans focused**
   - One span per logical operation
   - Don't create spans for trivial operations

5. **Handle trace context propagation**
   - Always propagate trace context in HTTP headers
   - Include trace context in Kafka messages

### General Best Practices

1. **Start observability from day one**
   - Don't add it later
   - It's much harder to retrofit

2. **Correlate everything**
   - Use correlation IDs
   - Include trace IDs in logs
   - Tag metrics with service names

3. **Set up alerts**
   - Alert on error rates
   - Alert on latency
   - Alert on business metrics (e.g., failed payments)

4. **Document your metrics**
   - What does each metric mean?
   - What are the expected values?
   - What should we alert on?

5. **Review and optimize**
   - Regularly review logs for noise
   - Remove unused metrics
   - Optimize expensive queries

---

## Summary

Observability is essential for microservices. This project uses:

- **Loki**: For log aggregation (cost-effective, simple)
- **Prometheus**: For metrics collection (industry standard, powerful)
- **OpenTelemetry + Jaeger**: For distributed tracing (vendor-neutral, standardized)

Together, they provide:
- **Logs**: What happened and why
- **Metrics**: How the system is performing
- **Traces**: How requests flow through services

All three are visualized in **Grafana**, giving you a complete picture of your system's health and behavior.

### Key Takeaways

1. **Observability is not optional** in microservices
2. **All three pillars are needed** (logs, metrics, traces)
3. **Correlation is critical** (use correlation IDs and trace IDs)
4. **Start early** (don't retrofit observability)
5. **Use industry standards** (Prometheus, OpenTelemetry) for flexibility

### Next Steps

1. **Explore Grafana**: Set up dashboards for your key metrics
2. **Set up alerts**: Configure Prometheus alerting rules
3. **Practice debugging**: Use the three pillars to debug real issues
4. **Learn PromQL**: Master Prometheus query language
5. **Learn LogQL**: Master Loki query language

---

## Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Loki Documentation**: https://grafana.com/docs/loki/latest/
- **OpenTelemetry Documentation**: https://opentelemetry.io/docs/
- **Jaeger Documentation**: https://www.jaegertracing.io/docs/
- **Grafana Documentation**: https://grafana.com/docs/grafana/latest/

---

*This document is part of the Enterprise Microservices Learning Project. For questions or improvements, please refer to the project documentation.*
