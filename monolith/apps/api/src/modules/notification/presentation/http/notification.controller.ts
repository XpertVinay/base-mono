import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  SendNotificationUseCase,
  SendBatchNotificationUseCase,
  ListNotificationsQuery,
  GetNotificationByIdQuery,
  GetNotificationConfigQuery,
  GetDryRunOutboxQuery,
  ClearDryRunOutboxUseCase,
  HandleNotificationWebhookUseCase
} from '../../application/use-cases/notification.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { NotificationChannel, NotificationStatus } from '@monolith/contracts';

const sendNotificationSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP']),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  provider: z.enum(['SENDGRID', 'TWILIO', 'META_CLOUD', 'FCM', 'MOCK']).optional(),
  dryRun: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  templateId: z.string().optional(),
  templateData: z.record(z.unknown()).optional()
});

const batchNotificationSchema = z.object({
  notifications: z.array(sendNotificationSchema).min(1, 'At least one notification is required').max(100, 'Maximum 100 notifications per batch'),
  dryRun: z.boolean().optional()
});

export class NotificationController {
  constructor(
    private readonly sendUseCase: SendNotificationUseCase,
    private readonly sendBatchUseCase: SendBatchNotificationUseCase,
    private readonly listQuery: ListNotificationsQuery,
    private readonly getByIdQuery: GetNotificationByIdQuery,
    private readonly getConfigQuery: GetNotificationConfigQuery,
    private readonly getDryRunOutboxQuery: GetDryRunOutboxQuery,
    private readonly clearDryRunOutboxUseCase: ClearDryRunOutboxUseCase,
    private readonly webhookUseCase: HandleNotificationWebhookUseCase
  ) {}

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = sendNotificationSchema.parse(req.body);

      // Support X-Dry-Run header override
      const headerDryRun = req.headers['x-dry-run'] === 'true' || req.headers['x-dry-run'] === '1';
      const effectiveDryRun = validated.dryRun !== undefined ? validated.dryRun : (headerDryRun ? true : undefined);

      const result = await this.sendUseCase.execute({
        ...validated,
        dryRun: effectiveDryRun
      });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  sendBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = batchNotificationSchema.parse(req.body);
      const headerDryRun = req.headers['x-dry-run'] === 'true' || req.headers['x-dry-run'] === '1';
      const effectiveDryRun = validated.dryRun !== undefined ? validated.dryRun : (headerDryRun ? true : undefined);

      const result = await this.sendBatchUseCase.execute({
        notifications: validated.notifications,
        dryRun: effectiveDryRun
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const recipient = (req.query.recipient as string) || (req.user ? req.user.email : undefined);
      const channel = req.query.channel as NotificationChannel | undefined;
      const status = req.query.status as NotificationStatus | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const result = await this.listQuery.execute({ recipient, channel, status, limit });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.getByIdQuery.execute({ id });
      if (result.isFailure) return next(result.getError());

      const data = result.getValue();
      if (!data) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Notification with ID '${id}' not found` },
          meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getConfig = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getConfigQuery.execute();
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getDryRunOutbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const recipient = req.query.recipient as string | undefined;
      const channel = req.query.channel as NotificationChannel | undefined;

      const result = await this.getDryRunOutboxQuery.execute({ recipient, channel });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  clearDryRunOutbox = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.clearDryRunOutboxUseCase.execute();
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = String(req.params.provider);
      const result = await this.webhookUseCase.execute({ provider, payload: req.body });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
