import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IFinanceRepository } from '../../domain/repositories/finance-repository.interface.js';
import { ExpenseRecord } from '../../domain/entities/expense-record.entity.js';
import { CreateExpenseRequestDto, ExpenseRecordDto } from '@monolith/contracts';

export interface CreateExpenseInput extends CreateExpenseRequestDto {
  creatorId: string;
}

export class CreateExpenseUseCase implements IUseCase<CreateExpenseInput, ExpenseRecordDto> {
  constructor(private readonly financeRepository: IFinanceRepository) {}

  async execute(input: CreateExpenseInput): Promise<Result<ExpenseRecordDto, Error>> {
    try {
      const expense = ExpenseRecord.create(
        input.propertyId,
        input.creatorId,
        input.payeeName,
        input.expenseType,
        input.amount,
        input.description,
        input.invoiceUrl ?? null
      );

      await this.financeRepository.save(expense);

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
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
