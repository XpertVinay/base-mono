import { Router } from 'express';
import { PostgresFinanceRepository } from './infrastructure/persistence/postgres-finance.repository.js';
import { CreateExpenseUseCase } from './application/commands/create-expense.use-case.js';
import { ApproveExpenseUseCase } from './application/commands/approve-expense.use-case.js';
import { SettleExpenseUseCase } from './application/commands/settle-expense.use-case.js';
import { ListExpensesQuery } from './application/queries/list-expenses.query.js';
import { FinanceController } from './presentation/http/finance.controller.js';
import { createFinanceRouter } from './presentation/http/finance.routes.js';
import { container } from '../../bootstrap/container.js';
import { ExpenseRecordDto } from '@monolith/contracts';

export interface IFinanceModulePublicApi {
  getTotalExpensesForProperty(propertyId: string): Promise<number>;
  getPendingApprovalsForProperty(propertyId: string): Promise<ExpenseRecordDto[]>;
}

export class FinanceModule {
  public static init(): { router: Router; publicApi: IFinanceModulePublicApi } {
    const repository = new PostgresFinanceRepository();
    const createExpenseUseCase = new CreateExpenseUseCase(repository);
    const approveExpenseUseCase = new ApproveExpenseUseCase(repository);
    const settleExpenseUseCase = new SettleExpenseUseCase(repository);
    const listExpensesQuery = new ListExpensesQuery(repository);

    const controller = new FinanceController(
      createExpenseUseCase,
      approveExpenseUseCase,
      settleExpenseUseCase,
      listExpensesQuery
    );
    const router = createFinanceRouter(controller);

    const publicApi: IFinanceModulePublicApi = {
      getTotalExpensesForProperty: async (propertyId: string) => {
        const expenses = await repository.findByPropertyId(propertyId);
        return expenses
          .filter(e => e.status === 'SETTLED')
          .reduce((sum, e) => sum + e.amount, 0);
      },
      getPendingApprovalsForProperty: async (propertyId: string) => {
        const expenses = await repository.findByPropertyId(propertyId);
        return expenses
          .filter(e => e.status === 'PENDING_APPROVAL')
          .map(e => ({
            id: e.id,
            propertyId: e.propertyId,
            creatorId: e.creatorId,
            payeeName: e.payeeName,
            expenseType: e.expenseType,
            amount: e.amount,
            description: e.description,
            invoiceUrl: e.invoiceUrl || undefined,
            status: e.status,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString()
          }));
      }
    };

    container.register('IFinanceModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
