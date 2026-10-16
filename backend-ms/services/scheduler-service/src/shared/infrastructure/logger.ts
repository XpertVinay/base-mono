type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  service?: string;
  meta?: Record<string, any>;
  error?: string;
  stack?: string;
}

export class Logger {
  constructor(private readonly serviceName: string = process.env.SERVICE_NAME || 'microservice') {}

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, any>, err?: Error): string {
    const payload: LogPayload = {
      level,
      message,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      ...(meta && { meta })
    };

    if (err) {
      payload.error = err.message;
      if (process.env.NODE_ENV !== 'production') {
        payload.stack = err.stack;
      }
    }

    return JSON.stringify(payload);
  }

  info(message: string, meta?: Record<string, any>): void {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, any>): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, err?: any, meta?: Record<string, any>): void {
    const errorObj = err instanceof Error ? err : typeof err === 'string' ? new Error(err) : undefined;
    console.error(this.formatMessage('error', message, meta, errorObj));
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
