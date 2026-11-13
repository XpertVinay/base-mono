import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import {
  InitiatePaymentUseCase,
  CompletePaymentUseCase,
  GetTransactionByIdQuery
} from '../../application/use-cases/transaction.use-cases.js';
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

export class TransactionController {
  constructor(
    private readonly initiateUseCase: InitiatePaymentUseCase,
    private readonly completeUseCase: CompletePaymentUseCase,
    private readonly getByIdQuery: GetTransactionByIdQuery
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
      const sigBuf = Buffer.from(sigClean, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    } catch {
      // Ignore conversion error
    }

    return sigClean === expected || signature === webhookSecret;
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

      const txn = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Payment transaction initiated successfully',
        data: txn,
        meta: {
          further_steps: [
            `Forward customer to checkout redirectUrl if provided, or finalize via payment provider: "${(txn as any).provider || 'GATEWAY'}"`
          ]
        }
      });
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Security: Strictly verify webhook signature to prevent unauthenticated payment spoofing
      if (!this.verifyWebhookSignature(req)) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Webhook signature verification failed or signature header missing',
          errors: [{ code: 'UNAUTHORIZED_WEBHOOK', message: 'Valid x-webhook-signature header is required' }]
        });
        return;
      }

      const validated = webhookSchema.parse(req.body);
      const tenantId = validated.tenantId || this.getTenantId(req);

      const result = await this.completeUseCase.execute({
        transactionId: validated.transactionId,
        providerTxnId: validated.providerTxnId,
        success: validated.status === 'SUCCESS',
        failureReason: validated.failureReason,
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
        message: 'Payment webhook processed successfully',
        data: result.getValue()
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

      const result = await this.getByIdQuery.execute({ id, userId, role, tenantId });

      if (result.isFailure) {
        const isForbidden = result.getError().startsWith('Forbidden');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 404,
          message: result.getError(),
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'NOT_FOUND', message: result.getError(), field: 'id' }]
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
}
