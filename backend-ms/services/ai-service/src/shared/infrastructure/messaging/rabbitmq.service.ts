import amqp from 'amqplib';
import { logger } from '../logger.js';

export interface DomainIntegrationEvent<T = any> {
  id: string;
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
  version: number;
  tenantId?: string;
}

export type EventHandler<T = any> = (event: DomainIntegrationEvent<T>) => Promise<void>;

interface BufferedPublishEvent {
  routingKey: string;
  event: DomainIntegrationEvent<any>;
}

export class RabbitMQService {
  private static instance: RabbitMQService;
  private connection: any = null;
  private channel: any = null;
  private readonly exchange = 'microservices.events';
  private readonly dlxExchange = 'microservices.dlx';
  private readonly url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  private isConnecting = false;
  private publishQueue: BufferedPublishEvent[] = [];
  private readonly maxQueueSize = 1000;

  private constructor() {}

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  public async connect(): Promise<void> {
    if (process.env.RABBITMQ_ENABLED === 'false') return;
    if (this.connection && this.channel) return;
    if (this.isConnecting) return;

    this.isConnecting = true;
    try {
      logger.info('Connecting to RabbitMQ broker...', { url: this.url });
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertExchange(this.dlxExchange, 'direct', { durable: true });

      this.connection.on('error', (err: any) => {
        logger.error('RabbitMQ connection error', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Attempting reconnect...');
        this.reconnect();
      });

      logger.info('RabbitMQ connected successfully');
      await this.flushPublishQueue();
    } catch (err) {
      logger.error('Failed to connect to RabbitMQ broker', err);
      const timer = setTimeout(() => this.connect(), 5000);
      timer.unref();
    } finally {
      this.isConnecting = false;
    }
  }

  private reconnect(): void {
    this.connection = null;
    this.channel = null;
    const timer = setTimeout(() => this.connect(), 5000);
    timer.unref();
  }

  private async flushPublishQueue(): Promise<void> {
    if (!this.channel || this.publishQueue.length === 0) return;
    const eventsToFlush = [...this.publishQueue];
    this.publishQueue = [];
    logger.info(`Flushing ${eventsToFlush.length} buffered RabbitMQ events`);

    for (const item of eventsToFlush) {
      await this.publish(item.routingKey, item.event);
    }
  }

  public async publish<T>(routingKey: string, event: DomainIntegrationEvent<T>): Promise<void> {
    try {
      if (!this.channel && process.env.RABBITMQ_ENABLED !== 'false') {
        await this.connect();
      }
      if (!this.channel) {
        if (this.publishQueue.length < this.maxQueueSize) {
          this.publishQueue.push({ routingKey, event });
          logger.warn('RabbitMQ channel not ready. Event buffered in memory queue for dispatch upon connection', {
            routingKey,
            eventId: event.id,
            queueDepth: this.publishQueue.length
          });
        } else {
          logger.error('RabbitMQ fallback queue capacity reached. Event dropped', {
            routingKey,
            eventId: event.id
          });
        }
        return;
      }

      const content = Buffer.from(JSON.stringify(event));
      this.channel.publish(this.exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        timestamp: Date.now(),
        headers: event.tenantId ? { 'x-tenant-id': event.tenantId } : undefined
      });

      logger.info(`Published event to RabbitMQ: ${routingKey}`, {
        eventId: event.id,
        aggregateId: event.aggregateId,
        tenantId: event.tenantId
      });
    } catch (err) {
      logger.error(`Failed to publish event ${routingKey}`, err);
    }
  }

  public async subscribe<T>(
    serviceQueueName: string,
    routingKeys: string[],
    handler: EventHandler<T>
  ): Promise<void> {
    try {
      if (!this.channel) {
        await this.connect();
      }
      if (!this.channel) {
        setTimeout(() => this.subscribe(serviceQueueName, routingKeys, handler), 5000);
        return;
      }

      // Assert Dead Letter Exchange and Queue for fault tolerance
      const dlqName = `${serviceQueueName}.dlq`;
      await this.channel.assertQueue(dlqName, { durable: true });
      await this.channel.bindQueue(dlqName, this.dlxExchange, serviceQueueName);

      const q = await this.channel.assertQueue(serviceQueueName, {
        durable: true,
        deadLetterExchange: this.dlxExchange,
        deadLetterRoutingKey: serviceQueueName
      });

      for (const key of routingKeys) {
        await this.channel.bindQueue(q.queue, this.exchange, key);
        logger.info(`Bound queue '${serviceQueueName}' to exchange '${this.exchange}' with routing key '${key}'`);
      }

      // Performance & resilience: apply consumer prefetch QoS
      const prefetchCount = parseInt(process.env.RABBITMQ_PREFETCH || '10', 10);
      await this.channel.prefetch(prefetchCount);

      await this.channel.consume(
        q.queue,
        async (msg: any) => {
          if (!msg) return;
          try {
            const event: DomainIntegrationEvent<T> = JSON.parse(msg.content.toString());
            const headerTenantId = msg.properties?.headers?.['x-tenant-id'];
            if (!event.tenantId && headerTenantId) {
              event.tenantId = String(headerTenantId);
            }
            logger.info(`Received event ${event.eventName} on queue ${serviceQueueName}`, {
              eventId: event.id,
              aggregateId: event.aggregateId,
              tenantId: event.tenantId
            });
            await handler(event);
            this.channel?.ack(msg);
          } catch (handlerErr) {
            logger.error(`Handler failed for message on queue ${serviceQueueName}. Routing to DLQ`, handlerErr);
            // nack without requeue routes directly to deadLetterExchange (microservices.dlx -> dlq)
            this.channel?.nack(msg, false, false);
          }
        },
        { noAck: false }
      );
    } catch (err) {
      logger.error(`Failed to setup subscription on queue ${serviceQueueName}`, err);
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed cleanly');
    } catch (err) {
      logger.error('Error closing RabbitMQ connection', err);
    }
  }
}

export const rabbitmq = RabbitMQService.getInstance();
