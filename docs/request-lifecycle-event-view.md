### Request Lifecycle from an Event Perspective

This document walks through a **single user request** end-to-end using a concrete example:

- **Example action**: `POST /workflow/tasks` (Create Task)
- **Context**: Authenticated user acting within an organization
- **Goal**: Show how HTTP, events, and failure handling interact across services.

---

### 1. Ingress: API Gateway & Authentication

- **Step 1.1 – Client → API Gateway**
  - Client sends `POST /workflow/tasks` with:
    - JWT in `Authorization: Bearer <access-token>`
    - `X-Correlation-ID` (if missing, gateway generates one)
  - Gateway attaches:
    - `X-Correlation-ID` (correlationId)
    - `X-Request-Id` (optional)
    - `traceparent` header (OpenTelemetry trace context)

- **Step 1.2 – Gateway → Identity Service (Sync)**
  - Gateway calls `identity-service` `POST /auth/validate`:
    - Verifies token signature, expiry, and basic claims.
    - Returns `200 OK` with `userId` and token claims on success.
  - On failure:
    - `401`/`403` returned to client.
    - **No downstream events or service calls happen.**

- **Step 1.3 – Gateway → Workflow Service (Sync)**
  - After successful auth, gateway forwards request to `workflow-service`:
    - `POST /workflow/tasks`
    - Propagates headers:
      - `Authorization` (or stripped, depending on design)
      - `X-Correlation-ID`
      - `traceparent` / tracing headers
      - `X-User-Id` (derived from token)
      - `X-Organization-Id` (from route/body or claims)

---

### 2. Workflow Service: Command Handling & Local State

- **Step 2.1 – HTTP Handler**
  - `workflow-service` Express route handler:
    - Extracts `userId`, `organizationId`, input payload (`projectId`, `title`, etc.).
    - Starts/continues OpenTelemetry span using incoming `traceparent`.
    - Logs structured entry:
      - `{ msg: "CreateTask request received", traceId, correlationId, userId, organizationId }`

- **Step 2.2 – Local Entitlement & Membership Checks**
  - **Data sources**:
    - Membership cache (from `organization.*` events).
    - Entitlements cache (from `billing.entitlements.updated` events).
  - Workflow **does not** call `billing-service` or `organization-service` synchronously.
  - Checks:
    - User is a member of the organization with sufficient role.
    - Current project/task counts within entitlements limits.
  - Outcomes:
    - If membership missing or insufficient:
      - Return `403 Forbidden` (security over availability).
    - If limits exceeded (e.g., too many tasks for plan):
      - Return `402 Payment Required` or `429` (depending on policy) with graceful message.

- **Step 2.3 – Local DB Write (Task Creation)**
  - Within a DB transaction:
    - Insert new task row into `tasks` table.
    - Optionally increment local usage counters.
  - On DB failure (e.g., Postgres down):
    - Return **5xx** to the client.
    - No `TaskCreated` event is published.

- **Step 2.4 – Event Creation (TaskCreated v1)**
  - After successful DB commit:
    - Create `TaskCreated` event conforming to `docs/event-schemas.md`:

```typescript
const event: TaskCreatedEvent = {
  eventId: uuid(),
  eventType: "TaskCreated",
  eventVersion: "v1",
  timestamp: new Date().toISOString(),
  source: "workflow-service",
  correlationId, // from X-Correlation-ID
  traceId,       // current OpenTelemetry trace ID
  userId,
  organizationId,
  data: {
    organizationId,
    projectId,
    taskId,
    title,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  },
};
```

- **Step 2.5 – Publish to Kafka (Async)**
  - Publish to topic `workflow.task.created` with key `organizationId`.
  - Use at-least-once semantics:
    - Retries with backoff on broker errors.
    - If publish ultimately fails, see **Section 5.1**.

- **Step 2.6 – HTTP Response to Client**
  - Once **DB write succeeds** (and ideally event is queued to Kafka or reliably persisted by the producer), return:
    - `201 Created` with new task representation.
    - Headers:
      - `X-Correlation-ID`
      - `trace-id` / trace headers

---

### 3. Downstream Event Consumers (Happy Path)

When `workflow.task.created` is on Kafka, several services consume it **asynchronously**:

- **3.1 – Audit Service**
  - Subscribed to `workflow.task.created`.
  - On consume:
    - Idempotency check via `eventId` in audit table.
    - Append immutable audit record: "Task created".
    - Attach `correlationId` and `traceId` to logs and stored record.
  - Purpose:
    - Compliance and traceability for the action.

- **3.2 – Analytics Service**
  - Subscribed to `workflow.task.created`.
  - On consume:
    - Update task throughput metrics and dashboards (e.g., tasks per org per day).
    - Materialize read-optimized views in its own database.
  - User-facing impact:
    - Analytics dashboards are **eventually consistent**: newly created task may appear with a small delay.

- **3.3 – Notification Service (optional for this action)**
  - If we emit `TaskAssigned` or similar events later, `notification-service` will:
    - Create notification records.
    - Dispatch email/in-app/webhook notifications.

---

### 4. Tracing & Observability Across the Flow

- **Correlation IDs**
  - Originated at the API Gateway, propagated via `X-Correlation-ID` and event `correlationId`.
  - Enables end-to-end log correlation:
    - Gateway logs → Workflow logs → Kafka metadata → Audit/Analytics logs.

- **Tracing**
  - Single distributed trace for the user action:
    - Gateway span → Workflow HTTP span → Workflow DB span → Workflow Kafka publish span.
    - Separate but linked traces for consumers:
      - Consumer spans use `traceId` from event where available.

