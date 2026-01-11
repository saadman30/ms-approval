import pino from 'pino';
import { randomUUID } from 'crypto';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
  environment?: string;
}

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

export function getCorrelationId(): string {
  return randomUUID();
}
