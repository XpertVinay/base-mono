import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SendNotificationUseCase, ListNotificationsQuery } from '../../application/use-cases/notification.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const sendNotificationSchema = z.object({
  recipient: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'IN_APP']),
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

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const recipient = (req.query.recipient as string) || (req.user ? req.user.email : undefined);
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const result = await this.listQuery.execute({ recipient, limit });
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
