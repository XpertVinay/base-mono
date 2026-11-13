import { ITransactionRepository, ListTransactionsOptions } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction, TransactionStatus, TransactionType } from '../../domain/entities/transaction.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface ListAllTransactionsDTO extends ListTransactionsOptions {
  tenantId?: string;
}

export interface GetTransactionByIdDTO {
  id: string;
  tenantId?: string;
}

export interface CreateManualTransactionDTO {
  referenceId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  paymentMethod: string;
  tenantId?: string;
}

export interface UpdateTransactionDTO {
  id: string;
  failureReason?: string;
  provider?: string;
  paymentMethod?: string;
  tenantId?: string;
}

export interface UpdateTransactionStatusDTO {
  id: string;
  status: TransactionStatus;
  reason?: string;
  tenantId?: string;
}

export interface DeleteTransactionDTO {
  id: string;
  tenantId?: string;
}

export class ListAllTransactionsQuery {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: ListAllTransactionsDTO): Promise<Result<{ transactions: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.findAll(dto.tenantId, {
      page,
      limit,
      status: dto.status,
      type: dto.type,
      userId: dto.userId,
      search: dto.search
    });

    const mapped = result.transactions.map(t => ({
      id: t.id,
      tenantId: t.tenantId,
      referenceId: t.referenceId,
      userId: t.userId,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      paymentMethod: t.paymentMethod,
      failureReason: t.failureReason,
      provider: t.provider,
      providerSessionId: t.providerSessionId,
      providerTransactionId: t.providerTransactionId,
      redirectUrl: t.redirectUrl,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    return Result.ok({
      transactions: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class GetBackofficeTransactionByIdQuery {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: GetTransactionByIdDTO): Promise<Result<any>> {
    const txn = await this.repo.findById(dto.id, dto.tenantId);
    if (!txn) {
      return Result.fail('Transaction not found');
    }

    return Result.ok({
      id: txn.id,
      tenantId: txn.tenantId,
      referenceId: txn.referenceId,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: txn.paymentMethod,
      failureReason: txn.failureReason,
      provider: txn.provider,
      providerSessionId: txn.providerSessionId,
      providerTransactionId: txn.providerTransactionId,
      redirectUrl: txn.redirectUrl,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt
    });
  }
}

export class CreateManualTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: CreateManualTransactionDTO): Promise<Result<any>> {
    const txn = Transaction.create({
      referenceId: dto.referenceId,
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency || 'USD',
      paymentMethod: dto.paymentMethod,
      tenantId: dto.tenantId
    });

    await this.repo.save(txn);

    return Result.ok({
      id: txn.id,
      tenantId: txn.tenantId,
      referenceId: txn.referenceId,
      userId: txn.userId,
      type: txn.type,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: txn.paymentMethod,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt
    });
  }
}

export class UpdateTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: UpdateTransactionDTO): Promise<Result<any>> {
    const txn = await this.repo.findById(dto.id, dto.tenantId);
    if (!txn) {
      return Result.fail('Transaction not found');
    }

    txn.update({
      failureReason: dto.failureReason,
      provider: dto.provider,
      paymentMethod: dto.paymentMethod
    });

    await this.repo.update(txn);

    return Result.ok({
      id: txn.id,
      tenantId: txn.tenantId,
      referenceId: txn.referenceId,
      status: txn.status,
      paymentMethod: txn.paymentMethod,
      failureReason: txn.failureReason,
      provider: txn.provider,
      updatedAt: txn.updatedAt
    });
  }
}

export class UpdateTransactionStatusUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: UpdateTransactionStatusDTO): Promise<Result<any>> {
    const txn = await this.repo.findById(dto.id, dto.tenantId);
    if (!txn) {
      return Result.fail('Transaction not found');
    }

    txn.updateStatus(dto.status, dto.reason);
    await this.repo.update(txn);

    return Result.ok({
      id: txn.id,
      tenantId: txn.tenantId,
      referenceId: txn.referenceId,
      status: txn.status,
      failureReason: txn.failureReason,
      updatedAt: txn.updatedAt
    });
  }
}

export class DeleteTransactionUseCase {
  constructor(private readonly repo: ITransactionRepository) {}

  async execute(dto: DeleteTransactionDTO): Promise<Result<{ id: string; deleted: boolean }>> {
    const txn = await this.repo.findById(dto.id, dto.tenantId);
    if (!txn) {
      return Result.fail('Transaction not found');
    }

    const deleted = await this.repo.delete(dto.id, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete transaction');
    }

    return Result.ok({ id: dto.id, deleted: true });
  }
}

