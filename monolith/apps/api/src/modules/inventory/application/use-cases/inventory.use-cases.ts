import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import {
  InventoryItemDto,
  CreateInventoryItemRequestDto,
  ReserveStockRequestDto,
  ReleaseStockRequestDto,
  CommitStockRequestDto
} from '@monolith/contracts';
import {
  NotFoundError,
  ConflictError,
  BadRequestError
} from '../../../../shared/presentation/error-handler.middleware.js';
import { v4 as uuidv4 } from 'uuid';

export interface ListInventoryInput {
  tenantId?: string;
}

export interface GetInventoryItemInput {
  productId: string;
  tenantId: string;
}

export class ListInventoryQuery implements IQuery<ListInventoryInput, InventoryItemDto[]> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input?: ListInventoryInput): Promise<Result<InventoryItemDto[], Error>> {
    try {
      const items = await this.repository.findAll(input?.tenantId);
      return Result.ok(
        items.map(i => ({
          productId: i.productId,
          tenantId: i.tenantId,
          sku: i.sku,
          name: i.name,
          category: i.category,
          availableQuantity: i.availableQuantity,
          reservedQuantity: i.reservedQuantity,
          totalQuantity: i.totalQuantity,
          version: i.version,
          updatedAt: i.updatedAt.toISOString()
        }))
      );
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetInventoryItemQuery implements IQuery<GetInventoryItemInput, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute({ productId, tenantId }: GetInventoryItemInput): Promise<Result<InventoryItemDto, Error>> {
    try {
      const item = await this.repository.findByProductId(productId, tenantId);
      if (!item) {
        return Result.fail(new NotFoundError(`Inventory item '${productId}'`));
      }

      return Result.ok({
        productId: item.productId,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        version: item.version,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class CreateInventoryItemUseCase implements IUseCase<CreateInventoryItemRequestDto, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input: CreateInventoryItemRequestDto): Promise<Result<InventoryItemDto, Error>> {
    try {
      const tenantId = input.tenantId || 'default-tenant';
      if (!input.sku || input.sku.trim().length === 0) {
        return Result.fail(new BadRequestError('SKU is required'));
      }

      if (input.initialQuantity < 0) {
        return Result.fail(new BadRequestError('Initial stock quantity cannot be negative'));
      }

      const existing = await this.repository.findBySku(input.sku.trim(), tenantId);
      if (existing) {
        return Result.fail(new ConflictError(`SKU '${input.sku}' already exists within this tenant organization`));
      }

      const productId = input.productId || uuidv4();
      const item = InventoryItem.create({
        productId,
        tenantId,
        sku: input.sku.trim(),
        name: input.name?.trim(),
        category: input.category?.trim(),
        initialStock: input.initialQuantity
      });

      await this.repository.save(item);

      return Result.ok({
        productId: item.productId,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        version: item.version,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ReserveStockUseCase implements IUseCase<ReserveStockRequestDto, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input: ReserveStockRequestDto): Promise<Result<InventoryItemDto, Error>> {
    try {
      if (input.quantity <= 0) {
        return Result.fail(new BadRequestError('Reservation quantity must be greater than zero'));
      }

      const item = await this.repository.findByProductId(input.productId, input.tenantId);
      if (!item) {
        return Result.fail(new NotFoundError(`Inventory for product '${input.productId}'`));
      }

      try {
        item.reserve(input.quantity, input.expectedVersion);
      } catch (err: any) {
        return Result.fail(new ConflictError(err.message));
      }

      const updated = await this.repository.update(item, input.expectedVersion);
      if (!updated) {
        return Result.fail(
          new ConflictError(
            `Optimistic concurrency conflict for product '${input.productId}'. Stock was modified by another operation. Please retry.`
          )
        );
      }

      return Result.ok({
        productId: item.productId,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        version: item.version,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ReleaseStockUseCase implements IUseCase<ReleaseStockRequestDto, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input: ReleaseStockRequestDto): Promise<Result<InventoryItemDto, Error>> {
    try {
      if (input.quantity <= 0) {
        return Result.fail(new BadRequestError('Release quantity must be greater than zero'));
      }

      const item = await this.repository.findByProductId(input.productId, input.tenantId);
      if (!item) {
        return Result.fail(new NotFoundError(`Inventory for product '${input.productId}'`));
      }

      try {
        item.release(input.quantity);
      } catch (err: any) {
        return Result.fail(new BadRequestError(err.message));
      }

      await this.repository.update(item);

      return Result.ok({
        productId: item.productId,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        version: item.version,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class CommitStockUseCase implements IUseCase<CommitStockRequestDto, InventoryItemDto> {
  constructor(private readonly repository: IInventoryRepository) {}

  async execute(input: CommitStockRequestDto): Promise<Result<InventoryItemDto, Error>> {
    try {
      if (input.quantity <= 0) {
        return Result.fail(new BadRequestError('Commit quantity must be greater than zero'));
      }

      const item = await this.repository.findByProductId(input.productId, input.tenantId);
      if (!item) {
        return Result.fail(new NotFoundError(`Inventory for product '${input.productId}'`));
      }

      try {
        item.commit(input.quantity);
      } catch (err: any) {
        return Result.fail(new BadRequestError(err.message));
      }

      await this.repository.update(item);

      return Result.ok({
        productId: item.productId,
        tenantId: item.tenantId,
        sku: item.sku,
        name: item.name,
        category: item.category,
        availableQuantity: item.availableQuantity,
        reservedQuantity: item.reservedQuantity,
        totalQuantity: item.totalQuantity,
        version: item.version,
        updatedAt: item.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
