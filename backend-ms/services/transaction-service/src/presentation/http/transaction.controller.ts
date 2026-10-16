import { Request, Response, NextFunction } from 'express';
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
  paymentMethod: z.string().optional()
});

const webhookSchema = z.object({
  transactionId: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED']),
  providerTxnId: z.string().optional(),
  failureReason: z.string().optional()
});

export class TransactionController {
  constructor(
    private readonly initiateUseCase: InitiatePaymentUseCase,
    private readonly completeUseCase: CompletePaymentUseCase,
    private readonly getByIdQuery: GetTransactionByIdQuery
  ) {}

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
      const result = await this.initiateUseCase.execute({ ...validated, userId });

      const txn = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'Payment transaction initiated successfully',
        data: txn,
        meta: {
          further_steps: [
            `Forward customer to checkout redirectUrl if provided, or finalize via payment provider: "${(txn as any).gateway}"`
          ]
        }
      });
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = webhookSchema.parse(req.body);
      const result = await this.completeUseCase.execute({
        transactionId: validated.transactionId,
        providerTxnId: validated.providerTxnId,
        success: validated.status === 'SUCCESS',
        failureReason: validated.failureReason
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
      const result = await this.getByIdQuery.execute({ id });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }]
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