- **Metrics**
  - **Workflow-service**:
    - HTTP latency and error rate for `POST /workflow/tasks`.
    - DB query latency and errors.
  - **Kafka**:
    - Producer/consumer error metrics.
    - Consumer lag per topic/consumer group.
  - **Consumers**:
    - Event processing latency.
    - DLQ rate.

---

### 5. Failure Scenarios & Degradation

This section focuses on **what happens when services or infrastructure are unavailable** during the same request lifecycle.

---

#### 5.1 – Kafka Unavailable When Publishing `TaskCreated`

- **Scenario**:
  - Workflow DB write succeeds, but Kafka is temporarily unavailable or returns persistent errors when trying to publish `workflow.task.created`.

- **Behavior Options (Design Choice)**:
  - **Option A – Fail the request (strict event guarantee)**:
    - If we consider the event essential, workflow-service:
      - Rolls back the transaction, or treats the operation as failed if publish is part of the transaction boundary.
      - Returns `503 Service Unavailable` or `500 Internal Server Error`.
      - Logs:
        - `{ msg: "Failed to publish TaskCreated", error, correlationId, traceId }`
    - **Trade-off**: Stronger consistency between DB state and events, lower availability.
  - **Option B – Accept the request, buffer locally (graceful degradation)**:
    - DB commit stands (task exists).
    - Event is written to a local outbox table (if using the outbox pattern) and retried asynchronously.
    - HTTP response to client is still `201 Created`.
    - Outbox worker later publishes the event once Kafka is healthy.
    - **Trade-off**: Higher availability, but downstream consumers see the new task with delay.

- **Recommended for this project**:
  - **Outbox pattern (Option B)** with clear observability:
    - Metrics on outbox backlog size.
    - Alerts if outbox grows beyond threshold.

---

#### 5.2 – Audit Service Unavailable

- **Scenario**:
  - `audit-service` instance or its DB is down while `workflow.task.created` events are flowing.

- **Behavior**:
  - Kafka continues to accept events.
  - `audit-service` consumer:
    - Fails to process messages (e.g., DB errors).
    - Applies retry with exponential backoff and jitter.
    - On repeated failure beyond threshold:
      - Moves messages to a **Dead-Letter Queue (DLQ)** topic, e.g., `audit.dlq`.
      - Emits structured log:
        - `{ msg: "Audit event moved to DLQ", eventId, topic, reason, correlationId, traceId }`
  - User-facing impact:
    - **No direct impact on the original `Create Task` request** (already completed).
    - Temporary gap in audit logs until recovery or DLQ replay.

---

#### 5.3 – Analytics Service Unavailable

- **Scenario**:
  - `analytics-service` or its DB experiences an outage.

- **Behavior**:
  - Similar to audit:
    - Kafka still retains `workflow.task.created` events.
    - `analytics-service` consumer retries and, if needed, sends to its DLQ.
  - User-facing impact:
    - Analytics dashboards show **stale data**.
    - Core workflow operations remain unaffected.

---

#### 5.4 – Notification Service Unavailable (for Related Events)

- **Scenario**:
  - Later, a `TaskAssigned` event is emitted and `notification-service` is down.

- **Behavior**:
  - Core workflow still functions; tasks can be assigned.
  - Notifications might be delayed:
    - Events accumulate in Kafka.
    - Once `notification-service` recovers, it:
      - Replays backlog (with idempotency via `delivery` table).
  - User-facing impact:
    - Users may not receive immediate notifications.
    - Eventually, after recovery, notifications are delivered (or visible via in-app center).

---

#### 5.5 – Organization/Billing Cache Staleness

- **Scenario**:
  - Membership or entitlements caches in `workflow-service` are stale due to delayed events from `organization-service` or `billing-service`.

- **Behavior**:
  - **Security-first for membership**:
    - If membership info is missing or inconsistent:
      - Prefer to **deny** access (`403`) rather than allow potentially unauthorized actions.
  - **Business-driven for entitlements**:
    - If entitlements cannot be loaded:
      - Conservative default: treat as lowest plan (block new creations but keep existing usage).
      - Or: allow within reasonable local thresholds, but log and metric discrepancies.

- **User-facing impact**:
  - Some authorized users may see temporary access issues.
  - Actions may be blocked when in doubt about plan limits.

---

#### 5.6 – Workflow Service Itself Unavailable

- **Scenario**:
  - `workflow-service` is down or failing health checks.

- **Behavior**:
  - API Gateway:
    - Performs health checks and/or uses circuit breakers.
    - If workflow is unhealthy:
      - Quickly returns `503 Service Unavailable` for `POST /workflow/tasks`.
      - Attaches `X-Correlation-ID` for traceability.
  - Events:
    - No `TaskCreated` event will be produced because the request never reaches workflow.

---

### 6. End-to-End Summary (Create Task)

- **Happy Path**:
  1. Client → Gateway → Identity (token validation).
  2. Gateway forwards to `workflow-service` with correlationId + trace headers.
  3. Workflow validates membership & entitlements from local caches.
  4. Workflow writes task to its own DB.
  5. Workflow emits `TaskCreated` event to Kafka.
  6. Audit & Analytics consume event and update their own stores.
  7. Entire flow is observable via logs, metrics, and traces using shared `correlationId` and `traceId`.

- **Failure-Resilient Behavior**:
  - **Identity down** → Request rejected at the edge (auth failure).
  - **Workflow DB down** → Request fails, no event.
  - **Kafka down** → Use outbox + retries; client may still succeed while downstream is eventually updated.
  - **Audit/Analytics/Notification down** → Core workflow unaffected; events buffered or moved to DLQ, with eventual recovery.

This lifecycle demonstrates the core principles of the project:
**event-driven communication, eventual consistency, strict service boundaries, and graceful degradation under failure.**

