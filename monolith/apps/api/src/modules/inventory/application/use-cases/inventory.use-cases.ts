import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItemDto, ReserveStockRequestDto } from '@monolith/contracts';
import { NotFoundError, ConflictError } from '../../../../shared/presentation/error-handler.middleware.js';

export class ListInventoryQuery implements IQuery<void, InventoryItemDto[]> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(): Promise<Result<InventoryItemDto[], Error>> {
    try {
      const items = await this.repository.findAll();
      return Result.ok(items.map(i => ({
        productId: i.productId,
        sku: i.sku,
        availableQuantity: i.availableQuantity,
        reservedQuantity: i.reservedQuantity,
        totalQuantity: i.totalQuantity,
        updatedAt: i.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ReserveStockUseCase implements IUseCase<ReserveStockRequestDto, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input: ReserveStockRequestDto): Promise<Result<InventoryItemDto, Error>> {
    try {
      const item = await this.repository.findByProductId(input.productId);
      if (!item) return Result.fail(new NotFoundError(`Inventory for product '${input.productId}'`));

      try {
        item.reserve(input.quantity);
      } catch (err: any) {
        return Result.fail(new ConflictError(err.message));
      }

      await this.repository.update(item);

      return Result.ok({
        productId: item.productId,
        sku: item.sku,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
