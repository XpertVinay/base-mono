import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SendNotificationUseCase, ListNotificationsQuery } from '../../application/use-cases/notification.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const sendNotificationSchema = z.object({
  recipient: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'WEBHOOK']),
  subject: z.string().min(1),
  body: z.string().min(1),
  tenantId: z.string().optional()
});

export class NotificationController {
  constructor(
    private readonly sendUseCase: SendNotificationUseCase,
    private readonly listQuery: ListNotificationsQuery
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = sendNotificationSchema.parse(req.body);
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';
      const userEmail = req.user?.email || (req.header('x-user-email') as string) || '';

      // Security: Restrict non-administrative users from arbitrary spam / relay / SMS bombing
      const isPrivileged = role === 'ADMIN' || role === 'SUPPORT';
      if (!isPrivileged && validated.channel === 'EMAIL' && userEmail && validated.recipient.toLowerCase() !== userEmail.toLowerCase()) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: 'Non-administrative users can only send email notifications to their own verified email address',
          errors: [{ code: 'FORBIDDEN_RECIPIENT', message: 'Destination recipient not authorized' }]
        });
        return;
      }

      if (!isPrivileged && (validated.channel === 'SMS' || validated.channel === 'WEBHOOK')) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: `Direct notification dispatch via ${validated.channel} requires ADMIN or SUPPORT role`,
          errors: [{ code: 'FORBIDDEN_CHANNEL', message: 'Channel requires elevated privileges' }]
        });
        return;
      }

      const tenantId = validated.tenantId || this.getTenantId(req);
      const result = await this.sendUseCase.execute({ ...validated, tenantId });

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Notification queued and dispatched successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const tenantId = this.getTenantId(req);
      const result = await this.listQuery.execute({ limit, tenantId });
      const items = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Notifications retrieved successfully',
        data: items,
        meta: {
          pagination: {
            total: items.length,
            limit,
            page: 1,
            totalPages: 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };
}
