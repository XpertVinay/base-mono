import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { InventoryItemDto } from '../../shared/contracts/index.js';

export interface ReserveInventoryInput {
  productId: string;
  quantity: number;
}

export class ReserveInventoryUseCase implements UseCase<ReserveInventoryInput, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: ReserveInventoryInput): Promise<Result<InventoryItemDto>> {
    const item = await this.repo.findByProductId(input.productId);
    if (!item) {
      return Result.fail('Product not found in inventory');
    }

    const success = item.reserve(input.quantity);
    if (!success) {
      return Result.fail(`Insufficient stock. Available: ${item.availableQuantity}, Requested: ${input.quantity}`);
    }

    await this.repo.update(item);

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

export interface AddStockInput {
  productId: string;
  sku: string;
  quantity: number;
}

export class AddStockUseCase implements UseCase<AddStockInput, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: AddStockInput): Promise<Result<InventoryItemDto>> {
    let item = await this.repo.findByProductId(input.productId);

    if (item) {
      item.addStock(input.quantity);
      await this.repo.update(item);
    } else {
      item = InventoryItem.create(input.productId, {
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

export class GetStockQuery implements UseCase<{ productId: string }, InventoryItemDto> {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(input: { productId: string }): Promise<Result<InventoryItemDto>> {
    const item = await this.repo.findByProductId(input.productId);
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
