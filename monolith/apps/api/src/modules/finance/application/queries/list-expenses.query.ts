import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IFinanceRepository } from '../../domain/repositories/finance-repository.interface.js';
import { ExpenseRecordDto } from '@monolith/contracts';

export interface ListExpensesInput {
  propertyId?: string;
}

export class ListExpensesQuery implements IUseCase<ListExpensesInput, ExpenseRecordDto[]> {
  constructor(private readonly financeRepository: IFinanceRepository) {}

  async execute(input: ListExpensesInput): Promise<Result<ExpenseRecordDto[], Error>> {
    try {
      const expenses = input.propertyId
        ? await this.financeRepository.findByPropertyId(input.propertyId)
        : await this.financeRepository.findAll();

      const dtos: ExpenseRecordDto[] = expenses.map(e => ({
        id: e.id,
        propertyId: e.propertyId,
        creatorId: e.creatorId,
        payeeName: e.payeeName,
        expenseType: e.expenseType,
        amount: e.amount,
        description: e.description,
        invoiceUrl: e.invoiceUrl || undefined,
        status: e.status,
        approvedBy: e.approvedBy || undefined,
        approvedAt: e.approvedAt ? e.approvedAt.toISOString() : undefined,
        settledAt: e.settledAt ? e.settledAt.toISOString() : undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
