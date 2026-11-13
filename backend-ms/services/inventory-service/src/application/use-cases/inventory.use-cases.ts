import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { InventoryItemDto } from '../../shared/contracts/index.js';

export interface ReserveInventoryInput {
  productId: string;
  quantity: number;
  tenantId?: string;
}

export class ReserveInventoryUseCase implements UseCase<ReserveInventoryInput, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: ReserveInventoryInput): Promise<Result<InventoryItemDto>> {
    const updated = await this.repo.reserveAtomic(input.productId, input.quantity, input.tenantId);
    if (!updated) {
      const item = await this.repo.findByProductId(input.productId, input.tenantId);
      if (!item) {
        return Result.fail('Product not found in inventory');
      }
      return Result.fail(`Insufficient stock. Available: ${item.availableQuantity}, Requested: ${input.quantity}`);
    }

    return Result.ok({
      productId: updated.productId,
      sku: updated.sku,
      availableQuantity: updated.availableQuantity,
      reservedQuantity: updated.reservedQuantity,
      totalQuantity: updated.totalQuantity,
      updatedAt: updated.updatedAt.toISOString()
    });
  }
}

export interface ReleaseInventoryInput {
  productId: string;
  quantity: number;
  tenantId?: string;
}

export class ReleaseInventoryUseCase implements UseCase<ReleaseInventoryInput, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: ReleaseInventoryInput): Promise<Result<InventoryItemDto>> {
    const updated = await this.repo.releaseAtomic(input.productId, input.quantity, input.tenantId);
    if (!updated) {
      return Result.fail('Product not found in inventory');
    }

    return Result.ok({
      productId: updated.productId,
      sku: updated.sku,
      availableQuantity: updated.availableQuantity,
      reservedQuantity: updated.reservedQuantity,
      totalQuantity: updated.totalQuantity,
      updatedAt: updated.updatedAt.toISOString()
    });
  }
}

export interface AddStockInput {
  productId: string;
  sku: string;
  quantity: number;
  tenantId?: string;
}

export class AddStockUseCase implements UseCase<AddStockInput, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: AddStockInput): Promise<Result<InventoryItemDto>> {
    const tid = input.tenantId || 'default';
    let item = await this.repo.findByProductId(input.productId, tid);

    if (item) {
      item.addStock(input.quantity);
      await this.repo.update(item);
    } else {
      item = InventoryItem.create(input.productId, {
        tenantId: tid,
        sku: input.sku,
        availableQuantity: input.quantity,
        reservedQuantity: 0,
        totalQuantity: input.quantity
      });
      await this.repo.save(item);
    }

    return Result.ok({
      productId: item.productId,
      sku: item.sku,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: item.totalQuantity,
      updatedAt: item.updatedAt.toISOString()
    });
  }
}

export class GetStockQuery implements UseCase<{ productId: string; tenantId?: string }, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: { productId: string; tenantId?: string }): Promise<Result<InventoryItemDto>> {
    const item = await this.repo.findByProductId(input.productId, input.tenantId);
    if (!item) {
      return Result.fail('Product not found in inventory');
    }

    return Result.ok({
      productId: item.productId,
      sku: item.sku,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: item.totalQuantity,
      updatedAt: item.updatedAt.toISOString()
    });
  }
}
