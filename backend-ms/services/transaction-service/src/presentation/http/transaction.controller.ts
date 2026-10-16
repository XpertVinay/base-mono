import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  InitiatePaymentUseCase,
  CompletePaymentUseCase,
  GetTransactionByIdQuery
} from '../../application/use-cases/transaction.use-cases.js';

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
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      const validated = initiateSchema.parse(req.body);
      const result = await this.initiateUseCase.execute({ ...validated, userId });

      res.status(201).json({ success: true, data: result.getValue() });
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
        res.status(400).json({ success: false, error: { code: 'WEBHOOK_FAILED', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.getByIdQuery.execute({ id });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({ success: true, data: result.getValue() });
    } catch (err) {
      next(err);
    }
  };
}
