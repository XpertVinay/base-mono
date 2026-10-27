import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateExpenseUseCase } from '../../application/commands/create-expense.use-case.js';
import { ApproveExpenseUseCase } from '../../application/commands/approve-expense.use-case.js';
import { SettleExpenseUseCase } from '../../application/commands/settle-expense.use-case.js';
import { ListExpensesQuery } from '../../application/queries/list-expenses.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createExpenseSchema = z.object({
  propertyId: z.string().min(1),
  payeeName: z.string().min(2),
  expenseType: z.enum([
    'MAINTENANCE_REPAIR',
    'CARETAKER_RETAINER',
    'EMERGENCY_FLOAT_REPLENISHMENT',
    'PROPERTY_TAX',
    'UTILITY_BILL',
    'DOCUMENTATION_FEE'
  ]),
  amount: z.number().positive(),
  description: z.string().min(2),
  invoiceUrl: z.string().url().optional()
});

const approveExpenseSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
});

export class FinanceController {
  constructor(
    private readonly createExpenseUseCase: CreateExpenseUseCase,
    private readonly approveExpenseUseCase: ApproveExpenseUseCase,
    private readonly settleExpenseUseCase: SettleExpenseUseCase,
    private readonly listExpensesQuery: ListExpensesQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createExpenseSchema.parse(req.body);
      const creatorId = req.user!.id;
      const result = await this.createExpenseUseCase.execute({ ...validated, creatorId });

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

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const expenseId = String(req.params.id);
      const validated = approveExpenseSchema.parse(req.body);
      const approverId = req.user!.id;

      const result = await this.approveExpenseUseCase.execute({
        expenseId,
        approverId,
        isApproved: validated.status === 'APPROVED'
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

  settle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const expenseId = String(req.params.id);
      const result = await this.settleExpenseUseCase.execute({ expenseId });

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
      const propertyId = req.query.propertyId as string | undefined;
      const result = await this.listExpensesQuery.execute({ propertyId });

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
