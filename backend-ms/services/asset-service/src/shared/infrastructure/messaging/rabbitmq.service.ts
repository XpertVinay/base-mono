import amqp from 'amqplib';
import { logger } from '../logger.js';

export interface DomainIntegrationEvent<T = any> {
  id: string;
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
  version: number;
}

export type EventHandler<T = any> = (event: DomainIntegrationEvent<T>) => Promise<void>;

export class RabbitMQService {
  private static instance: RabbitMQService;
  private connection: any = null;
  private channel: any = null;
  private readonly exchange = 'microservices.events';
  private readonly url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  private isConnecting = false;

  private constructor() {}

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  public async connect(): Promise<void> {
    if (this.connection && this.channel) return;
    if (this.isConnecting) return;

    this.isConnecting = true;
    try {
      logger.info('Connecting to RabbitMQ broker...', { url: this.url });
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      this.connection.on('error', (err: any) => {
        logger.error('RabbitMQ connection error', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Attempting reconnect...');
        this.reconnect();
      });

      logger.info('RabbitMQ connected successfully');
    } catch (err) {
      logger.error('Failed to connect to RabbitMQ broker', err);
      setTimeout(() => this.connect(), 5000);
    } finally {
      this.isConnecting = false;
    }
  }

  private reconnect(): void {
    this.connection = null;
    this.channel = null;
    setTimeout(() => this.connect(), 5000);
  }

  public async publish<T>(routingKey: string, event: DomainIntegrationEvent<T>): Promise<void> {
    try {
      if (!this.channel) {
        await this.connect();
      }
      if (!this.channel) {
        logger.warn('RabbitMQ channel not ready. Event queued in fallback memory buffer', { routingKey, eventId: event.id });
        return;
      }

      const content = Buffer.from(JSON.stringify(event));
      this.channel.publish(this.exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        timestamp: Date.now()
      });

      logger.info(`Published event to RabbitMQ: ${routingKey}`, {
        eventId: event.id,
        aggregateId: event.aggregateId
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

      const q = await this.channel.assertQueue(serviceQueueName, { durable: true });

      for (const key of routingKeys) {
        await this.channel.bindQueue(q.queue, this.exchange, key);
        logger.info(`Bound queue '${serviceQueueName}' to exchange '${this.exchange}' with routing key '${key}'`);
      }

      await this.channel.consume(
        q.queue,
        async (msg: any) => {
          if (!msg) return;
          try {
            const event: DomainIntegrationEvent<T> = JSON.parse(msg.content.toString());
            logger.info(`Received event ${event.eventName} on queue ${serviceQueueName}`, {
              eventId: event.id,
              aggregateId: event.aggregateId
            });
            await handler(event);
            this.channel?.ack(msg);
          } catch (handlerErr) {
            logger.error(`Handler failed for message on queue ${serviceQueueName}`, handlerErr);
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
