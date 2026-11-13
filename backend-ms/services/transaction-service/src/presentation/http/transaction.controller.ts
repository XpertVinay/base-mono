import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import {
  InitiatePaymentUseCase,
  CompletePaymentUseCase,
  GetTransactionByIdQuery
} from '../../application/use-cases/transaction.use-cases.js';
import {
  ListAllTransactionsQuery,
  GetBackofficeTransactionByIdQuery,
  CreateManualTransactionUseCase,
  UpdateTransactionUseCase,
  UpdateTransactionStatusUseCase,
  DeleteTransactionUseCase
} from '../../application/use-cases/backoffice-transaction.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const initiateSchema = z.object({
  referenceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional(),
  paymentMethod: z.string().optional(),
  tenantId: z.string().optional()
});

const webhookSchema = z.object({
  transactionId: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED']),
  providerTxnId: z.string().optional(),
  failureReason: z.string().optional(),
  tenantId: z.string().optional()
});

const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional(),
  type: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  search: z.string().trim().optional()
});

const createManualSchema = z.object({
  referenceId: z.string().min(1),
  userId: z.string().min(1),
  type: z.enum(['PAYMENT', 'REFUND', 'TRANSFER']).default('PAYMENT'),
  amount: z.number().positive(),
  currency: z.string().optional().default('USD'),
  paymentMethod: z.string().min(1).default('MANUAL_ENTRY'),
  tenantId: z.string().optional()
});

const updateTransactionSchema = z.object({
  failureReason: z.string().optional(),
  provider: z.string().optional(),
  paymentMethod: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']),
  reason: z.string().optional()
});

export class TransactionController {
  constructor(
    private readonly initiateUseCase: InitiatePaymentUseCase,
    private readonly completeUseCase: CompletePaymentUseCase,
    private readonly getByIdQuery: GetTransactionByIdQuery,
    private readonly listAllQuery?: ListAllTransactionsQuery,
    private readonly getBackofficeByIdQuery?: GetBackofficeTransactionByIdQuery,
    private readonly createManualUseCase?: CreateManualTransactionUseCase,
    private readonly updateUseCase?: UpdateTransactionUseCase,
    private readonly updateStatusUseCase?: UpdateTransactionStatusUseCase,
    private readonly deleteUseCase?: DeleteTransactionUseCase
  ) {}

  private getTenantId(req: Request): string {
    return req.tenant?.tenantId || req.user?.tenantId || (req.header('x-tenant-id') as string) || 'default';
  }

  private verifyWebhookSignature(req: Request): boolean {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
    if (req.header('x-internal-secret') === internalSecret) {
      return true;
    }

    const signature = req.header('x-webhook-signature') || req.header('stripe-signature');
    const webhookSecret = process.env.WEBHOOK_SECRET || internalSecret;

    if (!signature) {
      return false;
    }

    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    const sigClean = signature.replace(/^v1=/, '');

    try {
      return crypto.timingSafeEqual(Buffer.from(sigClean, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || (req.header('x-user-id') as string);
      if (!userId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No authenticated user identity provided' }]
        });
        return;
      }

      const validated = initiateSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.initiateUseCase.execute({ ...validated, userId, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'INITIATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Transaction initiated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.verifyWebhookSignature(req)) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Invalid webhook signature',
          errors: [{ code: 'UNAUTHORIZED_WEBHOOK', message: 'Cryptographic signature mismatch' }]
        });
        return;
      }

      const validated = webhookSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.completeUseCase.execute({
        transactionId: validated.transactionId,
        providerTxnId: validated.providerTxnId,
        failureReason: validated.failureReason,
        success: validated.status === 'SUCCESS',
        tenantId
      });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'WEBHOOK_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Webhook processed successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listAllQuery) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'List transactions not implemented' });
        return;
      }

      const queryParams = listTransactionsQuerySchema.parse(req.query);
      const tenantId = this.getTenantId(req);

      const result = await this.listAllQuery.execute({
        tenantId,
        page: queryParams.page,
        limit: queryParams.limit,
        status: queryParams.status,
        type: queryParams.type,
        userId: queryParams.userId,
        search: queryParams.search
      });

      const { transactions, total, page, limit } = result.getValue();

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Transactions retrieved successfully',
        data: transactions,
        meta: {
          pagination: {
            total,
            limit,
            page,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id || (req.header('x-user-id') as string) || '';
      const role = req.user?.role || (req.header('x-user-role') as string) || 'USER';
      const tenantId = this.getTenantId(req);

      if (['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(role) && this.getBackofficeByIdQuery) {
        const result = await this.getBackofficeByIdQuery.execute({ id, tenantId });
        if (result.isFailure) {
          ApiResponse.error(res, {
            req,
            statusCode: 404,
            message: result.getError(),
            errors: [{ code: 'TRANSACTION_NOT_FOUND', message: result.getError() }]
          });
          return;
        }

        ApiResponse.success(res, {
          req,
          statusCode: 200,
          message: 'Transaction retrieved successfully',
          data: result.getValue()
        });
        return;
      }

      const result = await this.getByIdQuery.execute({ id, userId, role, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'TRANSACTION_NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Transaction retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  createManual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.createManualUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Create manual transaction not implemented' });
        return;
      }

      const validated = createManualSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.createManualUseCase.execute({ ...validated, tenantId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'TRANSACTION_CREATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Transaction recorded successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update transaction not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);
      const validated = updateTransactionSchema.parse(req.body);

      const result = await this.updateUseCase.execute({ id, tenantId, ...validated });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'TRANSACTION_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Transaction updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateStatusUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Update transaction status not implemented' });
        return;
      }

      const id = req.params.id as string;
      const tenantId = this.getTenantId(req);
      const validated = updateStatusSchema.parse(req.body);

      const result = await this.updateStatusUseCase.execute({
        id,
        status: validated.status as any,
        reason: validated.reason,
        tenantId
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'TRANSACTION_STATUS_UPDATE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Transaction status updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  deleteTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.deleteUseCase) {
        ApiResponse.error(res, { req, statusCode: 501, message: 'Delete transaction not implemented' });
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
          errors: [{ code: 'TRANSACTION_DELETE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Transaction deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
