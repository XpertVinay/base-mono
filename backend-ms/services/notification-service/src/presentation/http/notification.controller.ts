import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SendNotificationUseCase, ListNotificationsQuery } from '../../application/use-cases/notification.use-cases.js';

const sendNotificationSchema = z.object({
  recipient: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'WEBHOOK']),
  subject: z.string().min(1),
  body: z.string().min(1)
});

export class NotificationController {
  constructor(
    private readonly sendUseCase: SendNotificationUseCase,
    private readonly listQuery: ListNotificationsQuery
  ) {}

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = sendNotificationSchema.parse(req.body);
      const result = await this.sendUseCase.execute(validated);

      res.status(201).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const result = await this.listQuery.execute({ limit });

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
