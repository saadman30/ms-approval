import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsRegistry {
  private registry: Registry;
  private serviceName: string;

  // HTTP Metrics
  public httpRequestDuration: Histogram<string>;
  public httpRequestTotal: Counter<string>;
  public httpRequestErrors: Counter<string>;

  // Database Metrics
  public dbQueryDuration: Histogram<string>;
  public dbConnectionsActive: Gauge<string>;
  public dbConnectionsIdle: Gauge<string>;

  // Kafka Metrics
  public kafkaMessagesConsumed: Counter<string>;
  public kafkaMessagesProduced: Counter<string>;
  public kafkaConsumerLag: Gauge<string>;
  public kafkaProcessingDuration: Histogram<string>;

  // Business Metrics
  public businessEventsProcessed: Counter<string>;
  public businessEventsFailed: Counter<string>;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.registry = new Registry();

    // HTTP Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type', 'service'],
      registers: [this.registry],
    });

    // Database Metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'service'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.dbConnectionsIdle = new Gauge({
      name: 'db_connections_idle',
      help: 'Number of idle database connections',
      labelNames: ['service'],
      registers: [this.registry],
    });

    // Kafka Metrics
    this.kafkaMessagesConsumed = new Counter({
      name: 'kafka_messages_consumed_total',
      help: 'Total number of Kafka messages consumed',
      labelNames: ['topic', 'service'],
      registers: [this.registry],
    });

    this.kafkaMessagesProduced = new Counter({
      name: 'kafka_messages_produced_total',
      help: 'Total number of Kafka messages produced',
      labelNames: ['topic', 'service'],
      registers: [this.registry],
    });

    this.kafkaConsumerLag = new Gauge({
      name: 'kafka_consumer_lag',
      help: 'Kafka consumer lag',
      labelNames: ['topic', 'partition', 'service'],
      registers: [this.registry],
    });

    this.kafkaProcessingDuration = new Histogram({
      name: 'kafka_processing_duration_seconds',
      help: 'Duration of Kafka message processing in seconds',
      labelNames: ['topic', 'service'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Business Metrics
    this.businessEventsProcessed = new Counter({
      name: 'business_events_processed_total',
      help: 'Total number of business events processed',
      labelNames: ['event_type', 'service'],
      registers: [this.registry],
    });

    this.businessEventsFailed = new Counter({
      name: 'business_events_failed_total',
      help: 'Total number of business events that failed processing',
      labelNames: ['event_type', 'error_type', 'service'],
      registers: [this.registry],
    });

    // Set default labels
    this.registry.setDefaultLabels({ service: this.serviceName });
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
