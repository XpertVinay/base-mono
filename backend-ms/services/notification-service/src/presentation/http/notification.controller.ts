import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SendNotificationUseCase, ListNotificationsQuery } from '../../application/use-cases/notification.use-cases.js';
import {
  ListAllNotificationsQuery,
  GetNotificationByIdQuery,
  UpdateNotificationUseCase,
  DeleteNotificationUseCase
} from '../../application/use-cases/backoffice-notification.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const sendNotificationSchema = z.object({
  recipient: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'PUSH', 'WEBHOOK']),
  subject: z.string().min(1),
  body: z.string().min(1),
  tenantId: z.string().optional()
});

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional(),
  channel: z.string().trim().optional(),
  search: z.string().trim().optional()
});

const updateNotificationSchema = z.object({
  recipient: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional()
});

export class NotificationController {
  constructor(
    private readonly sendUseCase: SendNotificationUseCase,
    private readonly listQuery: ListNotificationsQuery,
    private readonly listAllQuery?: ListAllNotificationsQuery,
    private readonly getByIdQuery?: GetNotificationByIdQuery,
    private readonly updateUseCase?: UpdateNotificationUseCase,
    private readonly deleteUseCase?: DeleteNotificationUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = sendNotificationSchema.parse(req.body);
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';
      const userEmail = req.user?.email || (req.header('x-user-email') as string) || '';

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
      const tenantId = this.getTenantId(req);

      if (this.listAllQuery) {
        const queryParams = listNotificationsQuerySchema.parse(req.query);
        const result = await this.listAllQuery.execute({
          tenantId,
          page: queryParams.page,
          limit: queryParams.limit,
          status: queryParams.status,
          channel: queryParams.channel,
          search: queryParams.search
        });

        const { notifications, total, page, limit } = result.getValue();

        ApiResponse.success(res, {
          req,
          statusCode: 200,
          message: 'Notifications retrieved successfully',
          data: notifications,
          meta: {
            pagination: {
              total,
              limit,
              page,
              totalPages: Math.ceil(total / limit) || 1
            }
          }
        });
        return;
      }

      const limit = parseInt(req.query.limit as string, 10) || 50;
      const result = await this.listQuery.execute({ limit, tenantId });
      const notifications = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Notifications retrieved successfully',
        data: notifications,
        meta: {
          pagination: {
            total: notifications.length,
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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.getByIdQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Get notification by ID not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);

      const result = await this.getByIdQuery.execute({ id, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOTIFICATION_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Notification retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update notification not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);
      const validated = updateNotificationSchema.parse(req.body);

      const result = await this.updateUseCase.execute({ id, tenantId, ...validated });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOTIFICATION_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Notification updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete notification not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);

      const result = await this.deleteUseCase.execute({ id, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOTIFICATION_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Notification deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
