import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IFinanceRepository } from '../../domain/repositories/finance-repository.interface.js';
import { ExpenseRecordDto } from '@monolith/contracts';

export interface ApproveExpenseInput {
  expenseId: string;
  approverId: string;
  isApproved: boolean;
}

export class ApproveExpenseUseCase implements IUseCase<ApproveExpenseInput, ExpenseRecordDto> {
  constructor(private readonly financeRepository: IFinanceRepository) {}

  async execute(input: ApproveExpenseInput): Promise<Result<ExpenseRecordDto, Error>> {
    try {
      const expense = await this.financeRepository.findById(input.expenseId);
      if (!expense) {
        return Result.fail(new Error(`Expense record ${input.expenseId} not found`));
      }

      if (input.isApproved) {
        expense.approve(input.approverId);
      } else {
        expense.reject(input.approverId);
      }

      await this.financeRepository.update(expense);

      return Result.ok({
        id: expense.id,
        propertyId: expense.propertyId,
        creatorId: expense.creatorId,
        payeeName: expense.payeeName,
        expenseType: expense.expenseType,
        amount: expense.amount,
        description: expense.description,
        invoiceUrl: expense.invoiceUrl || undefined,
        status: expense.status,
        approvedBy: expense.approvedBy || undefined,
        approvedAt: expense.approvedAt ? expense.approvedAt.toISOString() : undefined,
        settledAt: expense.settledAt ? expense.settledAt.toISOString() : undefined,
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
