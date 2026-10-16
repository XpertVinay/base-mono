import { env } from '../../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  module?: string;
  [key: string]: unknown;
}

class Logger {
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      environment: env.NODE_ENV,
      ...context
    };
    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace') {
      console.debug(this.format('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.format('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.format('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      stack: env.NODE_ENV === 'production' ? undefined : error.stack
    } : { rawError: String(error) };

    console.error(this.format('error', message, { ...context, ...errorDetails }));
  }
}

export const logger = new Logger();
