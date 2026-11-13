import { IInventoryRepository, ListInventoryOptions } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface ListAllInventoryDTO extends ListInventoryOptions {
  tenantId?: string;
}

export interface CreateInventoryItemDTO {
  productId: string;
  sku: string;
  totalQuantity: number;
  availableQuantity?: number;
  tenantId?: string;
}

export interface UpdateInventoryItemDTO {
  productId: string;
  sku?: string;
  totalQuantity?: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  tenantId?: string;
}

export interface DeleteInventoryItemDTO {
  productId: string;
  tenantId?: string;
}

export class ListAllInventoryQuery {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(dto: ListAllInventoryDTO): Promise<Result<{ items: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.findAll(dto.tenantId, {
      page,
      limit,
      search: dto.search,
      lowStock: dto.lowStock
    });

    const mapped = result.items.map(item => ({
      productId: item.productId,
      tenantId: item.tenantId,
      sku: item.sku,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: item.totalQuantity,
      updatedAt: item.updatedAt
    }));

    return Result.ok({
      items: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class CreateInventoryItemUseCase {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(dto: CreateInventoryItemDTO): Promise<Result<any>> {
    const existing = await this.repo.findByProductId(dto.productId, dto.tenantId);
    if (existing) {
      return Result.fail(`Inventory item with productId ${dto.productId} already exists`);
    }

    const existingSku = await this.repo.findBySku(dto.sku, dto.tenantId);
    if (existingSku) {
      return Result.fail(`Inventory item with SKU ${dto.sku} already exists`);
    }

    const available = dto.availableQuantity !== undefined ? dto.availableQuantity : dto.totalQuantity;
    const item = InventoryItem.create(dto.productId, {
      sku: dto.sku,
      totalQuantity: dto.totalQuantity,
      availableQuantity: available,
      reservedQuantity: 0,
      tenantId: dto.tenantId
    });

    await this.repo.save(item);

    return Result.ok({
      productId: item.productId,
      tenantId: item.tenantId,
      sku: item.sku,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: item.totalQuantity,
      updatedAt: item.updatedAt
    });
  }
}

export class UpdateInventoryItemUseCase {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(dto: UpdateInventoryItemDTO): Promise<Result<any>> {
    const item = await this.repo.findByProductId(dto.productId, dto.tenantId);
    if (!item) {
      return Result.fail(`Inventory item with productId ${dto.productId} not found`);
    }

    if (dto.sku && dto.sku !== item.sku) {
      const existingSku = await this.repo.findBySku(dto.sku, dto.tenantId);
      if (existingSku && existingSku.productId !== item.productId) {
        return Result.fail(`Inventory item with SKU ${dto.sku} already exists`);
      }
    }

    item.updateDetails({
      sku: dto.sku,
      availableQuantity: dto.availableQuantity,
      totalQuantity: dto.totalQuantity,
      reservedQuantity: dto.reservedQuantity
    });

    await this.repo.update(item);

    return Result.ok({
      productId: item.productId,
      tenantId: item.tenantId,
      sku: item.sku,
      availableQuantity: item.availableQuantity,
      reservedQuantity: item.reservedQuantity,
      totalQuantity: item.totalQuantity,
      updatedAt: item.updatedAt
    });
  }
}

export class DeleteInventoryItemUseCase {
  constructor(private readonly repo: IInventoryRepository) {}

  async execute(dto: DeleteInventoryItemDTO): Promise<Result<{ productId: string; deleted: boolean }>> {
    const item = await this.repo.findByProductId(dto.productId, dto.tenantId);
    if (!item) {
      return Result.fail(`Inventory item with productId ${dto.productId} not found`);
    }

    const deleted = await this.repo.delete(dto.productId, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete inventory item');
    }

    return Result.ok({ productId: dto.productId, deleted: true });
  }
}

